/**
 * Watching an article's posts as the editor publishes it.
 */
import { useEffect, useRef } from '@wordpress/element';

import type { Sent } from './use-shares';

/**
 * Start watching an article's posts when the editor publishes it: the
 * editor doesn't reload, and says "published" before the save reaches the
 * server, so auto-share's queued post only shows up a moment later.
 *
 * @param articleStatus   The article's status in the editor.
 * @param watchPublishing From useShares().
 */
export function useWatchOnPublish(
	articleStatus: string | undefined,
	watchPublishing: Sent[ 'watchPublishing' ]
): void {
	const previous = useRef( articleStatus );
	useEffect( () => {
		const was = previous.current;
		previous.current = articleStatus;
		if ( articleStatus === 'publish' && was && was !== 'publish' ) {
			watchPublishing( true );
		}
	}, [ articleStatus, watchPublishing ] );
}
