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
	Notice,
	RadioControl,
	Spinner,
	ToggleControl,
} from '@wordpress/components';
import { __ } from '@wordpress/i18n';

import { CheckboxControl } from '../components/wp-components';
import { toggle } from '../lib/list';
import type { AutoShareSettings as Settings } from '../lib/types';
import ChannelPicker from './channel-picker';
import TemplateField from './template-field';
import TemplatePreview from './template-preview';
import { useAutoShareSettings } from './use-auto-share-settings';

export default function AutoShareSettings() {
	const {
		loaded,
		channels,
		form,
		loadError,
		notConnected,
		saving,
		notice,
		dismissNotice,
		update,
		save,
	} = useAutoShareSettings();

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
	if ( ! loaded || ! form || ! channels ) {
		return <Spinner />;
	}

	// A saved channel that has since gone is dropped on the next save.
	const known = form.accountIds.filter( ( id ) =>
		channels.some( ( channel ) => channel.id === id )
	);

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
					<ChannelPicker
						channels={ channels }
						picked={ known }
						onChange={ ( accountIds ) => update( { accountIds } ) }
					/>

					<TemplateField
						template={ form.template }
						tags={ loaded.tags }
						defaultTemplate={ loaded.defaultTemplate }
						onChange={ ( template ) => update( { template } ) }
					/>
					<TemplatePreview
						template={ form.template }
						sample={ loaded.sample }
					/>

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
						onChange={ ( when ) =>
							update( { when: when as Settings[ 'when' ] } )
						}
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
										postTypes: toggle(
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
				<Notice status={ notice.status } onRemove={ dismissNotice }>
					{ notice.message }
				</Notice>
			) }
			<Button
				variant="primary"
				className="orbitwrite-composer__send"
				isBusy={ saving }
				disabled={ saving }
				onClick={ () => save( { ...form, accountIds: known } ) }
			>
				{ __( 'Save', 'orbitwrite' ) }
			</Button>
		</div>
	);
}
