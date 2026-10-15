/**
 * Attachments as the composer holds them, from wherever WordPress hands
 * them over: the REST API, or the Media Library modal.
 */
import apiFetch from '@wordpress/api-fetch';

import type { Image } from './types';

/** An attachment as the REST API answers it, as far as it's read here. */
export interface RestMedia {
	id: number;
	source_url: string;
	alt_text?: string;
	mime_type?: string;
	media_details?: {
		width?: number;
		height?: number;
		sizes?: Record< string, { source_url: string } | undefined >;
	};
}

/** What the media modal hands back for a picked attachment. */
export interface PickedMedia {
	id: number;
	url: string;
	alt?: string;
	mime?: string;
	width?: number;
	height?: number;
	sizes?: Record< string, { url: string } | undefined >;
}

/**
 * An attachment from the REST API, at its medium size where there is one.
 *
 * @param media
 * @return Image, or null without a URL.
 */
export function imageFromRest(
	media: RestMedia | null | undefined
): Image | null {
	const url =
		media?.media_details?.sizes?.medium?.source_url || media?.source_url;
	if ( ! media?.id || ! url ) {
		return null;
	}
	return {
		id: media.id,
		url,
		alt: media.alt_text || '',
		mime: media.mime_type || '',
		width: media.media_details?.width || 0,
		height: media.media_details?.height || 0,
	};
}

/**
 * An attachment picked in the Media Library, at its medium size where there
 * is one.
 *
 * @param media
 * @return Image.
 */
export function imageFromPicked( media: PickedMedia ): Image {
	return {
		id: media.id,
		url: media.sizes?.medium?.url || media.url,
		alt: media.alt || '',
		mime: media.mime || '',
		width: media.width || 0,
		height: media.height || 0,
	};
}

/**
 * Read an attachment by id.
 *
 * @param id
 * @return Image, or null.
 */
export const fetchImage = ( id: number ) =>
	apiFetch< RestMedia >( { path: `/wp/v2/media/${ id }` } ).then(
		imageFromRest
	);
