/**
 * Entry: "Share on Orbitwrite" on the classic editor's screen.
 */
import domReady from '@wordpress/dom-ready';
import { createRoot } from '@wordpress/element';

import ClassicPanel from './classic-editor/classic-panel';
import './styles/composer.scss';

domReady( () => {
	const root = document.getElementById( 'orbitwrite-classic' );
	if ( ! root ) {
		return;
	}
	createRoot( root ).render(
		<ClassicPanel
			postId={ parseInt( root.dataset.postId || '', 10 ) || 0 }
			permalink={ root.dataset.permalink || '' }
			status={ root.dataset.status || 'draft' }
		/>
	);
} );
