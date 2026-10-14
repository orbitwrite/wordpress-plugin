/**
 * When the post goes out.
 */
import { useState } from '@wordpress/element';

import { useNextSlot } from '../hooks/use-next-slot';
import type { NextSlot } from '../hooks/use-next-slot';
import type { Update } from '../hooks/use-stored';
import type { Prefs } from '../lib/draft';
import { defaultScheduleTime } from '../lib/time';
import type { When } from '../lib/types';

export interface Schedule {
	when: When;
	choose: ( when: When ) => void;
	nextSlot: NextSlot;
	/** The wall-clock time to schedule for, or ''. */
	at: string;
	/** Whether the timing is complete enough to send. */
	ready: boolean;
	/** Back to scheduling, after a send. */
	reset: () => void;
}

/**
 * The timing: the person's usual choice, with the next free slot read while
 * that's the choice.
 *
 * @param props
 * @param props.prefs
 * @param props.updatePrefs
 * @param props.pickedAt    The draft's picked time, or ''.
 * @param props.timezone    The workspace's.
 * @param props.accountIds  The picked channels.
 * @return Schedule.
 */
export function useSchedule( {
	prefs,
	updatePrefs,
	pickedAt,
	timezone,
	accountIds,
}: {
	prefs: Readonly< Prefs >;
	updatePrefs: Update< Readonly< Prefs > >;
	pickedAt: string;
	timezone: string;
	accountIds: string[];
} ): Schedule {
	// "Now" is never remembered: a preference that publishes on the next
	// click, on whatever article is open, is too easy to trip over.
	const [ publishNow, setPublishNow ] = useState( false );
	const when: When = publishNow ? 'now' : prefs.when;
	const nextSlot = useNextSlot( when === 'next', accountIds );
	// A picked time is the article's; until one is picked, offer tomorrow
	// morning without storing it.
	const at =
		pickedAt || ( when === 'at' ? defaultScheduleTime( timezone ) : '' );

	const choose = ( next: When ) => {
		setPublishNow( next === 'now' );
		if ( next !== 'now' ) {
			updatePrefs( { when: next } );
		}
	};

	return {
		when,
		choose,
		nextSlot,
		at,
		ready:
			( when !== 'at' || at !== '' ) &&
			( when !== 'next' || ! nextSlot.error ),
		reset: () => setPublishNow( false ),
	};
}
