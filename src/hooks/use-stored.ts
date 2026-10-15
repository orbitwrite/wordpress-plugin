/**
 * A value kept in localStorage.
 *
 * Per-viewer convenience only: storage can be unavailable (private windows,
 * blocked site data), so every read and write is allowed to fail and the
 * caller works the same without it.
 */
import { useCallback, useEffect, useState } from '@wordpress/element';

type Changes< T > = Partial< T > | ( ( current: T ) => Partial< T > );

/** Changes a stored value: fields to merge, or a function of the value. */
export type Update< T > = ( changes: Changes< T > ) => void;

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
 * @param keep  Whether a value is worth storing; else removed. Keep it
 *              stable (a module-level function), as it's an effect dependency.
 * @return The value, `update( changes )` (an object, or a function of the
 *   value), and `clear()`.
 */
export function useStored< T extends object >(
	key: string,
	empty: T,
	keep: ( value: T ) => boolean = always
): [ T, Update< T >, () => void ] {
	const [ value, setValue ] = useState( () => load( key, empty ) );

	useEffect( () => {
		save( key, value, keep );
	}, [ key, value, keep ] );

	const update = useCallback(
		( changes: Changes< T > ) =>
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
