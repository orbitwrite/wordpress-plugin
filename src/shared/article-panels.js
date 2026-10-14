/**
 * What the block editor shows about an article's social posts outside the
 * sidebar: a panel in the Post tab, and the panel after publishing.
 */
import { Button, ExternalLink, Notice, Spinner } from '@wordpress/components';
import { useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';

import AutoShareToggle, {
	AutoShareNotices,
	autoSharePending,
} from './auto-share-toggle';
import { numbersLine, statusLabel } from './sent-list';
import { formatInstant } from './time';

/**
 * The article's posts, one line each, with their numbers once published.
 *
 * @param {Object} props
 * @param {Object} props.sent    From useShares().
 * @param {Object} props.numbers From useShareNumbers().
 */
export function ShareSummary( { sent, numbers } ) {
	if ( ! sent.shares.length ) {
		return null;
	}
	return (
		<ul className="orbitwrite-share-summary">
			{ sent.shares.map( ( share ) => {
				const line =
					share.status === 'published'
						? numbersLine( numbers[ share.groupId ] )
						: null;
				return (
					<li key={ share.groupId }>
						<span
							className={ `orbitwrite-pill is-${
								share.lastError && share.status !== 'published'
									? 'failed'
									: share.status
							}` }
						>
							{ statusLabel( share ) }
						</span>
						{ share.scheduledAt &&
							share.status !== 'published' &&
							` ${ formatInstant(
								share.scheduledAt,
								sent.timezone || 'UTC'
							) }` }
						{ line && (
							<span className="orbitwrite-share-summary__numbers">
								{ line }
							</span>
						) }
						{ share.openUrl && (
							<ExternalLink href={ share.openUrl }>
								{ __( 'Open in Orbitwrite', 'orbitwrite' ) }
							</ExternalLink>
						) }
					</li>
				);
			} ) }
		</ul>
	);
}

/**
 * The Post tab's Orbitwrite panel: auto-share for this article, what was
 * sent, and the way into the composer.
 *
 * @param {Object}   props
 * @param {Object}   props.connection From useConnection().
 * @param {number}   props.postId
 * @param {Object}   props.sent       From useShares().
 * @param {Object}   props.numbers    From useShareNumbers().
 * @param {Function} props.onOpen     Opens the Share on Orbitwrite sidebar.
 */
export function DocumentPanel( { connection, postId, sent, numbers, onOpen } ) {
	const [ error, setError ] = useState( null );
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
 * @param {Object}   props
 * @param {Object}   props.sent    From useShares().
 * @param {Object}   props.numbers From useShareNumbers().
 * @param {Function} props.onOpen  Opens the Share on Orbitwrite sidebar.
 */
export function AfterPublishPanel( { sent, numbers, onOpen } ) {
	if ( sent.shares.length ) {
		return (
			<div className="orbitwrite-panel">
				<ShareSummary sent={ sent } numbers={ numbers } />
			</div>
		);
	}
	if ( [ 'queued', 'sending' ].includes( sent.autoShare?.state ) ) {
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
