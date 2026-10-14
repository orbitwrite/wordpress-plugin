/**
 * The user's connection to Orbitwrite.
 */
import { useCallback, useEffect, useState } from '@wordpress/element';

import * as api from '../lib/api';
import type { Notice, Status } from '../lib/types';

export interface Connection {
	status: Status | null;
	error: string | null;
	notice: Notice | null;
	setNotice: ( notice: Notice | null ) => void;
	reload: () => Promise< void >;
}

/**
 * The first answer, when the page carries it (Admin::enqueue_build). It's
 * used once: a later mount, or a reload, asks again.
 *
 * @return Status, or null.
 */
function takeBootStatus(): Status | null {
	const status = window.orbitwriteBoot?.status || null;
	if ( window.orbitwriteBoot ) {
		delete window.orbitwriteBoot.status;
	}
	return status;
}

/**
 * The user's connection, and a one-shot notice the OAuth flow left.
 *
 * @return `{ status, error, notice, setNotice, reload }`.
 */
export function useConnection(): Connection {
	const [ boot ] = useState( takeBootStatus );
	const [ status, setStatus ] = useState( boot );
	const [ error, setError ] = useState< string | null >( null );
	const [ notice, setNotice ] = useState< Notice | null >(
		boot?.notice || null
	);

	const reload = useCallback( () => {
		setError( null );
		return api
			.getStatus( window.location.href )
			.then( ( answer ) => {
				setStatus( answer );
				if ( answer.notice ) {
					setNotice( answer.notice );
				}
			} )
			.catch( ( err ) => setError( api.messageOf( err ) ) );
	}, [] );

	useEffect( () => {
		if ( ! boot ) {
			reload();
		}
	}, [ boot, reload ] );

	return { status, error, notice, setNotice, reload };
}
