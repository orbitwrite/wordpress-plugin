/**
 * Confirmations as the editor's own snackbars, like "Post published".
 */
import { useDispatch } from '@wordpress/data';
import { useCallback, useEffect } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { store as noticesStore } from '@wordpress/notices';

import type { Connection } from '../hooks/use-connection';
import type { Notice } from '../lib/types';

/**
 * Says a notice as a snackbar, with "Open in Orbitwrite" when it links to a
 * post. A notice the connect flow left ("Connected to Acme") is one too.
 *
 * @param connection From useConnection().
 * @return Shows a notice.
 */
export function useSnackbar(
	connection: Connection
): ( notice: Notice ) => void {
	const { createNotice } = useDispatch( noticesStore );

	const notify = useCallback(
		( { type, message, openUrl }: Notice ) => {
			createNotice( type === 'error' ? 'error' : 'success', message, {
				type: 'snackbar',
				actions: openUrl
					? [
							{
								label: __( 'Open in Orbitwrite', 'orbitwrite' ),
								onClick: () =>
									window.open(
										openUrl,
										'_blank',
										'noopener'
									),
							},
					  ]
					: [],
			} );
		},
		[ createNotice ]
	);

	const { notice, setNotice } = connection;
	useEffect( () => {
		if ( notice ) {
			notify( notice );
			setNotice( null );
		}
	}, [ notice, notify, setNotice ] );

	return notify;
}
