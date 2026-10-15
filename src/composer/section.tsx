/**
 * A part of the composer: a collapsible panel in the block editor sidebar,
 * a plain block elsewhere.
 */
import { PanelBody } from '@wordpress/components';
import type { ReactNode } from 'react';

interface Props {
	/** Whether the composer is laid out as panels. */
	panels: boolean;
	/** The panel's title. */
	title: string;
	initialOpen?: boolean;
	className?: string;
	children: ReactNode;
}

export default function Section( {
	panels,
	title,
	initialOpen = true,
	className,
	children,
}: Props ) {
	if ( ! panels ) {
		return <div className={ className }>{ children }</div>;
	}
	return (
		<PanelBody title={ title } initialOpen={ initialOpen }>
			<div
				className={ `orbitwrite-composer__stack ${ className || '' }` }
			>
				{ children }
			</div>
		</PanelBody>
	);
}
