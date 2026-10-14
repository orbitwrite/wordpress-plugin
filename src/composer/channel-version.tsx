/**
 * A picked channel's "Same as main post" checkbox, and its own text and
 * image once unticked.
 */
import { Button, TextareaControl } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

import ImageField from '../components/image-field';
import { CheckboxControl } from '../components/wp-components';
import { versionLabel } from '../lib/channels';
import type { Channel, Content, Versions } from '../lib/types';
import {
	backToMainPost,
	copyMainPost,
	editVersion,
	giveOwnVersion,
} from '../lib/versions';

interface Props {
	channel: Channel;
	/** Every channel listed. */
	channels: Channel[];
	/** Whether the channel has its own version. */
	own: boolean;
	/** What the channel sends. */
	content: Content;
	main: Content;
	versions: Versions;
	onVersions: ( versions: Versions ) => void;
}

export default function ChannelVersion( {
	channel,
	channels,
	own,
	content,
	main,
	versions,
	onVersions,
}: Props ) {
	const id = channel.id;
	const edit = ( changes: Partial< Content > ) =>
		onVersions( editVersion( versions, id, changes ) );

	return (
		<div className="orbitwrite-channel-row__body">
			<CheckboxControl
				__nextHasNoMarginBottom
				label={ __( 'Same as main post', 'orbitwrite' ) }
				checked={ ! own }
				onChange={ ( same ) =>
					onVersions(
						same
							? backToMainPost( versions, id )
							: giveOwnVersion( versions, id, main )
					)
				}
				help={
					own
						? __(
								'Goes out as its own post in Orbitwrite, with the text and image below.',
								'orbitwrite'
						  )
						: undefined
				}
			/>
			{ own && (
				<div className="orbitwrite-channel-row__version">
					<TextareaControl
						__nextHasNoMarginBottom
						label={ versionLabel( channel, channels ) }
						value={ content.text }
						rows={ 5 }
						onChange={ ( text ) => edit( { text } ) }
					/>
					<ImageField
						image={ content.image }
						onChange={ ( image ) => edit( { image } ) }
					/>
					<Button
						variant="link"
						onClick={ () =>
							onVersions( copyMainPost( versions, id, main ) )
						}
					>
						{ __( 'Start again from main post', 'orbitwrite' ) }
					</Button>
				</div>
			) }
		</div>
	);
}
