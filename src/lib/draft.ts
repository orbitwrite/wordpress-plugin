/**
 * What the composer keeps in the browser. Pure; stored by useStored().
 *
 * - **The unsent draft**, per article: the text, the image, the per-channel
 *   versions and a picked time. The block editor unmounts a sidebar when
 *   it's closed, which would otherwise throw all of that away. Stored only
 *   once there's something worth keeping (an edit), and removed once sent.
 * - **Preferences**, per person: the channels last picked and how to time
 *   posts, so the next article starts where the last one left off.
 *
 * Keys carry a scope from the server (site and user), because a browser's
 * storage is shared by every site on a domain (subdirectory multisite) and
 * every WordPress user on the machine.
 */
import type { Image, Versions, When } from './types';

/** An unsent post. */
export interface Draft {
	text: string;
	textTouched: boolean;
	image: Image | null;
	imageTouched: boolean;
	versions: Versions;
	/** A picked wall-clock time, `YYYY-MM-DDTHH:MM`, or ''. */
	at: string;
}

/** How a person last posted. */
export interface Prefs {
	selected: string[] | null;
	/** "Now" is never remembered. */
	when: Exclude< When, 'now' >;
}

export const EMPTY_DRAFT: Readonly< Draft > = Object.freeze( {
	text: '',
	textTouched: false,
	image: null,
	imageTouched: false,
	versions: {},
	at: '',
} );

export const DEFAULT_PREFS: Readonly< Prefs > = Object.freeze( {
	// Null until the person picks: the workspace's default channels apply.
	selected: null,
	when: 'next',
} );

/**
 * The storage key for an article's draft (or the admin page's).
 *
 * @param scope  From the status route: site and user.
 * @param postId 0 for the admin page.
 * @return Key.
 */
export function draftKey( scope: string, postId: number ): string {
	return `orbitwrite:draft:v2:${ scope }:${ postId || 'page' }`;
}

/**
 * The storage key for a person's preferences.
 *
 * @param scope
 * @return Key.
 */
export function prefsKey( scope: string ): string {
	return `orbitwrite:prefs:v1:${ scope }`;
}

/**
 * Whether a draft holds anything the person did, as opposed to what the
 * article supplied.
 *
 * @param draft
 * @return Whether.
 */
export function worthKeeping( draft: Draft ): boolean {
	return (
		draft.textTouched ||
		draft.imageTouched ||
		Object.keys( draft.versions ).length > 0 ||
		draft.at !== ''
	);
}
