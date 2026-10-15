/**
 * What the composer shows until there's a connection: why, and the way to
 * connect.
 */
import { Button, Notice } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

import NoticeMessage from '../components/notice-message';
import type { Notice as NoticeData, Status } from '../lib/types';

interface Props {
	status: Status;
	notice: NoticeData | null;
	onDismissNotice: () => void;
	/** Padded, for the block editor sidebar. */
	padded: boolean;
}

export default function ConnectPrompt( {
	status,
	notice,
	onDismissNotice,
	padded,
}: Props ) {
	return (
		<div className={ `orbitwrite-composer${ padded ? ' is-padded' : '' }` }>
			{ notice && (
				<NoticeMessage notice={ notice } onRemove={ onDismissNotice } />
			) }
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
