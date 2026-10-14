/**
 * The composer's words that depend on its state. Pure.
 */
import { __, _n, sprintf } from '@wordpress/i18n';

import { channelName } from '../lib/channels';
import { formatInstant, formatWallClock } from '../lib/time';
import type { Channel, Notice, Share, When } from '../lib/types';

/**
 * The send button's label.
 *
 * @param when
 * @param nextSlot The next free slot, once read.
 * @param at       The picked wall-clock time, or ''.
 * @param timezone
 * @return Label.
 */
export function sendLabel(
	when: When,
	nextSlot: string | undefined,
	at: string,
	timezone: string
): string {
	if ( when === 'now' ) {
		return __( 'Publish now', 'orbitwrite' );
	}
	if ( when === 'next' ) {
		return nextSlot
			? sprintf(
					/* translators: %s: date and time. */
					__( 'Schedule for %s', 'orbitwrite' ),
					formatInstant( nextSlot, timezone )
			  )
			: __( 'Schedule for next free slot', 'orbitwrite' );
	}
	return at
		? sprintf(
				/* translators: %s: date and time. */
				__( 'Schedule for %s', 'orbitwrite' ),
				formatWallClock( at )
		  )
		: __( 'Schedule', 'orbitwrite' );
}

/**
 * What to say once Orbitwrite has the post.
 *
 * @param shares   What the send route answered, at least one.
 * @param timezone
 * @return Notice.
 */
export function sentNotice( shares: Share[], timezone: string ): Notice {
	const first = shares[ 0 ];
	const what =
		first.status === 'publishing'
			? __( 'Sent to Orbitwrite. Publishing now.', 'orbitwrite' )
			: sprintf(
					/* translators: %s: date and time. */
					__( 'Scheduled for %s.', 'orbitwrite' ),
					formatInstant( first.scheduledAt ?? '', timezone )
			  );
	const message =
		shares.length > 1
			? `${ what } ${ sprintf(
					/* translators: %d: number of posts. */
					_n(
						'Orbitwrite has it as %d post.',
						'Orbitwrite has it as %d posts, one per version.',
						shares.length,
						'orbitwrite'
					),
					shares.length
			  ) }`
			: what;
	return { type: 'success', message, openUrl: first.openUrl };
}

/**
 * The line under the main post saying who it's for.
 *
 * @param selectedChannels
 * @param mainUsers        Selected channels using the main post.
 * @return Help text.
 */
export function mainPostHelp(
	selectedChannels: Channel[],
	mainUsers: Channel[]
): string | undefined {
	if ( ! selectedChannels.length ) {
		return undefined;
	}
	if ( ! mainUsers.length ) {
		return __(
			"Every channel has its own version, so the main post won't be sent.",
			'orbitwrite'
		);
	}
	if ( mainUsers.length === selectedChannels.length ) {
		return undefined;
	}
	return sprintf(
		/* translators: %s: comma-separated channel names. */
		__( 'Sent to %s.', 'orbitwrite' ),
		mainUsers.map( channelName ).join( ', ' )
	);
}
