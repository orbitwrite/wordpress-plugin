/**
 * The channels a post goes to. Picking a channel shows its character count
 * and a "Same as main post" checkbox; unticking that opens the channel's own
 * text and image right there, under the channel it belongs to. Anything
 * stopping a channel from taking its content is said on the channel.
 */
import { Button, ExternalLink } from '@wordpress/components';
import { useState } from '@wordpress/element';
import { __, _n, sprintf } from '@wordpress/i18n';

import { isPostable } from '../lib/rules';
import type { Channel, Content, Versions } from '../lib/types';
import ChannelRow from './channel-row';

interface Props {
	channels: Channel[];
	selected: string[];
	onSelect: ( id: string, checked: boolean ) => void;
	main: Content;
	versions: Versions;
	onVersions: ( versions: Versions ) => void;
	appUrl: string;
}

export default function ChannelList( {
	channels,
	selected,
	onSelect,
	main,
	versions,
	onVersions,
	appUrl,
}: Props ) {
	const [ showUnavailable, setShowUnavailable ] = useState( false );

	if ( channels.length === 0 ) {
		return (
			<p>
				{ __(
					'This workspace has no channels yet. Connect one in Orbitwrite.',
					'orbitwrite'
				) }{ ' ' }
				<ExternalLink href={ appUrl }>
					{ __( 'Open Orbitwrite', 'orbitwrite' ) }
				</ExternalLink>
			</p>
		);
	}

	// With one channel picked there is nothing to differ from, so the
	// choice only appears once there are two (or the channel already has a
	// version of its own, so it can be put back).
	const several = selected.length > 1;

	// Channels that can't be picked (reconnect, video only) are folded into
	// one line: each says why once shown, but a list of them shouldn't push
	// the channels that can be picked off the screen. One already picked
	// stays visible, so it can be unticked.
	const unavailable = channels.filter(
		( channel ) =>
			! isPostable( channel ) && ! selected.includes( channel.id )
	);
	const listed = channels.filter(
		( channel ) => ! unavailable.includes( channel )
	);

	const row = ( channel: Channel ) => (
		<ChannelRow
			key={ channel.id }
			channel={ channel }
			channels={ channels }
			isSelected={ selected.includes( channel.id ) }
			offerVersion={ several }
			onSelect={ onSelect }
			main={ main }
			versions={ versions }
			onVersions={ onVersions }
		/>
	);

	return (
		<>
			{ listed.map( row ) }
			{ unavailable.length > 0 && (
				<>
					<Button
						variant="link"
						className="orbitwrite-channel-list__more"
						aria-expanded={ showUnavailable }
						onClick={ () =>
							setShowUnavailable( ! showUnavailable )
						}
					>
						{ showUnavailable
							? __( 'Hide unavailable channels', 'orbitwrite' )
							: sprintf(
									/* translators: %d: number of channels. */
									_n(
										'%d channel unavailable',
										'%d channels unavailable',
										unavailable.length,
										'orbitwrite'
									),
									unavailable.length
							  ) }
					</Button>
					{ showUnavailable && unavailable.map( row ) }
				</>
			) }
		</>
	);
}
