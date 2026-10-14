/**
 * The composer's draft and the person's preferences, kept in the browser.
 */
import { useMemo } from '@wordpress/element';

import { useStored } from '../hooks/use-stored';
import {
	DEFAULT_PREFS,
	EMPTY_DRAFT,
	draftKey,
	prefsKey,
	worthKeeping,
} from '../lib/draft';
import type { Article } from '../lib/types';
import { useFollowArticle } from './use-follow-article';

/**
 * The unsent draft for an article (following the article until edited), the
 * main post it makes, and the person's channel and timing preferences.
 *
 * @param scope   Site, person and workspace.
 * @param postId  0 without an article.
 * @param article Null without one.
 * @return `{ draft, update, clear, main, prefs, updatePrefs }`.
 */
export function useComposerDraft(
	scope: string,
	postId: number,
	article: Article | null
) {
	const [ draft, update, clear ] = useStored(
		draftKey( scope, postId ),
		EMPTY_DRAFT,
		worthKeeping
	);
	const [ prefs, updatePrefs ] = useStored(
		prefsKey( scope ),
		DEFAULT_PREFS
	);
	useFollowArticle( article, draft, update );

	const main = useMemo(
		() => ( { text: draft.text, image: draft.image } ),
		[ draft.text, draft.image ]
	);

	return { draft, update, clear, main, prefs, updatePrefs };
}
