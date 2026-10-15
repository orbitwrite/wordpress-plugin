/**
 * How channels are named. Pure.
 */
import { __, sprintf } from '@wordpress/i18n';

import type { Channel } from './types';

/**
 * A channel's display name.
 *
 * @param channel
 * @return Name.
 */
export function channelName( channel: Channel ): string {
	return channel.displayName || channel.handle || channel.platformName;
}

/**
 * The names of the channels with these ids, skipping any no longer listed.
 *
 * @param ids
 * @param channels
 * @return Names.
 */
export function channelNames( ids: string[], channels: Channel[] ): string[] {
	return ids.flatMap( ( id ) => {
		const channel = channels.find( ( item ) => item.id === id );
		return channel ? [ channelName( channel ) ] : [];
	} );
}

/**
 * How a channel's own version is labelled: by network ("Text for Bluesky"),
 * adding the account only when the workspace has two on that network.
 *
 * @param channel
 * @param channels Every channel listed.
 * @return Label.
 */
export function versionLabel( channel: Channel, channels: Channel[] ): string {
	const sameNetwork = channels.filter(
		( other ) => other.platform === channel.platform
	).length;
	return sameNetwork > 1
		? sprintf(
				/* translators: 1: account name, 2: network name. */
				__( 'Text for %1$s on %2$s', 'orbitwrite' ),
				channelName( channel ),
				channel.platformName
		  )
		: sprintf(
				/* translators: %s: network name. */
				__( 'Text for %s', 'orbitwrite' ),
				channel.platformName
		  );
}
