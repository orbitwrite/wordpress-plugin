/**
 * One total, with its change against the period before.
 */
import { VisuallyHidden } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

import { formatChange, formatCount } from '../lib/numbers';

type Direction = 'up' | 'down' | 'flat';

const ARROWS: Record< Direction, string > = {
	up: '↑ ',
	down: '↓ ',
	flat: '',
};

/**
 * Which way a change went, for its colour.
 *
 * @param percent
 * @return `up`, `down` or `flat`.
 */
function direction( percent: number | null | undefined ): Direction {
	const rounded = Math.round( percent || 0 );
	if ( rounded > 0 ) {
		return 'up';
	}
	return rounded < 0 ? 'down' : 'flat';
}

interface Props {
	label: string;
	value: number | null | undefined;
	percent?: number | null;
	note?: string | null;
}

export default function Tile( { label, value, percent, note }: Props ) {
	const change = formatChange( percent );
	const way = direction( percent );
	return (
		<div className="orbitwrite-summary__tile">
			<span className="orbitwrite-summary__tile-label">{ label }</span>
			<span className="orbitwrite-summary__tile-value">
				{ typeof value === 'number' ? formatCount( value ) : '—' }
			</span>
			{ change && (
				<span className={ `orbitwrite-summary__change is-${ way }` }>
					{ /* Colour alone doesn't say which way it went. */ }
					<span aria-hidden="true">{ ARROWS[ way ] }</span>
					{ change }
					<VisuallyHidden>
						{ ' ' }
						{ __( 'against the 4 weeks before', 'orbitwrite' ) }
					</VisuallyHidden>
				</span>
			) }
			{ note && (
				<span className="orbitwrite-summary__note">{ note }</span>
			) }
		</div>
	);
}
