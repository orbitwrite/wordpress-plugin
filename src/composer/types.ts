/**
 * What the composer takes.
 */
import type { ArticleShares } from '../hooks/use-article-shares';
import type { Article, Notice } from '../lib/types';

/** What the composer is for, and how it's laid out. */
export interface ComposerProps {
	/** The article, when there is one. */
	postId?: number;
	/** `{ title, link, status, featured }`. */
	article?: Article | null;
	/** The article's posts, when the block editor holds them above. */
	articleState?: ArticleShares | null;
	layout?: 'plain' | 'panels';
	/** Says a send worked (a snackbar); a notice here otherwise. */
	notify?: ( ( notice: Notice ) => void ) | null;
	/** Offer the article's auto-share checkbox. */
	showAutoShare?: boolean;
	/** Offer Disconnect. */
	allowDisconnect?: boolean;
}
