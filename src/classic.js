/**
 * "Share on Orbitwrite" on the classic editor's screen (the Classic Editor
 * plugin, or a post type without the block editor).
 *
 * The same composer as the block editor sidebar. There is no editor store to
 * read here, so the article is read from the form as it changes: the title
 * field, the permalink under it (rewritten when a new post gets its slug),
 * and the featured image box (replaced whenever the image is set or removed).
 */
import apiFetch from '@wordpress/api-fetch';
import domReady from '@wordpress/dom-ready';
import { createRoot, useEffect, useMemo, useState } from '@wordpress/element';

import Composer from './shared/composer';
import './shared/composer.scss';

/**
 * The permalink as the slug box shows it, which is the address the post has,
 * or will have once published.
 *
 * @param {string} fallback
 * @return {string} URL.
 */
function readPermalink( fallback ) {
	const shown = document
		.querySelector( '#sample-permalink a' )
		?.textContent?.trim();
	return shown && /^https?:\/\//.test( shown ) ? shown : fallback;
}

/**
 * The featured image's attachment id, or 0.
 *
 * @return {number} Id.
 */
function readThumbnailId() {
	const id = parseInt(
		document.getElementById( '_thumbnail_id' )?.value || '',
		10
	);
	return id > 0 ? id : 0;
}

/**
 * Re-read a value whenever an element's contents change.
 *
 * @param {string}   selector
 * @param {Function} read
 * @return {*} The latest value.
 */
function useWatched( selector, read ) {
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

function ClassicPanel( { postId, permalink, status } ) {
	const titleField = document.getElementById( 'title' );
	const [ title, setTitle ] = useState( titleField?.value || '' );
	useEffect( () => {
		if ( ! titleField ) {
			return;
		}
		const onInput = () => setTitle( titleField.value );
		titleField.addEventListener( 'input', onInput );
		return () => titleField.removeEventListener( 'input', onInput );
	}, [ titleField ] );

	const link = useWatched( '#edit-slug-box', () =>
		readPermalink( permalink )
	);
	const thumbnailId = useWatched( '#postimagediv', readThumbnailId );

	const [ featured, setFeatured ] = useState( null );
	useEffect( () => {
		if ( ! thumbnailId ) {
			setFeatured( null );
			return;
		}
		let cancelled = false;
		apiFetch( { path: `/wp/v2/media/${ thumbnailId }` } )
			.then( ( media ) => {
				if ( ! cancelled ) {
					setFeatured( {
						id: media.id,
						url:
							media.media_details?.sizes?.medium?.source_url ||
							media.source_url,
						alt: media.alt_text || '',
						mime: media.mime_type || '',
						width: media.media_details?.width || 0,
						height: media.media_details?.height || 0,
					} );
				}
			} )
			.catch( () => ! cancelled && setFeatured( null ) );
		return () => {
			cancelled = true;
		};
	}, [ thumbnailId ] );

	const article = useMemo(
		() => ( { title, link, status, featured } ),
		[ title, link, status, featured ]
	);

	return <Composer postId={ postId } article={ article } />;
}

domReady( () => {
	const root = document.getElementById( 'orbitwrite-classic' );
	if ( ! root ) {
		return;
	}
	createRoot( root ).render(
		<ClassicPanel
			postId={ parseInt( root.dataset.postId, 10 ) || 0 }
			permalink={ root.dataset.permalink || '' }
			status={ root.dataset.status || 'draft' }
		/>
	);
} );
