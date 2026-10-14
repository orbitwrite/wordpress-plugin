/**
 * The auto-share settings: read, edited and saved.
 */
import { useEffect, useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';

import * as api from '../lib/api';
import type { AutoShareAnswer, AutoShareSettings, Channel } from '../lib/types';

export interface SaveNotice {
	status: 'success' | 'error';
	message: string;
}

/**
 * The person's auto-share settings and the workspace's channels, with the
 * form's edits and saving.
 *
 * @return State and actions.
 */
export function useAutoShareSettings() {
	const [ loaded, setLoaded ] = useState< AutoShareAnswer | null >( null );
	const [ channels, setChannels ] = useState< Channel[] | null >( null );
	const [ form, setForm ] = useState< AutoShareSettings | null >( null );
	const [ loadError, setLoadError ] = useState< string | null >( null );
	const [ notConnected, setNotConnected ] = useState( false );
	const [ saving, setSaving ] = useState( false );
	const [ notice, setNotice ] = useState< SaveNotice | null >( null );

	useEffect( () => {
		Promise.all( [ api.getAutoShare(), api.getChannels() ] )
			.then( ( [ settings, answer ] ) => {
				setLoaded( settings );
				setForm( settings.settings );
				setChannels( answer.channels );
			} )
			.catch(
				api.handleError( () => setNotConnected( true ), setLoadError )
			);
	}, [] );

	const update = ( fields: Partial< AutoShareSettings > ) => {
		setNotice( null );
		setForm( ( current ) => current && { ...current, ...fields } );
	};

	const save = ( settings: AutoShareSettings ) => {
		setSaving( true );
		setNotice( null );
		api.saveAutoShare( settings )
			.then( ( answer ) => {
				setForm( answer.settings );
				setLoaded(
					( current ) =>
						current && { ...current, otherWorkspace: false }
				);
				setNotice( {
					status: 'success',
					message: answer.settings.enabled
						? __(
								'Saved. Your articles are shared when they’re published.',
								'orbitwrite'
						  )
						: __( 'Saved. Auto-share is off.', 'orbitwrite' ),
				} );
			} )
			.catch( ( err ) =>
				setNotice( { status: 'error', message: api.messageOf( err ) } )
			)
			.finally( () => setSaving( false ) );
	};

	return {
		loaded,
		channels,
		form,
		loadError,
		notConnected,
		saving,
		notice,
		dismissNotice: () => setNotice( null ),
		update,
		save,
	};
}
