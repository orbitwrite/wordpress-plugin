/**
 * The auto-share settings page.
 */
import domReady from '@wordpress/dom-ready';
import { createRoot } from '@wordpress/element';

import AutoShareSettings from './auto-share-settings';
import './styles/composer.scss';

domReady( () => {
	const root = document.getElementById( 'orbitwrite-auto-share' );
	if ( root ) {
		createRoot( root ).render( <AutoShareSettings /> );
	}
} );
