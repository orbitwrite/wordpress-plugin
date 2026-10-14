/**
 * The article as the block editor holds it.
 */
import { store as coreStore } from '@wordpress/core-data';
import { useSelect } from '@wordpress/data';
import { store as editorStore } from '@wordpress/editor';
import { useMemo } from '@wordpress/element';

import { imageFromRest } from '../lib/media';
import type { RestMedia } from '../lib/media';
import type { Article } from '../lib/types';

/**
 * The post being edited: its id, and its title, link, status and featured
 * image as edited.
 *
 * @return `{ postId, article }`.
 */
export function useEditorArticle(): { postId: number; article: Article } {
	const { postId, title, link, status, featuredId } = useSelect(
		( select ) => {
			const store = select( editorStore );
			return {
				postId: Number( store.getCurrentPostId() ) || 0,
				title: store.getEditedPostAttribute( 'title' ),
				link:
					store.getPermalink() ||
					store.getEditedPostAttribute( 'link' ),
				status: store.getEditedPostAttribute( 'status' ),
				featuredId: store.getEditedPostAttribute(
					'featured_media'
				) as number,
			};
		},
		[]
	);
	const media = useSelect(
		( select ) =>
			featuredId ? select( coreStore ).getMedia( featuredId ) : null,
		[ featuredId ]
	);

	const featured = useMemo(
		() => imageFromRest( media as RestMedia | null ),
		[ media ]
	);
	const article = useMemo(
		() => ( { title, link, status, featured } ),
		[ title, link, status, featured ]
	);

	return { postId, article };
}
