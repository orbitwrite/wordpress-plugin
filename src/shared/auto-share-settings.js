/**
 * The auto-share settings form: whether to share each article as it's
 * published, where, with what text, and when.
 *
 * The settings are the person's own (their connection, their channels).
 * The server checks everything again; what's checked here is only so the
 * form can say what's wrong before saving.
 */
import {
	Button,
	CheckboxControl,
	Notice,
	RadioControl,
	Spinner,
	TextareaControl,
	ToggleControl,
} from '@wordpress/components';
import { useEffect, useRef, useState } from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';

import * as api from './api';
import { ChannelLabel } from './channel-list';
import { isPostable, unavailableReason } from './rules';
import { renderTemplate, unknownTags } from './template';

/** What each template tag stands for. */
const TAG_HELP = {
	title: () => __( "the article's title", 'orbitwrite' ),
	url: () => __( 'its link', 'orbitwrite' ),
	excerpt: () =>
		__( 'its excerpt, or the start of the article', 'orbitwrite' ),
	author: () => __( "the author's name", 'orbitwrite' ),
	hashtags: () => __( 'its tags, as hashtags', 'orbitwrite' ),
};

export default function AutoShareSettings() {
	const [ loaded, setLoaded ] = useState( null );
	const [ channels, setChannels ] = useState( null );
	const [ form, setForm ] = useState( null );
	const [ loadError, setLoadError ] = useState( null );
	const [ notConnected, setNotConnected ] = useState( false );
	const [ saving, setSaving ] = useState( false );
	const [ notice, setNotice ] = useState( null );
	const textField = useRef( null );

	useEffect( () => {
		Promise.all( [ api.getAutoShare(), api.getChannels() ] )
			.then( ( [ settings, answer ] ) => {
				setLoaded( settings );
				setForm( settings.settings );
				setChannels( answer.channels );
			} )
			.catch( ( err ) =>
				api.isNotConnected( err )
					? setNotConnected( true )
					: setLoadError( err.message )
			);
	}, [] );

	if ( notConnected ) {
		return (
			<Notice status="warning" isDismissible={ false }>
				{ __(
					'Connect Orbitwrite on the Overview page to set up auto-share.',
					'orbitwrite'
				) }
			</Notice>
		);
	}
	if ( loadError ) {
		return (
			<Notice status="error" isDismissible={ false }>
				{ loadError }
			</Notice>
		);
	}
	if ( ! form || ! channels ) {
		return <Spinner />;
	}

	const update = ( fields ) => {
		setNotice( null );
		setForm( ( current ) => ( { ...current, ...fields } ) );
	};
	const toggleIn = ( list, value, on ) =>
		on
			? [ ...list.filter( ( item ) => item !== value ), value ]
			: list.filter( ( item ) => item !== value );

	// A saved channel that has since gone is dropped on the next save.
	const known = form.accountIds.filter( ( id ) =>
		channels.some( ( channel ) => channel.id === id )
	);

	const unknown = unknownTags( form.template );

	// A tag goes where the cursor is, and the cursor after it.
	const insertTag = ( tag ) => {
		const token = `{${ tag }}`;
		const field = textField.current?.querySelector( 'textarea' );
		const start = field ? field.selectionStart : form.template.length;
		const end = field ? field.selectionEnd : form.template.length;
		update( {
			template:
				form.template.slice( 0, start ) +
				token +
				form.template.slice( end ),
		} );
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

	const onSave = () => {
		setSaving( true );
		setNotice( null );
		api.saveAutoShare( { ...form, accountIds: known } )
			.then( ( answer ) => {
				setForm( answer.settings );
				setLoaded( ( current ) => ( {
					...current,
					otherWorkspace: false,
				} ) );
				setNotice( {
					status: 'success',
					message: answer.settings.enabled
						? __(
								'Saved. Your articles are shared when they’re published.',
								'orbitwrite'
						  )
						: __( 'Saved. Auto-share is off.', 'orbitwrite' ),
				} );
			} )
			.catch( ( err ) =>
				setNotice( { status: 'error', message: err.message } )
			)
			.finally( () => setSaving( false ) );
	};

	return (
		<div className="orbitwrite-composer orbitwrite-auto-share">
			{ loaded.otherWorkspace && (
				<Notice status="warning" isDismissible={ false }>
					{ __(
						'These settings were saved for another Orbitwrite workspace, so nothing is shared until you pick channels here and save.',
						'orbitwrite'
					) }
				</Notice>
			) }

			<ToggleControl
				__nextHasNoMarginBottom
				label={ __(
					'Share my articles when they’re published',
					'orbitwrite'
				) }
				checked={ form.enabled }
				onChange={ ( enabled ) => update( { enabled } ) }
				help={ __(
					'Only the first time each article is published. You can turn it off for one article from its Share on Orbitwrite box.',
					'orbitwrite'
				) }
			/>

			{ /* The rest only matters once it's on. */ }
			{ form.enabled && (
				<>
					<fieldset className="orbitwrite-composer__channels">
						<legend className="orbitwrite-composer__label">
							{ __( 'Channels', 'orbitwrite' ) }
						</legend>
						{ channels.length === 0 && (
							<p>
								{ __(
									'This workspace has no channels yet. Connect one in Orbitwrite.',
									'orbitwrite'
								) }
							</p>
						) }
						{ channels.map( ( channel ) => {
							const picked = known.includes( channel.id );
							const reason = unavailableReason( channel );
							const needsImage =
								channel.media?.required &&
								channel.media?.images;
							return (
								<CheckboxControl
									__nextHasNoMarginBottom
									key={ channel.id }
									label={
										<ChannelLabel channel={ channel } />
									}
									checked={ picked }
									// A channel that broke after it was picked can
									// still be unpicked.
									disabled={
										! isPostable( channel ) && ! picked
									}
									onChange={ ( on ) =>
										update( {
											accountIds: toggleIn(
												known,
												channel.id,
												on
											),
										} )
									}
									help={
										reason ||
										( needsImage
											? __(
													'Needs an image: articles without a featured image can’t be shared here.',
													'orbitwrite'
											  )
											: undefined )
									}
								/>
							);
						} ) }
					</fieldset>

					<div
						className="orbitwrite-auto-share__text"
						ref={ textField }
					>
						<TextareaControl
							__nextHasNoMarginBottom
							label={ __( 'Text', 'orbitwrite' ) }
							value={ form.template }
							rows={ 4 }
							onChange={ ( template ) => update( { template } ) }
						/>
						<p className="orbitwrite-auto-share__hint">
							{ __(
								'Click a tag to add it where the cursor is. Each is filled in from the article:',
								'orbitwrite'
							) }
						</p>
						<ul className="orbitwrite-auto-share__tags">
							{ loaded.tags.map( ( tag ) => (
								<li key={ tag }>
									<Button
										variant="secondary"
										size="small"
										onClick={ () => insertTag( tag ) }
									>
										{ `{${ tag }}` }
									</Button>{ ' ' }
									{ TAG_HELP[ tag ] ? TAG_HELP[ tag ]() : '' }
								</li>
							) ) }
						</ul>
						{ form.template !== loaded.defaultTemplate && (
							<Button
								variant="link"
								className="orbitwrite-auto-share__reset"
								onClick={ () =>
									update( {
										template: loaded.defaultTemplate,
									} )
								}
							>
								{ __( 'Use the default text', 'orbitwrite' ) }
							</Button>
						) }
					</div>

					{ unknown.length > 0 && (
						<Notice status="warning" isDismissible={ false }>
							{ sprintf(
								/* translators: %s: the unknown tags. */
								__(
									"%s isn't a tag, so it would be posted as written. Saving is refused until it's fixed.",
									'orbitwrite'
								),
								unknown
									.map( ( tag ) => `{${ tag }}` )
									.join( ', ' )
							) }
						</Notice>
					) }
					<div className="orbitwrite-auto-share__preview">
						<p className="orbitwrite-composer__label">
							{ __( 'Preview', 'orbitwrite' ) }
						</p>
						{ loaded.sample ? (
							<>
								<p className="orbitwrite-auto-share__preview-text">
									{ renderTemplate(
										form.template,
										loaded.sample.values
									) ||
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
										loaded.sample.title
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

					<CheckboxControl
						__nextHasNoMarginBottom
						label={ __(
							'Attach the featured image',
							'orbitwrite'
						) }
						checked={ form.image }
						onChange={ ( image ) => update( { image } ) }
					/>

					<RadioControl
						label={ __( 'When', 'orbitwrite' ) }
						selected={ form.when }
						onChange={ ( when ) => update( { when } ) }
						options={ [
							{
								label: __( 'Next free slot', 'orbitwrite' ),
								value: 'next',
							},
							{
								label: __(
									'As soon as the article is published',
									'orbitwrite'
								),
								value: 'now',
							},
						] }
					/>

					<fieldset className="orbitwrite-composer__channels">
						<legend className="orbitwrite-composer__label">
							{ __( 'Share these', 'orbitwrite' ) }
						</legend>
						{ loaded.postTypes.map( ( type ) => (
							<CheckboxControl
								__nextHasNoMarginBottom
								key={ type.name }
								label={ type.label }
								checked={ form.postTypes.includes( type.name ) }
								onChange={ ( on ) =>
									update( {
										postTypes: toggleIn(
											form.postTypes,
											type.name,
											on
										),
									} )
								}
							/>
						) ) }
					</fieldset>
				</>
			) }

			{ notice && (
				<Notice
					status={ notice.status }
					onRemove={ () => setNotice( null ) }
				>
					{ notice.message }
				</Notice>
			) }
			<Button
				variant="primary"
				className="orbitwrite-composer__send"
				isBusy={ saving }
				disabled={ saving }
				onClick={ onSave }
			>
				{ __( 'Save', 'orbitwrite' ) }
			</Button>
		</div>
	);
}
