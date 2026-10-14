/**
 * When to stop re-reading an article's posts. Pure.
 */
import type { SharesAnswer } from './types';

/**
 * Whether an article's posts are still on their way: one is publishing, or
 * auto-share has the article and hasn't sent it yet. Right after the editor
 * publishes, an article auto-share will take counts too: the editor says
 * "published" before the save reaches the server.
 *
 * @param answer        The shares route's.
 * @param justPublished Whether the editor just published it.
 * @return Whether to look again.
 */
export function stillMoving(
	answer: Pick< SharesAnswer, 'shares' | 'autoShare' >,
	justPublished: boolean = false
): boolean {
	const auto = answer.autoShare;
	return (
		answer.shares.some( ( share ) => share.status === 'publishing' ) ||
		auto?.state === 'queued' ||
		auto?.state === 'sending' ||
		( justPublished && Boolean( auto?.pending && auto?.enabled ) )
	);
}
