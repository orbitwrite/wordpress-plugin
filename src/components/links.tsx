/**
 * Links out of WordPress: to a post in Orbitwrite, and to where it went out.
 */
import { ExternalLink } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

import type { PlatformLink } from '../lib/types';

/**
 * "Open in Orbitwrite".
 *
 * @param props
 * @param props.href
 */
export function OpenInOrbitwrite( { href }: { href: string } ) {
	return (
		<ExternalLink href={ href }>
			{ __( 'Open in Orbitwrite', 'orbitwrite' ) }
		</ExternalLink>
	);
}

/**
 * A link per network a post went out on, named by account.
 *
 * @param props
 * @param props.links
 */
export function PlatformLinks( { links }: { links: PlatformLink[] } ) {
	return (
		<>
			{ links.map( ( link ) => (
				<ExternalLink key={ link.url } href={ link.url }>
					{ link.handle || link.platform }
				</ExternalLink>
			) ) }
		</>
	);
}
