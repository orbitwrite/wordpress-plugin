/**
 * When to stop re-reading an article's posts. Pure.
 */

/**
 * Whether an article's posts are still on their way: one is publishing, or
 * auto-share has the article and hasn't sent it yet. Right after the editor
 * publishes, an article auto-share will take counts too: the editor says
 * "published" before the save reaches the server.
 *
 * @param {{shares: Object[], autoShare: Object|null}} answer        The shares route's.
 * @param {boolean}                                    justPublished Whether the editor just published it.
 * @return {boolean} Whether to look again.
 */
export function stillMoving( answer, justPublished = false ) {
	const auto = answer.autoShare;
	return (
		answer.shares.some( ( share ) => share.status === 'publishing' ) ||
		[ 'queued', 'sending' ].includes( auto?.state ) ||
		( justPublished && Boolean( auto?.pending && auto?.enabled ) )
	);
}
