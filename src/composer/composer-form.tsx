/**
 * The composer once connected: the draft, where it goes, when, and what
 * was already sent from the article.
 */
import { useCallback } from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';

import SentList from '../components/sent-list';
import { useArticleShares } from '../hooks/use-article-shares';
import { useChannels } from '../hooks/use-channels';
import type { Connection } from '../hooks/use-connection';
import * as api from '../lib/api';
import { worthKeeping } from '../lib/draft';
import { anyBlocked } from '../lib/rules';
import { autoSharePending } from '../lib/shares';
import type { Share, Status } from '../lib/types';
import { onMainPost, sendPayload } from '../lib/versions';
import ChannelsSection from './channels-section';
import ComposerHead from './composer-head';
import { confirmed } from './confirm';
import MainPostSection from './main-post-section';
import { mainPostHelp, sendLabel, sentNotice } from './messages';
import Section from './section';
import SendFooter from './send-footer';
import type { ComposerProps } from './types';
import { useChannelPicks } from './use-channel-picks';
import { useComposerDraft } from './use-composer-draft';
import { useSchedule } from './use-schedule';
import { useSend } from './use-send';
import WhenSection from './when-section';

interface Props extends Required< ComposerProps > {
	/** Site, person and workspace. */
	scope: string;
	status: Status;
	connection: Connection;
}

export default function ComposerForm( {
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
	const { notice, setNotice, reload } = connection;

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

	const { draft, update, clear, main, prefs, updatePrefs } = useComposerDraft(
		scope,
		postId,
		article
	);
	const { selectedChannels, selectedIds, onSelect } = useChannelPicks(
		channels,
		prefs,
		updatePrefs
	);
	const schedule = useSchedule( {
		prefs,
		updatePrefs,
		pickedAt: draft.at,
		timezone,
		accountIds: selectedIds,
	} );

	// After sending, start fresh, following the article again. The channels
	// and timing are preferences, so they stay; "Now" goes back to scheduling.
	const startOver = () => {
		clear();
		schedule.reset();
	};

	const { sending, error, setError, clearError, send, discard } = useSend( {
		postId,
		sent,
		onDisconnected,
		onSent: ( shares ) => {
			const said = sentNotice( shares, timezone );
			if ( notify ) {
				notify( said );
			} else {
				setNotice( said );
			}
			startOver();
		},
	} );

	const onSend = () =>
		send( {
			...sendPayload( selectedIds, main, draft.versions ),
			when: schedule.when,
			at: schedule.when === 'at' ? schedule.at : '',
		} );

	const onDelete = ( share: Share ) => {
		if (
			confirmed(
				__(
					"Delete this post from Orbitwrite? It won't go out.",
					'orbitwrite'
				)
			)
		) {
			discard( share );
		}
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

	const blocked = anyBlocked( selectedChannels, main, draft.versions );
	const canSend =
		! sending && selectedIds.length > 0 && ! blocked && schedule.ready;
	const autoShareOn =
		postId > 0 && autoSharePending( sent ) && !! sent.autoShare?.enabled;

	return (
		<div className={ `orbitwrite-composer${ panels ? ' is-panels' : '' }` }>
			<ComposerHead
				status={ status }
				notice={ notice }
				onDismissNotice={ () => setNotice( null ) }
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
				help={ mainPostHelp(
					selectedChannels,
					onMainPost( selectedChannels, draft.versions )
				) }
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
				onDismissError={ clearError }
				blocked={ blocked }
				label={ sendLabel(
					schedule.when,
					schedule.nextSlot.at,
					schedule.at,
					timezone
				) }
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
