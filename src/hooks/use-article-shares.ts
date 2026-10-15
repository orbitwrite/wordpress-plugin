/**
 * Everything about an article's posts, read and kept up to date together.
 */
import { useMemo } from '@wordpress/element';

import type { Numbers } from '../lib/types';
import { useShareNumbers } from './use-share-numbers';
import { useShares } from './use-shares';
import type { Sent } from './use-shares';
import { useWatchOnPublish } from './use-watch-on-publish';

/** An article's posts and how the published ones did. */
export interface ArticleShares {
	sent: Sent;
	numbers: Numbers;
}

/**
 * An article's posts, their numbers, and watching them as the article is
 * published.
 *
 * @param postId        0 to read nothing.
 * @param articleStatus The article's status in the editor.
 * @param readNumbers   Whether to read the numbers (only while connected).
 * @return `{ sent, numbers }`, stable while neither changes.
 */
export function useArticleShares(
	postId: number,
	articleStatus: string | undefined,
	readNumbers: boolean = true
): ArticleShares {
	const sent = useShares( postId );
	const numbers = useShareNumbers( readNumbers ? postId : 0, sent.shares );
	useWatchOnPublish( articleStatus, sent.watchPublishing );
	return useMemo( () => ( { sent, numbers } ), [ sent, numbers ] );
}
