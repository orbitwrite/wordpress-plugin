/**
 * What the composer keeps in the browser.
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
 *
 * Per-viewer convenience only: storage can be unavailable (private windows,
 * blocked site data), so every read and write is allowed to fail and the
 * composer works the same without it.
 */
import { useCallback, useEffect, useState } from '@wordpress/element';

import type { Image, Versions } from './types';

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
	when: 'next' | 'at';
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

function load< T extends object >( key: string, empty: T ): T {
	try {
		const stored: unknown = JSON.parse(
			window.localStorage.getItem( key ) ?? 'null'
		);
		return stored && typeof stored === 'object'
			? { ...empty, ...stored }
			: empty;
	} catch ( e ) {
		return empty;
	}
}

function save< T >( key: string, value: T, keep: ( value: T ) => boolean ) {
	try {
		if ( keep( value ) ) {
			window.localStorage.setItem( key, JSON.stringify( value ) );
		} else {
			window.localStorage.removeItem( key );
		}
	} catch ( e ) {
		// Storage unavailable: it just won't outlive the page.
	}
}

const always = () => true;

/**
 * A value kept in localStorage under a fixed key.
 *
 * @param key
 * @param empty Its starting value.
 * @param keep  Whether a value is worth storing; else removed.
 * @return The value, `update( changes )` (an object, or a function of the
 *   value), and `clear()`.
 */
export default function useStored< T extends object >(
	key: string,
	empty: T,
	keep: ( value: T ) => boolean = always
): [
	T,
	( changes: Partial< T > | ( ( current: T ) => Partial< T > ) ) => void,
	() => void,
] {
	const [ value, setValue ] = useState( () => load( key, empty ) );

	useEffect( () => {
		save( key, value, keep );
	}, [ key, value ] ); // eslint-disable-line react-hooks/exhaustive-deps

	const update = useCallback(
		( changes: Partial< T > | ( ( current: T ) => Partial< T > ) ) =>
			setValue( ( current ) => ( {
				...current,
				...( typeof changes === 'function'
					? changes( current )
					: changes ),
			} ) ),
		[]
	);
	const clear = useCallback( () => setValue( empty ), [ empty ] );

	return [ value, update, clear ];
}
