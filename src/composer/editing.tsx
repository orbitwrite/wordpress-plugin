/**
 * The composer once connected: the draft, where it goes, when, and what
 * was already sent from the article.
 */
import { useCallback, useMemo, useState } from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';

import SentList from '../components/sent-list';
import { useArticleShares } from '../hooks/use-article-shares';
import type { ArticleShares } from '../hooks/use-article-shares';
import { useChannels } from '../hooks/use-channels';
import type { Connection } from '../hooks/use-connection';
import useStored from '../hooks/use-stored';
import * as api from '../lib/api';
import {
	DEFAULT_PREFS,
	EMPTY_DRAFT,
	draftKey,
	prefsKey,
	worthKeeping,
} from '../lib/draft';
import { channelProblems } from '../lib/rules';
import { autoSharePending } from '../lib/shares';
import type { Article, Notice, Share, Status } from '../lib/types';
import { contentFor, hasOwnVersion, sendPayload } from '../lib/versions';
import ChannelsSection from './channels-section';
import ComposerHead from './composer-head';
import MainPostSection from './main-post-section';
import { mainPostHelp, sendLabel, sentNotice } from './messages';
import Section from './section';
import SendFooter from './send-footer';
import { useChannelPicks } from './use-channel-picks';
import { useFollowArticle } from './use-follow-article';
import { useSchedule } from './use-schedule';
import WhenSection from './when-section';

/** What the composer is for, and how it's laid out. */
export interface ComposerProps {
	/** The article, when there is one. */
	postId?: number;
	/** `{ title, link, status, featured }`. */
	article?: Article | null;
	/** The article's posts, when the block editor holds them above. */
	articleState?: ArticleShares | null;
	layout?: 'plain' | 'panels';
	/** Says a send worked (a snackbar); a notice here otherwise. */
	notify?: ( ( notice: Notice ) => void ) | null;
	/** Offer the article's auto-share checkbox. */
	showAutoShare?: boolean;
	/** Offer Disconnect. */
	allowDisconnect?: boolean;
}

interface Props extends Required< ComposerProps > {
	/** Site, person and workspace. */
	scope: string;
	status: Status;
	connection: Connection;
}

/**
 * Ask before something that can't be undone.
 *
 * @param question
 * @return Whether the person said yes.
 */
// eslint-disable-next-line no-alert
const confirmed = ( question: string ) => window.confirm( question );

export default function Editing( {
	scope,
	status,
	connection,
	postId,
	article,
	articleState,
	layout,
	notify,
	showAutoShare,
	allowDisconnect,
}: Props ) {
	const panels = layout === 'panels';
	const { setNotice, reload } = connection;
	const [ sending, setSending ] = useState( false );
	const [ error, setError ] = useState< string | null >( null );

	const onDisconnected = useCallback(
		( err: unknown ) => {
			setNotice( { type: 'warning', message: api.messageOf( err ) } );
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
	const ownShares = useArticleShares(
		articleState ? 0 : postId,
		articleState ? undefined : article?.status
	);
	const { sent, numbers } = articleState || ownShares;

	const [ draft, update, clearDraft ] = useStored(
		draftKey( scope, postId ),
		EMPTY_DRAFT,
		worthKeeping
	);
	const [ prefs, updatePrefs ] = useStored(
		prefsKey( scope ),
		DEFAULT_PREFS
	);
	useFollowArticle( article, draft, update );

	// --- Channels and content ----------------------------------------------

	const main = useMemo(
		() => ( { text: draft.text, image: draft.image } ),
		[ draft.text, draft.image ]
	);
	const { selectedChannels, selectedIds, onSelect } = useChannelPicks(
		channels,
		prefs,
		updatePrefs
	);
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

	const schedule = useSchedule( {
		prefs,
		updatePrefs,
		pickedAt: draft.at,
		timezone,
		accountIds: selectedIds,
	} );
	const { when, at } = schedule;

	// --- Actions ------------------------------------------------------------

	// After sending, start fresh, following the article again. The channels
	// and timing are preferences, so they stay; "Now" goes back to scheduling.
	const startOver = () => {
		clearDraft();
		schedule.reset();
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
			.then( ( { shares } ) => {
				const said = sentNotice( shares, timezone );
				if ( notify ) {
					notify( said );
				} else {
					setNotice( said );
				}
				sent.add( shares );
				if ( shares[ 0 ].status === 'publishing' ) {
					sent.watchPublishing();
				}
				startOver();
			} )
			.catch( api.handleError( onDisconnected, setError ) )
			.finally( () => setSending( false ) );
	};

	const onDelete = ( share: Share ) => {
		if (
			! confirmed(
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
			.catch( ( err ) => setError( api.messageOf( err ) ) );
	};

	const onStartOver = () => {
		if (
			confirmed(
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
		postId > 0 && autoSharePending( sent ) && !! sent.autoShare?.enabled;
	const canSend =
		! sending && selectedIds.length > 0 && ! blocked && schedule.ready;

	// --- Render -------------------------------------------------------------

	return (
		<div className={ `orbitwrite-composer${ panels ? ' is-panels' : '' }` }>
			<ComposerHead
				status={ status }
				connection={ connection }
				postId={ postId }
				sent={ sent }
				showAutoShare={ showAutoShare }
				onDisconnect={ allowDisconnect ? onDisconnect : null }
				onError={ setError }
			/>

			<MainPostSection
				panels={ panels }
				draft={ draft }
				update={ update }
				help={ mainPostHelp( selectedChannels, mainUsers ) }
			/>

			<ChannelsSection
				panels={ panels }
				channels={ channels }
				error={ channelsError }
				selected={ selectedIds }
				onSelect={ onSelect }
				main={ main }
				versions={ draft.versions }
				onVersions={ ( versions ) => update( { versions } ) }
				appUrl={ status.appUrl }
			/>

			<WhenSection
				panels={ panels }
				schedule={ schedule }
				onPick={ ( picked ) => update( { at: picked } ) }
				timezone={ timezone }
			/>

			<SendFooter
				unpublished={
					!! article && article.status !== 'publish' && ! autoShareOn
				}
				hasArticle={ !! article }
				error={ error }
				onDismissError={ () => setError( null ) }
				blocked={ blocked }
				label={ sendLabel( when, schedule.nextSlot.at, at, timezone ) }
				canSend={ canSend }
				sending={ sending }
				onSend={ onSend }
				onStartOver={ worthKeeping( draft ) ? onStartOver : null }
			/>

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
