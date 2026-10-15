/**
 * What an article's posts, and auto-share, are up to. Pure.
 */
import { __ } from '@wordpress/i18n';

import { numberPhrases } from './numbers';
import type { ArticleAutoShare, Share, SharesAnswer, Totals } from './types';

/**
 * Whether a post failed to go out (a published one keeps its last error).
 *
 * @param share
 * @return Whether.
 */
export function isFailed( share: Share ): boolean {
	return Boolean( share.lastError ) && share.status !== 'published';
}

/**
 * A share's state in words.
 *
 * @param share
 * @return Label.
 */
export function statusLabel( share: Share ): string {
	if (
		share.bucket === 'needs_approval' ||
		share.status === 'pending_approval'
	) {
		return __( 'Waiting for approval', 'orbitwrite' );
	}
	if ( share.bucket === 'needs_revision' ) {
		return __( 'Changes requested', 'orbitwrite' );
	}
	switch ( share.status ) {
		case 'publishing':
			return __( 'Publishing', 'orbitwrite' );
		case 'published':
			return __( 'Published', 'orbitwrite' );
		case 'planned':
			return __( 'Planned', 'orbitwrite' );
		case 'draft':
			return share.lastError
				? __( 'Failed', 'orbitwrite' )
				: __( 'Draft', 'orbitwrite' );
		default:
			return __( 'Scheduled', 'orbitwrite' );
	}
}

/**
 * A published post's numbers, or a line saying they're on their way.
 *
 * @param totals Undefined until read.
 * @return Line.
 */
export function numbersLine( totals: Totals | undefined ): string | null {
	if ( totals === undefined ) {
		return null;
	}
	const phrases = numberPhrases( totals );
	return phrases.length
		? phrases.join( ' · ' )
		: __(
				'Numbers appear here once the networks report them.',
				'orbitwrite'
		  );
}

/**
 * Whether auto-share has the article and is sending it.
 *
 * @param autoShare
 * @return Whether.
 */
export function isAutoSharing(
	autoShare: ArticleAutoShare | null | undefined
): boolean {
	return autoShare?.state === 'queued' || autoShare?.state === 'sending';
}

/**
 * Whether the article's auto-share checkbox applies: auto-share will take
 * the article, and nobody has shared it by hand (which takes over from
 * auto-share).
 *
 * @param answer What the shares route said.
 * @return Whether.
 */
export function autoSharePending(
	answer: Pick< SharesAnswer, 'autoShare' | 'shares' >
): boolean {
	return Boolean( answer.autoShare?.pending && answer.shares.length === 0 );
}

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
		isAutoSharing( auto ) ||
		( justPublished && Boolean( auto?.pending && auto?.enabled ) )
	);
}
