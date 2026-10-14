/**
 * Analytics numbers in words. Pure.
 *
 * A null number means no network reported it (Bluesky has no impressions),
 * which is not the same as none: it's left out, never shown as 0.
 */
import { __, _n, sprintf } from '@wordpress/i18n';

/**
 * A count with the reader's digit grouping: 1,204.
 *
 * @param {number} value
 * @return {string} Formatted.
 */
export function formatCount( value ) {
	return new Intl.NumberFormat( undefined, {
		maximumFractionDigits: 0,
	} ).format( value );
}

/**
 * A change against the period before: "+12%", "−3%", "No change". Null when
 * there's nothing to compare with.
 *
 * @param {number|null} percent
 * @return {string|null} Formatted.
 */
export function formatChange( percent ) {
	if ( percent === null || percent === undefined || ! isFinite( percent ) ) {
		return null;
	}
	const rounded = Math.round( percent );
	if ( rounded === 0 ) {
		return __( 'No change', 'orbitwrite' );
	}
	// A real minus sign, not a hyphen.
	return `${ rounded > 0 ? '+' : '−' }${ formatCount(
		Math.abs( rounded )
	) }%`;
}

// The post metrics the sent list shows, in order, each with its words.
const POST_METRICS = [
	[
		'impressions',
		( n ) =>
			/* translators: %s: number. */
			_n( '%s impression', '%s impressions', n, 'orbitwrite' ),
	],
	[
		'reactions',
		( n ) =>
			/* translators: %s: number. */
			_n( '%s reaction', '%s reactions', n, 'orbitwrite' ),
	],
	[
		'comments',
		( n ) =>
			/* translators: %s: number. */
			_n( '%s comment', '%s comments', n, 'orbitwrite' ),
	],
	[
		'reposts',
		( n ) =>
			/* translators: %s: number. */
			_n( '%s repost', '%s reposts', n, 'orbitwrite' ),
	],
	[
		'clicks',
		( n ) =>
			/* translators: %s: number. */
			_n( '%s link click', '%s link clicks', n, 'orbitwrite' ),
	],
];

/**
 * A post's numbers as phrases, leaving out what nothing reported.
 *
 * @param {Object|null|undefined} totals `{ impressions, reactions, … }`.
 * @return {string[]} e.g. `[ '1,204 impressions', '38 reactions' ]`.
 */
export function numberPhrases( totals ) {
	if ( ! totals ) {
		return [];
	}
	return POST_METRICS.filter(
		( [ key ] ) => typeof totals[ key ] === 'number'
	).map( ( [ key, words ] ) =>
		sprintf( words( totals[ key ] ), formatCount( totals[ key ] ) )
	);
}
