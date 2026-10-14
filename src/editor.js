/**
 * Orbitwrite in the block editor: the "Share on Orbitwrite" sidebar, a panel
 * in the Post tab, and panels before and after publishing.
 *
 * The connection and the article's posts are held here, above the sidebar,
 * so every panel reads the same ones and watching a post that is publishing
 * carries on while the sidebar is closed.
 */
import { store as coreStore } from '@wordpress/core-data';
import { useDispatch, useSelect } from '@wordpress/data';
import {
	PluginDocumentSettingPanel,
	PluginPostPublishPanel,
	PluginPrePublishPanel,
	PluginSidebar,
	PluginSidebarMoreMenuItem,
	store as editorStore,
} from '@wordpress/editor';
import {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { store as noticesStore } from '@wordpress/notices';
import { registerPlugin } from '@wordpress/plugins';

import { AfterPublishPanel, DocumentPanel } from './shared/article-panels';
import AutoShareToggle, { autoSharePending } from './shared/auto-share-toggle';
import { ComposerView } from './shared/composer';
import {
	useConnection,
	useShareNumbers,
	useShares,
	useWatchOnPublish,
} from './shared/hooks';
import './shared/composer.scss';

const SIDEBAR = 'orbitwrite-sidebar';

function Orbitwrite() {
	const postId = useSelect(
		( select ) => select( editorStore ).getCurrentPostId(),
		[]
	);
	const title = useSelect(
		( select ) => select( editorStore ).getEditedPostAttribute( 'title' ),
		[]
	);
	const link = useSelect( ( select ) => {
		const store = select( editorStore );
		return store.getPermalink() || store.getEditedPostAttribute( 'link' );
	}, [] );
	const status = useSelect(
		( select ) => select( editorStore ).getEditedPostAttribute( 'status' ),
		[]
	);
	const featuredId = useSelect(
		( select ) =>
			select( editorStore ).getEditedPostAttribute( 'featured_media' ),
		[]
	);
	const media = useSelect(
		( select ) =>
			featuredId ? select( coreStore ).getMedia( featuredId ) : null,
		[ featuredId ]
	);

	const featuredUrl =
		media?.media_details?.sizes?.medium?.source_url || media?.source_url;
	const featuredAlt = media?.alt_text || '';
	const featuredMime = media?.mime_type || '';
	const featuredWidth = media?.media_details?.width || 0;
	const featuredHeight = media?.media_details?.height || 0;

	const article = useMemo(
		() => ( {
			title,
			link,
			status,
			featured:
				featuredId && featuredUrl
					? {
							id: featuredId,
							url: featuredUrl,
							alt: featuredAlt,
							mime: featuredMime,
							width: featuredWidth,
							height: featuredHeight,
					  }
					: null,
		} ),
		[
			title,
			link,
			status,
			featuredId,
			featuredUrl,
			featuredAlt,
			featuredMime,
			featuredWidth,
			featuredHeight,
		]
	);

	const connection = useConnection();
	const connected = Boolean( connection.status?.connected );
	const sent = useShares( postId );
	const numbers = useShareNumbers( connected ? postId : 0, sent.shares );
	useWatchOnPublish( status, sent.watchPublishing );
	const articleState = useMemo(
		() => ( { sent, numbers } ),
		[ sent, numbers ]
	);

	const { createNotice } = useDispatch( noticesStore );
	const { closePublishSidebar } = useDispatch( editorStore );
	const { enableComplementaryArea } = useDispatch( 'core/interface' );
	const openSidebar = useCallback( () => {
		closePublishSidebar();
		enableComplementaryArea( 'core', `orbitwrite/${ SIDEBAR }` );
	}, [ closePublishSidebar, enableComplementaryArea ] );

	// "Share on Orbitwrite" in the Posts list lands here with the sidebar
	// open. Only once the editor has put up its own default sidebar (the Post
	// tab), or it replaces ours a moment later.
	const sidebarSettled = useSelect( ( select ) => {
		const ui = select( 'core/interface' );
		return ! ui.isComplementaryAreaLoading?.( 'core' );
	}, [] );
	const openOnLoad = useRef(
		new window.URLSearchParams( window.location.search ).get(
			'orbitwrite'
		) === 'share'
	);
	useEffect( () => {
		if ( openOnLoad.current && sidebarSettled ) {
			openOnLoad.current = false;
			enableComplementaryArea( 'core', `orbitwrite/${ SIDEBAR }` );
		}
	}, [ sidebarSettled, enableComplementaryArea ] );

	// Confirmations are the editor's own snackbars, like "Post published".
	const notify = useCallback(
		( { type, message, openUrl } ) =>
			createNotice( type === 'error' ? 'error' : 'success', message, {
				type: 'snackbar',
				actions: openUrl
					? [
							{
								label: __( 'Open in Orbitwrite', 'orbitwrite' ),
								onClick: () =>
									window.open(
										openUrl,
										'_blank',
										'noopener'
									),
							},
					  ]
					: [],
			} ),
		[ createNotice ]
	);
	// A notice the connect flow left ("Connected to Acme") is one too.
	const { notice, setNotice } = connection;
	useEffect( () => {
		if ( notice ) {
			notify( notice );
			setNotice( null );
		}
	}, [ notice, notify, setNotice ] );

	const [ toggleError, setToggleError ] = useState( null );

	return (
		<>
			<PluginSidebarMoreMenuItem target={ SIDEBAR } icon="share">
				{ __( 'Share on Orbitwrite', 'orbitwrite' ) }
			</PluginSidebarMoreMenuItem>
			<PluginSidebar
				name={ SIDEBAR }
				title={ __( 'Share on Orbitwrite', 'orbitwrite' ) }
				icon="share"
			>
				<ComposerView
					connection={ connection }
					postId={ postId }
					article={ article }
					articleState={ articleState }
					layout="panels"
					notify={ notify }
					allowDisconnect={ false }
				/>
			</PluginSidebar>

			<PluginDocumentSettingPanel
				name="orbitwrite-status"
				title={ __( 'Orbitwrite', 'orbitwrite' ) }
				icon="share"
			>
				<DocumentPanel
					connection={ connection }
					postId={ postId }
					sent={ sent }
					numbers={ numbers }
					onOpen={ openSidebar }
				/>
			</PluginDocumentSettingPanel>

			{ connected && autoSharePending( sent ) && (
				<PluginPrePublishPanel
					title={ __( 'Orbitwrite', 'orbitwrite' ) }
					icon="share"
					initialOpen
				>
					<AutoShareToggle
						postId={ postId }
						sent={ sent }
						settingsUrl={ connection.status.autoShareUrl }
						onError={ setToggleError }
					/>
					{ toggleError && <p role="alert">{ toggleError }</p> }
				</PluginPrePublishPanel>
			) }

			{ connected && (
				<PluginPostPublishPanel
					title={ __( 'Share on Orbitwrite', 'orbitwrite' ) }
					icon="share"
					initialOpen
				>
					<AfterPublishPanel
						sent={ sent }
						numbers={ numbers }
						onOpen={ openSidebar }
					/>
				</PluginPostPublishPanel>
			) }
		</>
	);
}

registerPlugin( 'orbitwrite', { render: Orbitwrite } );
