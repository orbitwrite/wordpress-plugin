/**
 * Character counting for the per-channel counters.
 *
 * Orbitwrite checks lengths again before publishing; this is the composer's
 * early warning, so it errs towards the networks' own rules where they are
 * simple to state: X counts every link as 23 characters (t.co), and a
 * network whose unit is `graphemes` counts each emoji as one.
 */
import type { Channel } from './types';

const URL_PATTERN = /\bhttps?:\/\/\S+/gi;

/** X's fixed length for any link. */
export const X_LINK_LENGTH = 23;

/**
 * User-perceived characters, falling back to code points where
 * `Intl.Segmenter` is missing.
 *
 * @param text
 * @return Count.
 */
export function graphemeCount( text: string ): number {
	if ( typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function' ) {
		let count = 0;
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
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
 * @param text
 * @param channel
 * @return Count.
 */
export function countFor(
	text: string,
	channel: Pick< Channel, 'platform' | 'unit' >
): number {
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
 * @param channel
 * @param hasImage
 * @return Limit, or null when unknown.
 */
export function limitFor(
	channel: Pick< Channel, 'maxChars' | 'withMediaMaxChars' >,
	hasImage: boolean
): number | null {
	if ( hasImage && channel.withMediaMaxChars ) {
		return channel.withMediaMaxChars;
	}
	return channel.maxChars || null;
}

/**
 * The default text for an article: its title, a blank line, its link.
 *
 * @param title
 * @param link
 * @return Text.
 */
export function articleText(
	title: string | undefined,
	link: string | undefined
): string {
	return [ ( title || '' ).trim(), ( link || '' ).trim() ]
		.filter( Boolean )
		.join( '\n\n' );
}
