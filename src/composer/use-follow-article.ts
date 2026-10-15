/**
 * Keeping the draft on the article until the person edits it.
 */
import { useEffect } from '@wordpress/element';

import type { Update } from '../hooks/use-stored';
import type { Draft } from '../lib/draft';
import { articleText } from '../lib/text';
import type { Article } from '../lib/types';

/**
 * Follow the article's title, link and featured image into the draft's text
 * and image, each until the person edits it.
 *
 * @param article Null without one.
 * @param draft
 * @param update
 */
export function useFollowArticle(
	article: Article | null,
	draft: Readonly< Draft >,
	update: Update< Readonly< Draft > >
): void {
	const defaultText = article
		? articleText( article.title, article.link )
		: null;
	useEffect( () => {
		if (
			defaultText !== null &&
			! draft.textTouched &&
			draft.text !== defaultText
		) {
			update( { text: defaultText } );
		}
	}, [ defaultText, draft.textTouched, draft.text, update ] );

	const featured = article?.featured || null;
	useEffect( () => {
		if (
			article &&
			! draft.imageTouched &&
			( draft.image?.id !== featured?.id ||
				draft.image?.url !== featured?.url ||
				draft.image?.width !== featured?.width )
		) {
			update( { image: featured } );
		}
		// Watching the draft's image too: starting over clears it, and the
		// featured image has to come back even though it didn't change.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [
		featured?.id,
		featured?.url,
		featured?.width,
		draft.image?.id,
		draft.image?.url,
		draft.image?.width,
		draft.imageTouched,
	] );
}
