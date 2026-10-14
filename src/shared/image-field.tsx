/**
 * An image picked from the Media Library, with its alt text. Used for the
 * main post and for a channel's own version.
 */
import { Button, TextControl } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

import type { Image } from './types';
import { MediaUpload } from './wp-components';

interface Props {
	image: Image | null;
	/** Called with the new image, or null. */
	onChange: ( image: Image | null ) => void;
	label?: string;
}

export default function ImageField( { image, onChange, label }: Props ) {
	return (
		<div className="orbitwrite-image">
			{ label && <p className="orbitwrite-composer__label">{ label }</p> }
			<div className="orbitwrite-image__row">
				{ image?.url && (
					<img
						src={ image.url }
						alt={ image.alt || '' }
						className="orbitwrite-image__thumb"
					/>
				) }
				<div className="orbitwrite-image__actions">
					<MediaUpload
						allowedTypes={ [ 'image' ] }
						value={ image?.id }
						onSelect={ ( media ) =>
							onChange( {
								id: media.id,
								url: media.sizes?.medium?.url || media.url,
								alt: media.alt || '',
								mime: media.mime || '',
								width: media.width || 0,
								height: media.height || 0,
							} )
						}
						render={ ( { open } ) => (
							<Button
								variant="secondary"
								size="compact"
								onClick={ open }
							>
								{ image
									? __( 'Replace image', 'orbitwrite' )
									: __( 'Add image', 'orbitwrite' ) }
							</Button>
						) }
					/>
					{ image && (
						<Button
							variant="tertiary"
							size="compact"
							isDestructive
							onClick={ () => onChange( null ) }
						>
							{ __( 'Remove', 'orbitwrite' ) }
						</Button>
					) }
				</div>
			</div>
			{ image && (
				<TextControl
					__nextHasNoMarginBottom
					__next40pxDefaultSize
					label={ __( 'Alt text', 'orbitwrite' ) }
					value={ image.alt || '' }
					onChange={ ( alt ) => onChange( { ...image, alt } ) }
				/>
			) }
		</div>
	);
}
