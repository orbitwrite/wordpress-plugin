/**
 * The top of the composer once connected: any notice, the workspace it
 * posts to, and the article's auto-share.
 */
import { Button } from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';

import AutoShareNotices from '../components/auto-share-notices';
import AutoShareToggle from '../components/auto-share-toggle';
import NoticeMessage from '../components/notice-message';
import type { Connection } from '../hooks/use-connection';
import type { Sent } from '../hooks/use-shares';
import type { Status } from '../lib/types';

interface Props {
	status: Status;
	connection: Connection;
	postId: number;
	sent: Sent;
	showAutoShare: boolean;
	/** Offer Disconnect. */
	onDisconnect: ( () => void ) | null;
	onError: ( message: string ) => void;
}

export default function ComposerHead( {
	status,
	connection,
	postId,
	sent,
	showAutoShare,
	onDisconnect,
	onError,
}: Props ) {
	const { notice, setNotice } = connection;
	return (
		<div className="orbitwrite-composer__head">
			{ notice && (
				<NoticeMessage
					notice={ notice }
					onRemove={ () => setNotice( null ) }
				/>
			) }
			<p className="orbitwrite-composer__workspace">
				{ sprintf(
					/* translators: %s: Orbitwrite workspace name. */
					__( 'Posting to %s', 'orbitwrite' ),
					status.organization?.name ||
						__( 'your workspace', 'orbitwrite' )
				) }
				{ onDisconnect && (
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
					onError={ onError }
				/>
			) }
			{ postId > 0 && <AutoShareNotices sent={ sent } /> }
		</div>
	);
}
