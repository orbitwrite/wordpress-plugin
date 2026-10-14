/**
 * Entry: Orbitwrite in the block editor.
 */
import { registerPlugin } from '@wordpress/plugins';

import Orbitwrite from './block-editor/plugin';
import './styles/composer.scss';

registerPlugin( 'orbitwrite', { render: Orbitwrite } );
