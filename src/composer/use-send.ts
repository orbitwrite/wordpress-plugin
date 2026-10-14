/**
 * Sending to Orbitwrite, and taking a post back.
 */
import { useState } from '@wordpress/element';

import type { Sent } from '../hooks/use-shares';
import * as api from '../lib/api';
import type { SendRequest } from '../lib/api';
import type { Share } from '../lib/types';

interface Options {
	postId: number;
	/** The article's posts, from useShares(). */
	sent: Sent;
	/** Called when the connection turns out to be gone. */
	onDisconnected: ( error: unknown ) => void;
	/** Called with what Orbitwrite made of a send. */
	onSent: ( shares: Share[] ) => void;
}

/**
 * Send and discard, keeping the article's list of posts in step.
 *
 * @param options
 * @param options.postId
 * @param options.sent
 * @param options.onDisconnected
 * @param options.onSent
 * @return `{ sending, error, clearError, setError, send, discard }`.
 */
export function useSend( { postId, sent, onDisconnected, onSent }: Options ) {
	const [ sending, setSending ] = useState( false );
	const [ error, setError ] = useState< string | null >( null );

	const send = ( request: Omit< SendRequest, 'postId' > ) => {
		setSending( true );
		setError( null );
		api.send( { postId, ...request } )
			.then( ( { shares } ) => {
				sent.add( shares );
				if ( shares[ 0 ].status === 'publishing' ) {
					sent.watchPublishing();
				}
				onSent( shares );
			} )
			.catch( api.handleError( onDisconnected, setError ) )
			.finally( () => setSending( false ) );
	};

	const discard = ( share: Share ) =>
		api
			.discard( postId, share.groupId )
			.then( () => sent.remove( share.groupId ) )
			.catch( ( err ) => setError( api.messageOf( err ) ) );

	return {
		sending,
		error,
		setError,
		clearError: () => setError( null ),
		send,
		discard,
	};
}
