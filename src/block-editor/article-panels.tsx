/**
 * What the block editor shows about an article's social posts outside the
 * sidebar: a panel in the Post tab, and the panel after publishing.
 */
import { Button, Notice, Spinner } from '@wordpress/components';
import { useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';

import AutoShareNotices from '../components/auto-share-notices';
import AutoShareToggle from '../components/auto-share-toggle';
import type { ArticleShares } from '../hooks/use-article-shares';
import type { Connection } from '../hooks/use-connection';
import { autoSharePending, isAutoSharing } from '../lib/shares';
import ShareSummary from './share-summary';

interface PanelProps extends ArticleShares {
	/** Opens the Share on Orbitwrite sidebar. */
	onOpen: () => void;
}

/**
 * The Post tab's Orbitwrite panel: auto-share for this article, what was
 * sent, and the way into the composer.
 *
 * @param props
 * @param props.connection From useConnection().
 * @param props.postId
 * @param props.sent
 * @param props.numbers
 * @param props.onOpen
 */
export function DocumentPanel( {
	connection,
	postId,
	sent,
	numbers,
	onOpen,
}: PanelProps & { connection: Connection; postId: number } ) {
	const [ error, setError ] = useState< string | null >( null );
	const status = connection.status;

	if ( ! status ) {
		return <Spinner />;
	}
	if ( ! status.connected ) {
		return (
			<div className="orbitwrite-panel">
				<p>
					{ __(
						'Connect Orbitwrite to share this article on your social channels.',
						'orbitwrite'
					) }
				</p>
				<Button variant="secondary" onClick={ onOpen }>
					{ __( 'Set up', 'orbitwrite' ) }
				</Button>
			</div>
		);
	}

	const quiet =
		sent.loaded &&
		! sent.shares.length &&
		! autoSharePending( sent ) &&
		! sent.autoShare?.state;

	return (
		<div className="orbitwrite-panel">
			<AutoShareToggle
				postId={ postId }
				sent={ sent }
				settingsUrl={ status.autoShareUrl }
				onError={ setError }
			/>
			<AutoShareNotices sent={ sent } />
			{ error && (
				<Notice status="error" onRemove={ () => setError( null ) }>
					{ error }
				</Notice>
			) }
			<ShareSummary sent={ sent } numbers={ numbers } />
			{ quiet && (
				<p className="orbitwrite-panel__muted">
					{ __( 'Not shared on social yet.', 'orbitwrite' ) }
				</p>
			) }
			<Button variant="secondary" size="compact" onClick={ onOpen }>
				{ sent.shares.length
					? __( 'Open Share on Orbitwrite', 'orbitwrite' )
					: __( 'Write a social post', 'orbitwrite' ) }
			</Button>
		</div>
	);
}

/**
 * After publishing: what auto-share is doing, what's on its way, or the
 * offer to write a social post now.
 *
 * @param props
 * @param props.sent
 * @param props.numbers
 * @param props.onOpen
 */
export function AfterPublishPanel( { sent, numbers, onOpen }: PanelProps ) {
	if ( sent.shares.length ) {
		return (
			<div className="orbitwrite-panel">
				<ShareSummary sent={ sent } numbers={ numbers } />
			</div>
		);
	}
	if ( isAutoSharing( sent.autoShare ) ) {
		return (
			<div className="orbitwrite-panel">
				<AutoShareNotices sent={ sent } />
				<Spinner />
			</div>
		);
	}
	return (
		<div className="orbitwrite-panel">
			<AutoShareNotices sent={ sent } />
			<p>
				{ __(
					'Share it with your followers on your social channels.',
					'orbitwrite'
				) }
			</p>
			<Button variant="primary" onClick={ onOpen }>
				{ __( 'Write a social post', 'orbitwrite' ) }
			</Button>
		</div>
	);
}
