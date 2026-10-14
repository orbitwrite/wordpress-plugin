/**
 * A notice to show, with its "Open in Orbitwrite" link when it has one.
 */
import { Notice } from '@wordpress/components';

import type { Notice as NoticeData } from '../lib/types';
import { OpenInOrbitwrite } from './links';

export default function NoticeMessage( {
	notice,
	onRemove,
}: {
	notice: NoticeData;
	onRemove: () => void;
} ) {
	return (
		<Notice status={ notice.type } onRemove={ onRemove }>
			{ notice.message }
			{ notice.openUrl && (
				<>
					{ ' ' }
					<OpenInOrbitwrite href={ notice.openUrl } />
				</>
			) }
		</Notice>
	);
}
