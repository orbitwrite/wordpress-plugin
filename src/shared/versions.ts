/**
 * The composer's content model: one main post, and per channel either "same
 * as main post" or that channel's own version.
 *
 * `versions` maps a channel id to `{ text, image, synced }`. A channel with no
 * entry uses the main post. Unticking "Same as main post" for the first time
 * copies the main post into the channel's version; ticking it again sets
 * `synced` back but keeps the text, so unticking once more restores what was
 * written rather than throwing it away.
 *
 * Pure, so the rules are tested without rendering anything.
 */
import type { SendRequest } from './api';
import type { Content, Versions } from './types';

/**
 * Whether a channel uses its own version.
 *
 * @param versions
 * @param id
 * @return Whether.
 */
export function hasOwnVersion( versions: Versions, id: string ): boolean {
	return !! versions[ id ] && ! versions[ id ].synced;
}

/**
 * What a channel will send: its own version, or the main post.
 *
 * @param main
 * @param versions
 * @param id
 * @return Content.
 */
export function contentFor(
	main: Content,
	versions: Versions,
	id: string
): Content {
	return hasOwnVersion( versions, id ) ? versions[ id ] : main;
}

/**
 * Give a channel its own version, starting from the main post the first time.
 *
 * @param versions
 * @param id
 * @param main
 * @return Versions.
 */
export function giveOwnVersion(
	versions: Versions,
	id: string,
	main: Content
): Versions {
	const existing = versions[ id ];
	return {
		...versions,
		[ id ]: existing
			? { ...existing, synced: false }
			: { text: main.text, image: main.image, synced: false },
	};
}

/**
 * Put a channel back on the main post, keeping what was written for it.
 *
 * @param versions
 * @param id
 * @return Versions.
 */
export function backToMainPost( versions: Versions, id: string ): Versions {
	return versions[ id ]
		? { ...versions, [ id ]: { ...versions[ id ], synced: true } }
		: versions;
}

/**
 * Change a channel's own version.
 *
 * @param versions
 * @param id
 * @param changes
 * @return Versions.
 */
export function editVersion(
	versions: Versions,
	id: string,
	changes: Partial< Content >
): Versions {
	return { ...versions, [ id ]: { ...versions[ id ], ...changes } };
}

/**
 * Start a channel's own version again from the main post.
 *
 * @param versions
 * @param id
 * @param main
 * @return Versions.
 */
export function copyMainPost(
	versions: Versions,
	id: string,
	main: Content
): Versions {
	return editVersion( versions, id, { text: main.text, image: main.image } );
}

/**
 * Whether any of these channels sends the main post.
 *
 * @param selected
 * @param versions
 * @return Whether.
 */
export function mainPostInUse(
	selected: string[],
	versions: Versions
): boolean {
	return selected.some( ( id ) => ! hasOwnVersion( versions, id ) );
}

/**
 * The `send` request's content fields.
 *
 * @param selected Channel ids, in the order shown.
 * @param main
 * @param versions
 * @return `{ text, attachmentId, altText, channels }`.
 */
export function sendPayload(
	selected: string[],
	main: Content,
	versions: Versions
): Pick< SendRequest, 'text' | 'attachmentId' | 'altText' | 'channels' > {
	return {
		text: main.text,
		attachmentId: main.image?.id || 0,
		altText: main.image?.alt || '',
		channels: selected.map( ( id ) => {
			if ( ! hasOwnVersion( versions, id ) ) {
				return { accountId: id, synced: true };
			}
			const own = versions[ id ];
			return {
				accountId: id,
				synced: false,
				text: own.text,
				attachmentId: own.image?.id || 0,
				altText: own.image?.alt || '',
			};
		} ),
	};
}
