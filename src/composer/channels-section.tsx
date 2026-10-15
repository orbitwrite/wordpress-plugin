/**
 * Where the post goes.
 */
import { Notice, Spinner, VisuallyHidden } from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';

import type { Channel, Content, Versions } from '../lib/types';
import ChannelList from './channel-list';
import Section from './section';

interface Props {
	panels: boolean;
	/** Null until read. */
	channels: Channel[] | null;
	error: string | null;
	selected: string[];
	onSelect: ( id: string, checked: boolean ) => void;
	main: Content;
	versions: Versions;
	onVersions: ( versions: Versions ) => void;
	appUrl: string;
}

export default function ChannelsSection( {
	panels,
	channels,
	error,
	selected,
	...listProps
}: Props ) {
	const legend = __( 'Channels', 'orbitwrite' );
	return (
		<Section
			panels={ panels }
			title={
				selected.length
					? sprintf(
							/* translators: %d: number of channels picked. */
							__( 'Channels (%d)', 'orbitwrite' ),
							selected.length
					  )
					: legend
			}
		>
			<fieldset className="orbitwrite-composer__channels">
				{ panels ? (
					<VisuallyHidden as="legend">{ legend }</VisuallyHidden>
				) : (
					<legend className="orbitwrite-composer__label">
						{ legend }
					</legend>
				) }
				{ error && (
					<Notice status="error" isDismissible={ false }>
						{ error }
					</Notice>
				) }
				{ ! channels && ! error && <Spinner /> }
				{ channels && (
					<ChannelList
						channels={ channels }
						selected={ selected }
						{ ...listProps }
					/>
				) }
			</fieldset>
		</Section>
	);
}
