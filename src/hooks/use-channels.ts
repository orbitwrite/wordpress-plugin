/**
 * The workspace's channels.
 */
import { useEffect, useState } from '@wordpress/element';

import * as api from '../lib/api';
import type { Channel } from '../lib/types';

/**
 * The workspace's channels and timezone. Only used while connected.
 *
 * @param onDisconnected Called with the error when the connection turns out
 *                       to be gone.
 * @return `{ channels, timezone, error }`.
 */
export function useChannels( onDisconnected: ( error: unknown ) => void ): {
	channels: Channel[] | null;
	timezone: string;
	error: string | null;
} {
	const [ channels, setChannels ] = useState< Channel[] | null >( null );
	const [ timezone, setTimezone ] = useState( 'UTC' );
	const [ error, setError ] = useState< string | null >( null );

	useEffect( () => {
		setError( null );
		api.getChannels()
			.then( ( answer ) => {
				setChannels( answer.channels );
				setTimezone( answer.timezone || 'UTC' );
			} )
			.catch( api.handleError( onDisconnected, setError ) );
	}, [ onDisconnected ] );

	return { channels, timezone, error };
}
