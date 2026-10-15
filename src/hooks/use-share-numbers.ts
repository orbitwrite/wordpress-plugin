/**
 * How an article's published posts did.
 */
import { useEffect, useState } from '@wordpress/element';

import * as api from '../lib/api';
import type { Numbers, Share } from '../lib/types';

/**
 * How an article's published posts did, read once the list has any. Read
 * again only when another post finishes publishing.
 *
 * @param postId 0 to read nothing (no article, or not connected).
 * @param shares From useShares().
 * @return Numbers by Orbitwrite post id.
 */
export function useShareNumbers( postId: number, shares: Share[] ): Numbers {
	const [ numbers, setNumbers ] = useState< Numbers >( {} );
	const published = shares
		.filter( ( share ) => share.status === 'published' )
		.map( ( share ) => share.groupId )
		.join( ',' );

	useEffect( () => {
		if ( ! postId || ! published ) {
			return;
		}
		let cancelled = false;
		api.getShareNumbers( postId )
			.then( ( answer ) => ! cancelled && setNumbers( answer.numbers ) )
			.catch( () => {} );
		return () => {
			cancelled = true;
		};
	}, [ postId, published ] );

	return numbers;
}
