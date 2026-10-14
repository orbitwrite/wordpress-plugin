/**
 * The channels auto-share sends to.
 */
import { __ } from '@wordpress/i18n';

import ChannelLabel from '../components/channel-label';
import { CheckboxControl } from '../components/wp-components';
import { toggle } from '../lib/list';
import { isPostable, unavailableReason } from '../lib/rules';
import type { Channel } from '../lib/types';

interface Props {
	channels: Channel[];
	/** Picked channel ids. */
	picked: string[];
	onChange: ( picked: string[] ) => void;
}

/**
 * What to say under a channel: why it can't be picked, or that it needs an
 * image.
 *
 * @param channel
 * @return Help.
 */
function help( channel: Channel ): string | undefined {
	const reason = unavailableReason( channel );
	if ( reason ) {
		return reason;
	}
	if ( channel.media?.required && channel.media?.images ) {
		return __(
			'Needs an image: articles without a featured image can’t be shared here.',
			'orbitwrite'
		);
	}
	return undefined;
}

export default function ChannelPicker( { channels, picked, onChange }: Props ) {
	return (
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
				const isPicked = picked.includes( channel.id );
				return (
					<CheckboxControl
						__nextHasNoMarginBottom
						key={ channel.id }
						label={ <ChannelLabel channel={ channel } /> }
						checked={ isPicked }
						// A channel that broke after it was picked can still
						// be unpicked.
						disabled={ ! isPostable( channel ) && ! isPicked }
						onChange={ ( on ) =>
							onChange( toggle( picked, channel.id, on ) )
						}
						help={ help( channel ) }
					/>
				);
			} ) }
		</fieldset>
	);
}
