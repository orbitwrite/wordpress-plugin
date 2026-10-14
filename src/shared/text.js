/**
 * Character counting for the per-channel counters.
 *
 * Orbitwrite checks lengths again before publishing; this is the composer's
 * early warning, so it errs towards the networks' own rules where they are
 * simple to state: X counts every link as 23 characters (t.co), and a
 * network whose unit is `graphemes` counts each emoji as one.
 */

const URL_PATTERN = /\bhttps?:\/\/\S+/gi;

/** X's fixed length for any link. */
export const X_LINK_LENGTH = 23;

/**
 * User-perceived characters, falling back to code points where
 * `Intl.Segmenter` is missing.
 *
 * @param {string} text
 * @return {number} Count.
 */
export function graphemeCount( text ) {
	if ( typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function' ) {
		let count = 0;
		// eslint-disable-next-line no-unused-vars
		for ( const _ of new Intl.Segmenter( undefined, {
			granularity: 'grapheme',
		} ).segment( text ) ) {
			count++;
		}
		return count;
	}
	return [ ...text ].length;
}

/**
 * The length of `text` as a channel's network counts it.
 *
 * @param {string}                            text
 * @param {{platform: string, unit?: string}} channel
 * @return {number} Count.
 */
export function countFor( text, channel ) {
	let body = text;
	let links = 0;
	if ( channel.platform === 'twitter' ) {
		body = body.replace( URL_PATTERN, () => {
			links += X_LINK_LENGTH;
			return '';
		} );
	}
	const counted =
		channel.unit === 'graphemes'
			? graphemeCount( body )
			: [ ...body ].length;
	return links + counted;
}

/**
 * The limit that applies to a channel, which some networks tighten when the
 * post carries media (Telegram captions).
 *
 * @param {{maxChars?: number|null, withMediaMaxChars?: number|null}} channel
 * @param {boolean}                                                   hasImage
 * @return {number|null} Limit, or null when unknown.
 */
export function limitFor( channel, hasImage ) {
	if ( hasImage && channel.withMediaMaxChars ) {
		return channel.withMediaMaxChars;
	}
	return channel.maxChars || null;
}

/**
 * The default text for an article: its title, a blank line, its link.
 *
 * @param {string} title
 * @param {string} link
 * @return {string} Text.
 */
export function articleText( title, link ) {
	return [ ( title || '' ).trim(), ( link || '' ).trim() ]
		.filter( Boolean )
		.join( '\n\n' );
}
