/**
 * The dashboard widget: the workspace's last four weeks.
 */
import domReady from '@wordpress/dom-ready';
import { createRoot } from '@wordpress/element';

import Summary from './summary';
import './styles/composer.scss';

domReady( () => {
	const root = document.getElementById( 'orbitwrite-dashboard' );
	if ( root ) {
		createRoot( root ).render( <Summary widget /> );
	}
} );
