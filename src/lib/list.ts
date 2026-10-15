/**
 * Small list helpers. Pure.
 */

/**
 * A list with a value ticked (moved to the end) or unticked.
 *
 * @param list
 * @param value
 * @param on
 * @return List.
 */
export function toggle< T >( list: T[], value: T, on: boolean ): T[] {
	const rest = list.filter( ( item ) => item !== value );
	return on ? [ ...rest, value ] : rest;
}
