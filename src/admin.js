/**
 * The Orbitwrite admin page: the composer for posts not tied to an article,
 * beside the workspace's last four weeks.
 */
import { Card, CardBody, CardHeader } from '@wordpress/components';
import domReady from '@wordpress/dom-ready';
import { createRoot, useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';

import Composer from './shared/composer';
import Summary from './shared/summary';
import './shared/composer.scss';

/**
 * The page. The composer owns the connection; the summary follows it, so
 * it only asks for numbers once there's a workspace to ask, and goes when
 * the person disconnects.
 */
function Page() {
	const [ status, setStatus ] = useState( null );
	const connected = Boolean( status?.connected );
	return (
		<div
			className={ `orbitwrite-overview${
				connected ? ' is-connected' : ''
			}` }
		>
			<Card className="orbitwrite-overview__compose">
				<CardHeader>
					<h2>
						{ connected
							? __( 'New social post', 'orbitwrite' )
							: __( 'Connect Orbitwrite', 'orbitwrite' ) }
					</h2>
				</CardHeader>
				<CardBody>
					<Composer onStatus={ setStatus } />
				</CardBody>
			</Card>
			{ connected && (
				<Summary key={ status.organization?.id || 'workspace' } />
			) }
		</div>
	);
}

domReady( () => {
	const root = document.getElementById( 'orbitwrite-app' );
	if ( root ) {
		createRoot( root ).render( <Page /> );
	}
} );
