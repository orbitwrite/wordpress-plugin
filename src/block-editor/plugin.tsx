/**
 * Orbitwrite in the block editor: the "Share on Orbitwrite" sidebar, a panel
 * in the Post tab, and panels before and after publishing.
 *
 * The connection and the article's posts are held here, above the sidebar,
 * so every panel reads the same ones and watching a post that is publishing
 * carries on while the sidebar is closed.
 */
import {
	PluginDocumentSettingPanel,
	PluginPostPublishPanel,
	PluginPrePublishPanel,
	PluginSidebar,
	PluginSidebarMoreMenuItem,
} from '@wordpress/editor';
import { useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';

import AutoShareToggle from '../components/auto-share-toggle';
import { ComposerView } from '../composer';
import { useArticleShares } from '../hooks/use-article-shares';
import { useConnection } from '../hooks/use-connection';
import { autoSharePending } from '../lib/shares';
import { AfterPublishPanel, DocumentPanel } from './article-panels';
import { useEditorArticle } from './use-editor-article';
import { SIDEBAR, useSidebar } from './use-sidebar';
import { useSnackbar } from './use-snackbar';

export default function Orbitwrite() {
	const { postId, article } = useEditorArticle();
	const connection = useConnection();
	const connected = Boolean( connection.status?.connected );
	const articleState = useArticleShares( postId, article.status, connected );
	const { sent, numbers } = articleState;

	const openSidebar = useSidebar();
	const notify = useSnackbar( connection );
	const [ toggleError, setToggleError ] = useState< string | null >( null );

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
						settingsUrl={ connection.status?.autoShareUrl ?? '' }
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
