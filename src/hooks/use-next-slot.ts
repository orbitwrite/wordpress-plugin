/**
 * The soonest free slot in Orbitwrite's posting schedule.
 */
import { useEffect, useState } from '@wordpress/element';

import * as api from '../lib/api';

export interface NextSlot {
	loading?: boolean;
	at?: string;
	error?: string;
}

/** How long to wait for the picks to settle before asking. */
const DEBOUNCE_MS = 300;

/**
 * The soonest free slot for the picked channels, while "Next free slot" is
 * the choice. Debounced, since ticking several channels is several changes.
 *
 * @param active
 * @param accountIds
 * @return `{ loading, at, error }`.
 */
export function useNextSlot( active: boolean, accountIds: string[] ): NextSlot {
	const [ slot, setSlot ] = useState< NextSlot >( { loading: false } );
	const key = accountIds.join( ',' );

	useEffect( () => {
		if ( ! active || ! accountIds.length ) {
			setSlot( { loading: false } );
			return;
		}
		let cancelled = false;
		setSlot( { loading: true } );
		const timer = setTimeout( () => {
			api.getNextSlot( accountIds )
				.then(
					( answer ) => ! cancelled && setSlot( { at: answer.at } )
				)
				.catch(
					( err ) =>
						! cancelled &&
						setSlot( { error: api.messageOf( err ) } )
				);
		}, DEBOUNCE_MS );
		return () => {
			cancelled = true;
			clearTimeout( timer );
		};
	}, [ active, key ] ); // eslint-disable-line react-hooks/exhaustive-deps

	return slot;
}
