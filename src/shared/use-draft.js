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

export const EMPTY_DRAFT = Object.freeze( {
	text: '',
	textTouched: false,
	image: null,
	imageTouched: false,
	versions: {},
	at: '',
} );

export const DEFAULT_PREFS = Object.freeze( {
	// Null until the person picks: the workspace's default channels apply.
	selected: null,
	when: 'next',
} );

/**
 * The storage key for an article's draft (or the admin page's).
 *
 * @param {string} scope  From the status route: site and user.
 * @param {number} postId 0 for the admin page.
 * @return {string} Key.
 */
export function draftKey( scope, postId ) {
	return `orbitwrite:draft:v2:${ scope }:${ postId || 'page' }`;
}

/**
 * The storage key for a person's preferences.
 *
 * @param {string} scope
 * @return {string} Key.
 */
export function prefsKey( scope ) {
	return `orbitwrite:prefs:v1:${ scope }`;
}

/**
 * Whether a draft holds anything the person did, as opposed to what the
 * article supplied.
 *
 * @param {Object} draft
 * @return {boolean} Whether.
 */
export function worthKeeping( draft ) {
	return (
		draft.textTouched ||
		draft.imageTouched ||
		Object.keys( draft.versions ).length > 0 ||
		draft.at !== ''
	);
}

function load( key, empty ) {
	try {
		const stored = JSON.parse( window.localStorage.getItem( key ) );
		return stored && typeof stored === 'object'
			? { ...empty, ...stored }
			: empty;
	} catch ( e ) {
		return empty;
	}
}

function save( key, value, keep ) {
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
 * @param {string}   key
 * @param {Object}   empty Its starting value.
 * @param {Function} keep  Whether a value is worth storing; else removed.
 * @return {[Object, Function, Function]} The value, `update( changes )` (an
 *   object, or a function of the value), and `clear()`.
 */
export default function useStored( key, empty, keep = always ) {
	const [ value, setValue ] = useState( () => load( key, empty ) );

	useEffect( () => {
		save( key, value, keep );
	}, [ key, value ] ); // eslint-disable-line react-hooks/exhaustive-deps

	const update = useCallback(
		( changes ) =>
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
