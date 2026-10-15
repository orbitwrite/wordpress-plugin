/**
 * Opening the "Share on Orbitwrite" sidebar.
 */
import { useDispatch, useSelect } from '@wordpress/data';
import { store as editorStore } from '@wordpress/editor';
import { useCallback, useEffect, useRef } from '@wordpress/element';

export const SIDEBAR = 'orbitwrite-sidebar';

/** The sidebar as the interface store names it. */
const AREA = `orbitwrite/${ SIDEBAR }`;

/**
 * A way to open the sidebar (from the publish panel too), and opening it
 * once on load when the Posts list's "Share on Orbitwrite" link asks.
 *
 * @return Opens the sidebar.
 */
export function useSidebar(): () => void {
	const { closePublishSidebar } = useDispatch( editorStore );
	const { enableComplementaryArea } = useDispatch( 'core/interface' );

	const open = useCallback( () => {
		closePublishSidebar();
		enableComplementaryArea( 'core', AREA );
	}, [ closePublishSidebar, enableComplementaryArea ] );

	// Only once the editor has put up its own default sidebar (the Post
	// tab), or it replaces ours a moment later.
	const settled = useSelect( ( select ) => {
		const ui = select( 'core/interface' ) as {
			isComplementaryAreaLoading?: ( scope: string ) => boolean;
		};
		return ! ui.isComplementaryAreaLoading?.( 'core' );
	}, [] );
	const openOnLoad = useRef(
		new window.URLSearchParams( window.location.search ).get(
			'orbitwrite'
		) === 'share'
	);
	useEffect( () => {
		if ( openOnLoad.current && settled ) {
			openOnLoad.current = false;
			enableComplementaryArea( 'core', AREA );
		}
	}, [ settled, enableComplementaryArea ] );

	return open;
}
