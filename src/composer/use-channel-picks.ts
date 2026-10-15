/**
 * Which channels the post goes to.
 */
import { useMemo } from '@wordpress/element';

import type { Update } from '../hooks/use-stored';
import type { Prefs } from '../lib/draft';
import { toggle } from '../lib/list';
import { isPostable } from '../lib/rules';
import type { Channel } from '../lib/types';

/**
 * The picked channels: the person's picks, or the workspace's defaults until
 * they pick. Only channels that can be posted to count.
 *
 * @param channels    Null until read.
 * @param prefs
 * @param updatePrefs
 * @return `{ selectedChannels, selectedIds, onSelect }`.
 */
export function useChannelPicks(
	channels: Channel[] | null,
	prefs: Readonly< Prefs >,
	updatePrefs: Update< Readonly< Prefs > >
) {
	const picked = useMemo(
		() =>
			prefs.selected ||
			( channels || [] )
				.filter( ( channel ) => channel.defaultSelected )
				.map( ( channel ) => channel.id ),
		[ prefs.selected, channels ]
	);

	const selectedChannels = useMemo(
		() =>
			( channels || [] ).filter(
				( channel ) =>
					picked.includes( channel.id ) && isPostable( channel )
			),
		[ channels, picked ]
	);
	const selectedIds = useMemo(
		() => selectedChannels.map( ( channel ) => channel.id ),
		[ selectedChannels ]
	);

	const onSelect = ( id: string, checked: boolean ) =>
		updatePrefs( { selected: toggle( picked, id, checked ) } );

	return { selectedChannels, selectedIds, onSelect };
}
