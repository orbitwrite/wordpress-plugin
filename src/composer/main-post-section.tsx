/**
 * The main post: its text and image.
 */
import { TextareaControl } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

import ImageField from '../components/image-field';
import type { Update } from '../hooks/use-stored';
import type { Draft } from '../lib/draft';
import Section from './section';

interface Props {
	panels: boolean;
	draft: Readonly< Draft >;
	update: Update< Readonly< Draft > >;
	/** Who the main post goes to. */
	help?: string;
}

export default function MainPostSection( {
	panels,
	draft,
	update,
	help,
}: Props ) {
	return (
		<Section
			panels={ panels }
			title={ __( 'Post', 'orbitwrite' ) }
			className="orbitwrite-composer__main"
		>
			<TextareaControl
				__nextHasNoMarginBottom
				label={ __( 'Main post', 'orbitwrite' ) }
				hideLabelFromVision={ panels }
				value={ draft.text }
				rows={ 6 }
				onChange={ ( text ) => update( { text, textTouched: true } ) }
				help={ help }
			/>
			<ImageField
				image={ draft.image }
				onChange={ ( image ) =>
					update( { image, imageTouched: true } )
				}
			/>
		</Section>
	);
}
