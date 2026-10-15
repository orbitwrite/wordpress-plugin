/**
 * The auto-share text as it would go out, filled in from the latest article,
 * and a warning for tags that don't exist.
 */
import { Notice } from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';

import { renderTemplate, unknownTags } from '../lib/template';
import type { AutoShareAnswer } from '../lib/types';

interface Props {
	template: string;
	/** The latest article's values, or null without one. */
	sample: AutoShareAnswer[ 'sample' ];
}

export default function TemplatePreview( { template, sample }: Props ) {
	const unknown = unknownTags( template );
	return (
		<>
			{ unknown.length > 0 && (
				<Notice status="warning" isDismissible={ false }>
					{ sprintf(
						/* translators: %s: the unknown tags. */
						__(
							"%s isn't a tag, so it would be posted as written. Saving is refused until it's fixed.",
							'orbitwrite'
						),
						unknown.map( ( tag ) => `{${ tag }}` ).join( ', ' )
					) }
				</Notice>
			) }
			<div className="orbitwrite-auto-share__preview">
				<p className="orbitwrite-composer__label">
					{ __( 'Preview', 'orbitwrite' ) }
				</p>
				{ sample ? (
					<>
						<p className="orbitwrite-auto-share__preview-text">
							{ renderTemplate( template, sample.values ) ||
								__(
									'(Nothing: the text is empty.)',
									'orbitwrite'
								) }
						</p>
						<p className="orbitwrite-auto-share__hint">
							{ sprintf(
								/* translators: %s: article title. */
								__(
									'Filled in from “%s”, your latest article.',
									'orbitwrite'
								),
								sample.title
							) }
						</p>
					</>
				) : (
					<p className="orbitwrite-auto-share__hint">
						{ __(
							'A preview appears once this site has a published article.',
							'orbitwrite'
						) }
					</p>
				) }
			</div>
		</>
	);
}
