/**
 * Whether a channel can take what it's about to be sent: its text against
 * the network's limit, and its image against the network's media rules.
 *
 * These are the composer's early warnings, shown on the channel as you type.
 * The server checks the same media rules again before sending
 * (includes/class-sender.php, includes/class-aspect.php), and Orbitwrite has
 * the last word. Pure.
 */
import { __, sprintf } from '@wordpress/i18n';

import { countFor, limitFor } from './text';
import type { AspectRange, Channel, Content, Versions } from './types';
import { contentFor, hasOwnVersion } from './versions';

/** Slack for rounding in stored dimensions, as in class-aspect.php. */
const ASPECT_TOLERANCE = 0.01;

/**
 * A network that needs media but takes no images only takes video, which
 * the plugin can't attach.
 *
 * @param channel
 * @return Whether.
 */
export function isVideoOnly( channel: Channel ): boolean {
	return !! channel.media?.required && ! channel.media?.images;
}

/**
 * Whether a channel can be picked at all.
 *
 * @param channel
 * @return Whether.
 */
export function isPostable( channel: Channel ): boolean {
	return ! channel.needsReconnect && ! isVideoOnly( channel );
}

/**
 * Why a channel can't be picked, or undefined.
 *
 * @param channel
 * @return Reason.
 */
export function unavailableReason( channel: Channel ): string | undefined {
	if ( channel.needsReconnect ) {
		return __(
			'Reconnect this channel in Orbitwrite to post to it.',
			'orbitwrite'
		);
	}
	if ( isVideoOnly( channel ) ) {
		return __(
			'Only takes video, which this plugin can’t attach yet.',
			'orbitwrite'
		);
	}
	return undefined;
}

/**
 * Where a channel stands against its network's text limit.
 *
 * @param channel
 * @param content
 * @return Count.
 */
export function measure(
	channel: Channel,
	content: Content
): { count: number; limit: number | null; over: boolean } {
	const limit = limitFor( channel, !! content.image );
	const count = countFor( content.text, channel );
	return { count, limit, over: !! limit && count > limit };
}

/**
 * A ratio as people write it: 0.8 → "4:5", 1.91 → "1.91:1".
 *
 * @param ratio Width ÷ height.
 * @return Label.
 */
export function aspectLabel( ratio: number ): string {
	for ( const height of [ 1, 2, 3, 4, 5, 9, 16 ] ) {
		const width = ratio * height;
		if (
			Math.abs( width - Math.round( width ) ) < 0.02 &&
			Math.round( width ) <= 21
		) {
			return `${ Math.round( width ) }:${ height }`;
		}
	}
	return `${ Number( ratio.toFixed( 2 ) ) }:1`;
}

/**
 * What's wrong with an image's shape, or null.
 *
 * @param width
 * @param height
 * @param range
 * @return Problem.
 */
export function aspectProblem(
	width: number,
	height: number,
	range: Partial< AspectRange > | null | undefined
): string | null {
	if ( ! range || ! width || ! height ) {
		return null;
	}
	const ratio = width / height;
	if ( range.min && ratio < range.min - ASPECT_TOLERANCE ) {
		return sprintf(
			/* translators: 1: narrowest accepted shape, 2: this image's shape. */
			__(
				'Images can be no narrower than %1$s, and this one is %2$s.',
				'orbitwrite'
			),
			aspectLabel( range.min ),
			aspectLabel( ratio )
		);
	}
	if ( range.max && ratio > range.max + ASPECT_TOLERANCE ) {
		return sprintf(
			/* translators: 1: widest accepted shape, 2: this image's shape. */
			__(
				'Images can be no wider than %1$s, and this one is %2$s.',
				'orbitwrite'
			),
			aspectLabel( range.max ),
			aspectLabel( ratio )
		);
	}
	return null;
}

/**
 * Things worth knowing that don't stop a send, as sentences.
 *
 * An image in a type the network doesn't take is one: WordPress may hold a
 * copy in another type (a site can write its generated sizes as JPEG), which
 * the server picks when sending. Only the server can see those copies, so it
 * decides, and says so if there isn't one.
 *
 * @param channel
 * @param content
 * @return Notes.
 */
export function channelNotes(
	channel: Channel,
	content: Pick< Content, 'image' >
): string[] {
	const types = channel.media?.imageTypes;
	if (
		content.image?.mime &&
		channel.media?.images !== false &&
		Array.isArray( types ) &&
		types.length > 0 &&
		! types.includes( content.image.mime )
	) {
		return [
			sprintf(
				/* translators: 1: this image's type, 2: accepted types. */
				__(
					'Takes %2$s images, not %1$s. A copy in one of those types is sent if WordPress has one.',
					'orbitwrite'
				),
				typeLabel( content.image.mime ),
				types.map( typeLabel ).join( ', ' )
			),
		];
	}
	return [];
}

/**
 * "image/jpeg" → "JPEG".
 *
 * @param type
 * @return Label.
 */
export function typeLabel( type: string ): string {
	return type.replace( /^image\//, '' ).toUpperCase();
}

/**
 * Everything stopping a picked channel from taking its content, as
 * sentences. Empty when it's ready.
 *
 * @param channel
 * @param content
 * @param ownVersion Whether the content is the channel's own.
 * @return Problems.
 */
export function channelProblems(
	channel: Channel,
	content: Content,
	ownVersion: boolean
): string[] {
	const problems: string[] = [];
	const media: Partial< Channel[ 'media' ] > = channel.media || {};

	if ( content.text.trim() === '' ) {
		problems.push(
			ownVersion
				? __( 'Write this channel’s text.', 'orbitwrite' )
				: __( 'Write the main post.', 'orbitwrite' )
		);
	}
	const { count, limit, over } = measure( channel, content );
	if ( over && limit ) {
		problems.push(
			sprintf(
				/* translators: %d: characters over the limit. */
				__( '%d characters over the limit.', 'orbitwrite' ),
				count - limit
			)
		);
	}
	if ( media.required && ! content.image ) {
		problems.push(
			ownVersion
				? __( 'Needs an image.', 'orbitwrite' )
				: __(
						'Needs an image. Add one to the main post, or give this channel its own version with one.',
						'orbitwrite'
				  )
		);
	}
	if ( content.image && media.images === false ) {
		problems.push(
			ownVersion
				? __( 'Doesn’t take images. Remove it.', 'orbitwrite' )
				: __(
						'Doesn’t take images. Give this channel its own version without one.',
						'orbitwrite'
				  )
		);
	}
	if ( content.image && media.images !== false ) {
		const shape = aspectProblem(
			content.image.width,
			content.image.height,
			media.aspectRatio
		);
		if ( shape ) {
			problems.push( shape );
		}
	}
	return problems;
}

/**
 * Whether any of these channels can't take what it would send.
 *
 * @param channels The picked channels.
 * @param main
 * @param versions
 * @return Whether.
 */
export function anyBlocked(
	channels: Channel[],
	main: Content,
	versions: Versions
): boolean {
	return channels.some(
		( channel ) =>
			channelProblems(
				channel,
				contentFor( main, versions, channel.id ),
				hasOwnVersion( versions, channel.id )
			).length > 0
	);
}
