/**
 * The article as the classic editor's form holds it.
 *
 * There is no editor store to read here, so the article is read from the
 * form as it changes: the title field, the permalink under it (rewritten
 * when a new post gets its slug), and the featured image box (replaced
 * whenever the image is set or removed).
 */
import { useEffect, useMemo, useState } from '@wordpress/element';

import { fetchImage } from '../lib/media';
import type { Article, Image } from '../lib/types';

/**
 * The permalink as the slug box shows it, which is the address the post has,
 * or will have once published.
 *
 * @param fallback
 * @return URL.
 */
function readPermalink( fallback: string ): string {
	const shown = document
		.querySelector( '#sample-permalink a' )
		?.textContent?.trim();
	return shown && /^https?:\/\//.test( shown ) ? shown : fallback;
}

/**
 * The featured image's attachment id, or 0.
 *
 * @return Id.
 */
function readThumbnailId(): number {
	const id = parseInt(
		document.querySelector< HTMLInputElement >( '#_thumbnail_id' )?.value ||
			'',
		10
	);
	return id > 0 ? id : 0;
}

/**
 * Re-read a value whenever an element's contents change.
 *
 * @param selector
 * @param read
 * @return The latest value.
 */
function useWatched< T >( selector: string, read: () => T ): T {
	const [ value, setValue ] = useState( read );
	useEffect( () => {
		const target = document.querySelector( selector );
		if ( ! target ) {
			return;
		}
		const observer = new window.MutationObserver( () =>
			setValue( read() )
		);
		observer.observe( target, {
			childList: true,
			subtree: true,
			characterData: true,
			attributes: true,
		} );
		return () => observer.disconnect();
	}, [] ); // eslint-disable-line react-hooks/exhaustive-deps
	return value;
}

/**
 * The title field's value as it's typed.
 *
 * @return Title.
 */
function useTitle(): string {
	const [ field ] = useState( () =>
		document.querySelector< HTMLInputElement >( '#title' )
	);
	const [ title, setTitle ] = useState( field?.value || '' );
	useEffect( () => {
		if ( ! field ) {
			return;
		}
		const onInput = () => setTitle( field.value );
		field.addEventListener( 'input', onInput );
		return () => field.removeEventListener( 'input', onInput );
	}, [ field ] );
	return title;
}

/**
 * The featured image, read whenever the box changes it.
 *
 * @return Image, or null.
 */
function useFeaturedImage(): Image | null {
	const thumbnailId = useWatched( '#postimagediv', readThumbnailId );
	const [ featured, setFeatured ] = useState< Image | null >( null );
	useEffect( () => {
		if ( ! thumbnailId ) {
			setFeatured( null );
			return;
		}
		let cancelled = false;
		fetchImage( thumbnailId )
			.then( ( image ) => ! cancelled && setFeatured( image ) )
			.catch( () => ! cancelled && setFeatured( null ) );
		return () => {
			cancelled = true;
		};
	}, [ thumbnailId ] );
	return featured;
}

/**
 * The article as the form currently has it.
 *
 * @param permalink The saved permalink, until the slug box shows one.
 * @param status    The saved status.
 * @return Article.
 */
export function useClassicArticle(
	permalink: string,
	status: string
): Article {
	const title = useTitle();
	const link = useWatched( '#edit-slug-box', () =>
		readPermalink( permalink )
	);
	const featured = useFeaturedImage();
	return useMemo(
		() => ( { title, link, status, featured } ),
		[ title, link, status, featured ]
	);
}
