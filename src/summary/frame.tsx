/**
 * The summary's frame: a card on the Orbitwrite page, bare inside a
 * dashboard widget, which brings its own title and box.
 */
import {
	Card,
	CardBody,
	CardHeader,
	ExternalLink,
} from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import type { ReactNode } from 'react';

interface Props {
	widget: boolean;
	/** Orbitwrite's analytics page, once known. */
	analyticsUrl?: string | null;
	children: ReactNode;
}

export default function Frame( { widget, analyticsUrl, children }: Props ) {
	if ( widget ) {
		return <div className="orbitwrite-summary is-widget">{ children }</div>;
	}
	return (
		<Card className="orbitwrite-summary">
			<CardHeader>
				<h2>{ __( 'Last 4 weeks', 'orbitwrite' ) }</h2>
				{ analyticsUrl && (
					<ExternalLink href={ analyticsUrl }>
						{ __( 'Open analytics in Orbitwrite', 'orbitwrite' ) }
					</ExternalLink>
				) }
			</CardHeader>
			<CardBody>{ children }</CardBody>
		</Card>
	);
}
