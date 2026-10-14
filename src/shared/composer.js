/**
 * The composer. Used by the block editor sidebar and the classic editor box
 * (with an article), and the admin page (without one).
 *
 * Editing, top to bottom:
 *
 * 1. **Main post**: text and an image. With an article it starts as the
 *    article's title, link and featured image, and follows the article until
 *    the person edits it.
 * 2. **Channels**: tick where it goes. Each picked channel shows its
 *    character count, anything stopping it from taking its content, and,
 *    once two are picked, a "Same as main post" checkbox. Unticking that
 *    opens the channel's own text and image under it, starting as a copy of
 *    the main post; such a channel goes out as its own post in Orbitwrite.
 * 3. **When**: next free slot, a date and time, or now.
 *
 * Laid out as plain sections (classic box, admin page) or as collapsible
 * panels, like every other block editor sidebar (`layout="panels"`).
 *
 * The unsent draft is kept per article, and the channels and timing per
 * person (see use-draft.js), so closing the sidebar or reloading loses
 * nothing and the next article starts with the usual channels.
 */
import {
	Button,
	DateTimePicker,
	Dropdown,
	ExternalLink,
	Notice,
	PanelBody,
	Spinner,
	TextareaControl,
	VisuallyHidden,
	// WordPress exports the segmented control under these names only
	// (still so in 7.1); it's what core's own sidebars use.
	// eslint-disable-next-line @wordpress/no-unsafe-wp-apis
	__experimentalToggleGroupControl as ToggleGroupControl,
	// eslint-disable-next-line @wordpress/no-unsafe-wp-apis
	__experimentalToggleGroupControlOption as ToggleGroupControlOption,
} from '@wordpress/components';
import { useCallback, useEffect, useMemo, useState } from '@wordpress/element';
import { __, _n, sprintf } from '@wordpress/i18n';

import * as api from './api';
import AutoShareToggle, {
	AutoShareNotices,
	autoSharePending,
} from './auto-share-toggle';
import ChannelList, { channelName } from './channel-list';
import {
	useChannels,
	useConnection,
	useNextSlot,
	useShareNumbers,
	useShares,
	useWatchOnPublish,
} from './hooks';
import ImageField from './image-field';
import { channelProblems, isPostable } from './rules';
import SentList from './sent-list';
import { articleText } from './text';
import { defaultScheduleTime, formatInstant, formatWallClock } from './time';
import useStored, {
	DEFAULT_PREFS,
	EMPTY_DRAFT,
	draftKey,
	prefsKey,
	worthKeeping,
} from './use-draft';
import {
	contentFor,
	hasOwnVersion,
	mainPostInUse,
	sendPayload,
} from './versions';

/**
 * The composer with its own connection: the classic box and the admin page.
 *
 * @param {Object}   props
 * @param {Function} [props.onStatus] Told the connection whenever it's read.
 */
export default function Composer( { onStatus = null, ...props } ) {
	const connection = useConnection();
	const { status } = connection;

	useEffect( () => {
		if ( onStatus && status ) {
			onStatus( status );
		}
	}, [ onStatus, status ] );

	return <ComposerView connection={ connection } { ...props } />;
}

/**
 * The composer, given a connection. The block editor holds the connection
 * and the article's posts above the sidebar, so its publish panels and Post
 * tab read the same ones and keep watching while the sidebar is closed.
 *
 * @param {Object}      props
 * @param {Object}      props.connection        From useConnection().
 * @param {number}      [props.postId]          The article, when there is one.
 * @param {Object|null} [props.article]         `{ title, link, status, featured }`.
 * @param {Object|null} [props.articleState]    `{ sent, numbers }`, when held above.
 * @param {string}      [props.layout]          `plain` or `panels`.
 * @param {Function}    [props.notify]          Says a send worked (a snackbar); a notice here otherwise.
 * @param {boolean}     [props.showAutoShare]   Offer the article's auto-share checkbox.
 * @param {boolean}     [props.allowDisconnect] Offer Disconnect.
 */
export function ComposerView( {
	connection,
	postId = 0,
	article = null,
	articleState = null,
	layout = 'plain',
	notify = null,
	showAutoShare = true,
	allowDisconnect = true,
} ) {
	const {
		status,
		error: statusError,
		notice,
		setNotice,
		reload,
	} = connection;

	const noticeView = notice && (
		<Notice status={ notice.type } onRemove={ () => setNotice( null ) }>
			{ notice.message }
			{ notice.openUrl && (
				<>
					{ ' ' }
					<ExternalLink href={ notice.openUrl }>
						{ __( 'Open in Orbitwrite', 'orbitwrite' ) }
					</ExternalLink>
				</>
			) }
		</Notice>
	);

	if ( statusError ) {
		return (
			<div className="orbitwrite-composer">
				<Notice status="error" isDismissible={ false }>
					{ statusError }
				</Notice>
			</div>
		);
	}

	if ( ! status ) {
		return (
			<div className="orbitwrite-composer">
				<Spinner />
			</div>
		);
	}

	if ( ! status.connected ) {
		return (
			<div
				className={ `orbitwrite-composer${
					layout === 'panels' ? ' is-padded' : ''
				}` }
			>
				{ noticeView }
				<p>
					{ __(
						'Connect your Orbitwrite workspace to publish and schedule social posts from WordPress.',
						'orbitwrite'
					) }
				</p>
				{ status.problems.map( ( problem ) => (
					<Notice
						key={ problem }
						status="warning"
						isDismissible={ false }
					>
						{ problem }
					</Notice>
				) ) }
				{ status.connectUrl && (
					<Button
						variant="primary"
						className="orbitwrite-composer__connect"
						href={ status.connectUrl }
					>
						{ __( 'Connect Orbitwrite', 'orbitwrite' ) }
					</Button>
				) }
			</div>
		);
	}

	// Stored drafts and picks belong to a site, a person and a workspace; and
	// a draft to an article. A change of any of them is a different editor.
	const scope = `${ status.draftScope }:${ status.organization?.id || '' }`;
	return (
		<Editing
			key={ `${ scope }:${ postId }` }
			scope={ scope }
			postId={ postId }
			article={ article }
			status={ status }
			noticeView={ noticeView }
			setNotice={ setNotice }
			reload={ reload }
			articleState={ articleState }
			layout={ layout }
			notify={ notify }
			showAutoShare={ showAutoShare }
			allowDisconnect={ allowDisconnect }
		/>
	);
}

/**
 * A part of the composer: a collapsible panel in the block editor sidebar,
 * a plain block elsewhere.
 *
 * @param {Object}  props
 * @param {boolean} props.panels        Whether the composer is laid out as panels.
 * @param {string}  props.title         The panel's title.
 * @param {boolean} [props.initialOpen]
 * @param {string}  [props.className]
 * @param {*}       props.children
 */
function Section( { panels, title, initialOpen = true, className, children } ) {
	if ( ! panels ) {
		return <div className={ className }>{ children }</div>;
	}
	return (
		<PanelBody title={ title } initialOpen={ initialOpen }>
			<div
				className={ `orbitwrite-composer__stack ${ className || '' }` }
			>
				{ children }
			</div>
		</PanelBody>
	);
}

/**
 * The composer once connected.
 *
 * @param {Object}      props
 * @param {string}      props.scope           Site, person and workspace.
 * @param {number}      props.postId
 * @param {Object|null} props.article
 * @param {Object}      props.status          From the status route.
 * @param {*}           props.noticeView      The notice to show, if any.
 * @param {Function}    props.setNotice
 * @param {Function}    props.reload          Re-read the connection.
 * @param {Object|null} props.articleState    `{ sent, numbers }`, when held above.
 * @param {string}      props.layout          `plain` or `panels`.
 * @param {Function}    props.notify          Says a send worked, or null.
 * @param {boolean}     props.showAutoShare
 * @param {boolean}     props.allowDisconnect
 */
function Editing( {
	scope,
	postId,
	article,
	status,
	noticeView,
	setNotice,
	reload,
	articleState,
	layout,
	notify,
	showAutoShare,
	allowDisconnect,
} ) {
	const panels = layout === 'panels';
	const onDisconnected = useCallback(
		( err ) => {
			setNotice( { type: 'warning', message: err.message } );
			reload();
		},
		[ setNotice, reload ]
	);
	const {
		channels,
		timezone,
		error: channelsError,
	} = useChannels( onDisconnected );
	// The article's posts: held above when the block editor passes them in,
	// read here otherwise (an id of 0 reads nothing).
	const ownSent = useShares( articleState ? 0 : postId );
	const ownNumbers = useShareNumbers(
		articleState ? 0 : postId,
		ownSent.shares
	);
	useWatchOnPublish(
		articleState ? undefined : article?.status,
		ownSent.watchPublishing
	);
	const sent = articleState?.sent || ownSent;
	const numbers = articleState?.numbers || ownNumbers;

	const [ draft, update, clearDraft ] = useStored(
		draftKey( scope, postId ),
		EMPTY_DRAFT,
		worthKeeping
	);
	const [ prefs, updatePrefs ] = useStored(
		prefsKey( scope ),
		DEFAULT_PREFS
	);
	const [ sending, setSending ] = useState( false );
	const [ error, setError ] = useState( null );

	// --- Following the article until the person edits ----------------------

	const articleDefaultText = article
		? articleText( article.title, article.link )
		: null;
	useEffect( () => {
		if (
			articleDefaultText !== null &&
			! draft.textTouched &&
			draft.text !== articleDefaultText
		) {
			update( { text: articleDefaultText } );
		}
	}, [ articleDefaultText, draft.textTouched, draft.text, update ] );

	const featured = article?.featured || null;
	useEffect( () => {
		if (
			article &&
			! draft.imageTouched &&
			( draft.image?.id !== featured?.id ||
				draft.image?.url !== featured?.url ||
				draft.image?.width !== featured?.width )
		) {
			update( { image: featured } );
		}
		// Watching the draft's image too: starting over clears it, and the
		// featured image has to come back even though it didn't change.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [
		featured?.id,
		featured?.url,
		featured?.width,
		draft.image?.id,
		draft.image?.url,
		draft.image?.width,
		draft.imageTouched,
	] );

	// --- Channels and content ----------------------------------------------

	const main = useMemo(
		() => ( { text: draft.text, image: draft.image } ),
		[ draft.text, draft.image ]
	);

	// The person's picks, or the workspace's defaults until they pick.
	const picked = useMemo( () => {
		if ( prefs.selected ) {
			return prefs.selected;
		}
		return ( channels || [] )
			.filter( ( channel ) => channel.defaultSelected )
			.map( ( channel ) => channel.id );
	}, [ prefs.selected, channels ] );

	const selectedChannels = useMemo(
		() =>
			( channels || [] ).filter(
				( channel ) =>
					picked.includes( channel.id ) && isPostable( channel )
			),
		[ channels, picked ]
	);
	const selectedIds = selectedChannels.map( ( channel ) => channel.id );

	const onSelect = ( id, checked ) =>
		updatePrefs( {
			selected: checked
				? [ ...picked.filter( ( other ) => other !== id ), id ]
				: picked.filter( ( other ) => other !== id ),
		} );

	const blocked = selectedChannels.some(
		( channel ) =>
			channelProblems(
				channel,
				contentFor( main, draft.versions, channel.id ),
				hasOwnVersion( draft.versions, channel.id )
			).length > 0
	);
	const mainUsers = selectedChannels.filter(
		( channel ) => ! hasOwnVersion( draft.versions, channel.id )
	);

	// --- When ---------------------------------------------------------------

	// "Now" is never remembered: a preference that publishes on the next
	// click, on whatever article is open, is too easy to trip over.
	const [ publishNow, setPublishNow ] = useState( false );
	const when = publishNow ? 'now' : prefs.when;
	const nextSlot = useNextSlot( when === 'next', selectedIds );
	// A picked time is the article's; until one is picked, offer tomorrow
	// morning without storing it.
	const at =
		draft.at || ( when === 'at' ? defaultScheduleTime( timezone ) : '' );
	const chooseWhen = ( next ) => {
		setPublishNow( next === 'now' );
		if ( next !== 'now' ) {
			updatePrefs( { when: next } );
		}
	};

	// --- Sending ------------------------------------------------------------

	const sendLabel = () => {
		if ( when === 'now' ) {
			return __( 'Publish now', 'orbitwrite' );
		}
		if ( when === 'next' ) {
			return nextSlot.at
				? sprintf(
						/* translators: %s: date and time. */
						__( 'Schedule for %s', 'orbitwrite' ),
						formatInstant( nextSlot.at, timezone )
				  )
				: __( 'Schedule for next free slot', 'orbitwrite' );
		}
		return at
			? sprintf(
					/* translators: %s: date and time. */
					__( 'Schedule for %s', 'orbitwrite' ),
					formatWallClock( at )
			  )
			: __( 'Schedule', 'orbitwrite' );
	};

	const canSend =
		! sending &&
		selectedIds.length > 0 &&
		! blocked &&
		( when !== 'at' || at !== '' ) &&
		( when !== 'next' || ! nextSlot.error );

	// After sending, start fresh, following the article again. The channels
	// and timing are preferences, so they stay; "Now" goes back to scheduling.
	const startOver = () => {
		clearDraft();
		setPublishNow( false );
	};

	const onSend = () => {
		setSending( true );
		setError( null );
		api.send( {
			postId,
			...sendPayload( selectedIds, main, draft.versions ),
			when,
			at: when === 'at' ? at : '',
		} )
			.then( ( answer ) => {
				const shares = answer.shares;
				const first = shares[ 0 ];
				const publishing = first.status === 'publishing';
				const what = publishing
					? __( 'Sent to Orbitwrite. Publishing now.', 'orbitwrite' )
					: sprintf(
							/* translators: %s: date and time. */
							__( 'Scheduled for %s.', 'orbitwrite' ),
							formatInstant( first.scheduledAt, timezone )
					  );
				const said = {
					type: 'success',
					message:
						shares.length > 1
							? `${ what } ${ sprintf(
									/* translators: %d: number of posts. */
									_n(
										'Orbitwrite has it as %d post.',
										'Orbitwrite has it as %d posts, one per version.',
										shares.length,
										'orbitwrite'
									),
									shares.length
							  ) }`
							: what,
					openUrl: first.openUrl,
				};
				if ( notify ) {
					notify( said );
				} else {
					setNotice( said );
				}
				sent.add( shares );
				if ( publishing ) {
					sent.watchPublishing();
				}
				startOver();
			} )
			.catch( ( err ) =>
				api.isNotConnected( err )
					? onDisconnected( err )
					: setError( err.message )
			)
			.finally( () => setSending( false ) );
	};

	const onDelete = ( share ) => {
		if (
			// eslint-disable-next-line no-alert
			! window.confirm(
				__(
					"Delete this post from Orbitwrite? It won't go out.",
					'orbitwrite'
				)
			)
		) {
			return;
		}
		api.discard( postId, share.groupId )
			.then( () => sent.remove( share.groupId ) )
			.catch( ( err ) => setError( err.message ) );
	};

	const onStartOver = () => {
		if (
			// eslint-disable-next-line no-alert
			window.confirm(
				article
					? __(
							'Throw away this draft and start again from the article?',
							'orbitwrite'
					  )
					: __( 'Throw away this draft?', 'orbitwrite' )
			)
		) {
			startOver();
		}
	};

	const onDisconnect = () => api.disconnect().then( reload );

	const autoShareOn =
		postId > 0 && autoSharePending( sent ) && sent.autoShare.enabled;

	// --- Render -------------------------------------------------------------

	const touched = worthKeeping( draft );

	return (
		<div className={ `orbitwrite-composer${ panels ? ' is-panels' : '' }` }>
			<div className="orbitwrite-composer__head">
				{ noticeView }
				<p className="orbitwrite-composer__workspace">
					{ sprintf(
						/* translators: %s: Orbitwrite workspace name. */
						__( 'Posting to %s', 'orbitwrite' ),
						status.organization?.name ||
							__( 'your workspace', 'orbitwrite' )
					) }
					{ allowDisconnect && (
						<>
							{ ' · ' }
							<Button variant="link" onClick={ onDisconnect }>
								{ __( 'Disconnect', 'orbitwrite' ) }
							</Button>
						</>
					) }
				</p>
				{ postId > 0 && showAutoShare && (
					<AutoShareToggle
						postId={ postId }
						sent={ sent }
						settingsUrl={ status.autoShareUrl }
						onError={ setError }
					/>
				) }
				{ postId > 0 && <AutoShareNotices sent={ sent } /> }
			</div>

			<Section
				panels={ panels }
				title={ __( 'Post', 'orbitwrite' ) }
				className="orbitwrite-composer__main"
			>
				<TextareaControl
					__nextHasNoMarginBottom
					label={ __( 'Main post', 'orbitwrite' ) }
					hideLabelFromVision={ panels }
					value={ draft.text }
					rows={ 6 }
					onChange={ ( text ) =>
						update( { text, textTouched: true } )
					}
					help={ mainPostHelp(
						selectedChannels,
						mainUsers,
						mainPostInUse( selectedIds, draft.versions )
					) }
				/>
				<ImageField
					image={ draft.image }
					onChange={ ( image ) =>
						update( { image, imageTouched: true } )
					}
				/>
			</Section>

			<Section
				panels={ panels }
				title={
					selectedIds.length
						? sprintf(
								/* translators: %d: number of channels picked. */
								__( 'Channels (%d)', 'orbitwrite' ),
								selectedIds.length
						  )
						: __( 'Channels', 'orbitwrite' )
				}
			>
				<fieldset className="orbitwrite-composer__channels">
					{ panels ? (
						<VisuallyHidden as="legend">
							{ __( 'Channels', 'orbitwrite' ) }
						</VisuallyHidden>
					) : (
						<legend className="orbitwrite-composer__label">
							{ __( 'Channels', 'orbitwrite' ) }
						</legend>
					) }
					{ channelsError && (
						<Notice status="error" isDismissible={ false }>
							{ channelsError }
						</Notice>
					) }
					{ ! channels && ! channelsError && <Spinner /> }
					{ channels && (
						<ChannelList
							channels={ channels }
							selected={ selectedIds }
							onSelect={ onSelect }
							main={ main }
							versions={ draft.versions }
							onVersions={ ( versions ) =>
								update( { versions } )
							}
							appUrl={ status.appUrl }
						/>
					) }
				</fieldset>
			</Section>

			<Section
				panels={ panels }
				title={ __( 'When', 'orbitwrite' ) }
				className="orbitwrite-composer__when"
			>
				<ToggleGroupControl
					__nextHasNoMarginBottom
					__next40pxDefaultSize
					isBlock
					label={ __( 'When', 'orbitwrite' ) }
					hideLabelFromVision={ panels }
					value={ when }
					onChange={ chooseWhen }
				>
					<ToggleGroupControlOption
						value="next"
						label={ __( 'Next slot', 'orbitwrite' ) }
					/>
					<ToggleGroupControlOption
						value="at"
						label={ __( 'Pick a time', 'orbitwrite' ) }
					/>
					<ToggleGroupControlOption
						value="now"
						label={ __( 'Now', 'orbitwrite' ) }
					/>
				</ToggleGroupControl>
				{ when === 'next' && nextSlot.loading && <Spinner /> }
				{ when === 'next' && nextSlot.error && (
					<Notice status="warning" isDismissible={ false }>
						{ nextSlot.error }
					</Notice>
				) }
				{ when === 'at' && (
					<Dropdown
						className="orbitwrite-composer__date"
						contentClassName="orbitwrite-date-popover"
						popoverProps={ { placement: 'bottom-start' } }
						renderToggle={ ( { isOpen, onToggle } ) => (
							<Button
								variant="secondary"
								onClick={ onToggle }
								aria-expanded={ isOpen }
							>
								{ at
									? formatWallClock( at )
									: __(
											'Pick a date and time',
											'orbitwrite'
									  ) }
							</Button>
						) }
						renderContent={ () => (
							<DateTimePicker
								currentDate={ at || null }
								onChange={ ( value ) =>
									update( {
										at: ( value || '' ).slice( 0, 16 ),
									} )
								}
							/>
						) }
					/>
				) }
				<p className="orbitwrite-composer__zone">
					{ sprintf(
						/* translators: %s: timezone name. */
						__(
							"Times are in your workspace's timezone, %s.",
							'orbitwrite'
						),
						timezone
					) }
				</p>
			</Section>

			<div className="orbitwrite-composer__foot">
				{ article && article.status !== 'publish' && ! autoShareOn && (
					<Notice status="warning" isDismissible={ false }>
						{ __(
							"This article isn't published yet, so its link won't work until it is. Schedule the social post for after it goes live.",
							'orbitwrite'
						) }
					</Notice>
				) }
				{ error && (
					<Notice status="error" onRemove={ () => setError( null ) }>
						{ error }
					</Notice>
				) }

				{ blocked && (
					<p className="orbitwrite-composer__blocked">
						{ __(
							'Fix what’s marked on the channels above to send.',
							'orbitwrite'
						) }
					</p>
				) }
				<Button
					variant="primary"
					className="orbitwrite-composer__send"
					disabled={ ! canSend }
					isBusy={ sending }
					onClick={ onSend }
				>
					{ sendLabel() }
				</Button>
				{ touched && (
					<Button
						variant="link"
						className="orbitwrite-composer__start-over"
						onClick={ onStartOver }
					>
						{ article
							? __( 'Start over from the article', 'orbitwrite' )
							: __( 'Start over', 'orbitwrite' ) }
					</Button>
				) }
			</div>

			{ postId > 0 && sent.shares.length > 0 && (
				<Section
					panels={ panels }
					title={ sprintf(
						/* translators: %d: number of posts sent. */
						__( 'Sent from this article (%d)', 'orbitwrite' ),
						sent.shares.length
					) }
				>
					<SentList
						shares={ sent.shares }
						numbers={ numbers }
						channels={ channels || [] }
						timezone={ timezone }
						onDelete={ onDelete }
						showLabel={ ! panels }
					/>
				</Section>
			) }
		</div>
	);
}

/**
 * The line under the main post saying who it's for.
 *
 * @param {Object[]} selectedChannels
 * @param {Object[]} mainUsers        Selected channels using the main post.
 * @param {boolean}  usesMain
 * @return {string|undefined} Help text.
 */
function mainPostHelp( selectedChannels, mainUsers, usesMain ) {
	if ( ! selectedChannels.length ) {
		return undefined;
	}
	if ( ! usesMain ) {
		return __(
			"Every channel has its own version, so the main post won't be sent.",
			'orbitwrite'
		);
	}
	if ( mainUsers.length === selectedChannels.length ) {
		return undefined;
	}
	return sprintf(
		/* translators: %s: comma-separated channel names. */
		__( 'Sent to %s.', 'orbitwrite' ),
		mainUsers.map( channelName ).join( ', ' )
	);
}
