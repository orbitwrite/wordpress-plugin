/**
 * A post's state as a coloured pill.
 */
import { isFailed, statusLabel } from '../lib/shares';
import type { Share } from '../lib/types';

export default function StatusPill( { share }: { share: Share } ) {
	return (
		<span
			className={ `orbitwrite-pill is-${
				isFailed( share ) ? 'failed' : share.status
			}` }
		>
			{ statusLabel( share ) }
		</span>
	);
}
