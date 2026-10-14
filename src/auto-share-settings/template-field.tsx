/**
 * The auto-share text, with its tags to click in.
 */
import { Button, TextareaControl } from '@wordpress/components';
import { useRef } from '@wordpress/element';
import { __ } from '@wordpress/i18n';

/** What each template tag stands for. */
const TAG_HELP: Record< string, () => string > = {
	title: () => __( "the article's title", 'orbitwrite' ),
	url: () => __( 'its link', 'orbitwrite' ),
	excerpt: () =>
		__( 'its excerpt, or the start of the article', 'orbitwrite' ),
	author: () => __( "the author's name", 'orbitwrite' ),
	hashtags: () => __( 'its tags, as hashtags', 'orbitwrite' ),
};

interface Props {
	template: string;
	/** The tags offered. */
	tags: string[];
	defaultTemplate: string;
	onChange: ( template: string ) => void;
}

export default function TemplateField( {
	template,
	tags,
	defaultTemplate,
	onChange,
}: Props ) {
	const container = useRef< HTMLDivElement >( null );

	// A tag goes where the cursor is, and the cursor after it.
	const insertTag = ( tag: string ) => {
		const token = `{${ tag }}`;
		const field = container.current?.querySelector( 'textarea' );
		const start = field ? field.selectionStart : template.length;
		const end = field ? field.selectionEnd : template.length;
		onChange( template.slice( 0, start ) + token + template.slice( end ) );
		window.requestAnimationFrame( () => {
			if ( field ) {
				field.focus();
				field.setSelectionRange(
					start + token.length,
					start + token.length
				);
			}
		} );
	};

	return (
		<div className="orbitwrite-auto-share__text" ref={ container }>
			<TextareaControl
				__nextHasNoMarginBottom
				label={ __( 'Text', 'orbitwrite' ) }
				value={ template }
				rows={ 4 }
				onChange={ onChange }
			/>
			<p className="orbitwrite-auto-share__hint">
				{ __(
					'Click a tag to add it where the cursor is. Each is filled in from the article:',
					'orbitwrite'
				) }
			</p>
			<ul className="orbitwrite-auto-share__tags">
				{ tags.map( ( tag ) => (
					<li key={ tag }>
						<Button
							variant="secondary"
							size="small"
							onClick={ () => insertTag( tag ) }
						>
							{ `{${ tag }}` }
						</Button>{ ' ' }
						{ TAG_HELP[ tag ]?.() ?? '' }
					</li>
				) ) }
			</ul>
			{ template !== defaultTemplate && (
				<Button
					variant="link"
					className="orbitwrite-auto-share__reset"
					onClick={ () => onChange( defaultTemplate ) }
				>
					{ __( 'Use the default text', 'orbitwrite' ) }
				</Button>
			) }
		</div>
	);
}
