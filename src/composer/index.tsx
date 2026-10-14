/**
 * The composer. Used by the block editor sidebar and the classic editor box
 * (with an article), and the admin page (without one).
 *
 * Editing, top to bottom:
 *
 * 1. **Main post**: text and an image. With an article it starts as the
 *    article's title, link and featured image, and follows the article until
 *    the person edits it.
 * 2. **Channels**: tick where it goes. Each picked channel shows its
 *    character count, anything stopping it from taking its content, and,
 *    once two are picked, a "Same as main post" checkbox. Unticking that
 *    opens the channel's own text and image under it, starting as a copy of
 *    the main post; such a channel goes out as its own post in Orbitwrite.
 * 3. **When**: next free slot, a date and time, or now.
 *
 * Laid out as plain sections (classic box, admin page) or as collapsible
 * panels, like every other block editor sidebar (`layout="panels"`).
 *
 * The unsent draft is kept per article, and the channels and timing per
 * person (see lib/draft.ts), so closing the sidebar or reloading loses
 * nothing and the next article starts with the usual channels.
 */
import { Notice, Spinner } from '@wordpress/components';
import { useEffect } from '@wordpress/element';

import { useConnection } from '../hooks/use-connection';
import type { Connection } from '../hooks/use-connection';
import type { Status } from '../lib/types';
import ConnectPrompt from './connect-prompt';
import Editing from './editing';
import type { ComposerProps } from './editing';

export type { ComposerProps };

/**
 * The composer with its own connection: the classic box and the admin page.
 *
 * @param props
 * @param props.onStatus Told the connection whenever it's read.
 */
export default function Composer( {
	onStatus = null,
	...props
}: ComposerProps & { onStatus?: ( ( status: Status ) => void ) | null } ) {
	const connection = useConnection();
	const { status } = connection;

	useEffect( () => {
		if ( onStatus && status ) {
			onStatus( status );
		}
	}, [ onStatus, status ] );

	return <ComposerView connection={ connection } { ...props } />;
}

/**
 * The composer, given a connection. The block editor holds the connection
 * and the article's posts above the sidebar, so its publish panels and Post
 * tab read the same ones and keep watching while the sidebar is closed.
 *
 * @param props
 * @param props.connection      From useConnection().
 * @param props.postId
 * @param props.article
 * @param props.articleState
 * @param props.layout
 * @param props.notify
 * @param props.showAutoShare
 * @param props.allowDisconnect
 */
export function ComposerView( {
	connection,
	postId = 0,
	article = null,
	articleState = null,
	layout = 'plain',
	notify = null,
	showAutoShare = true,
	allowDisconnect = true,
}: ComposerProps & { connection: Connection } ) {
	const { status, error } = connection;

	if ( error ) {
		return (
			<div className="orbitwrite-composer">
				<Notice status="error" isDismissible={ false }>
					{ error }
				</Notice>
			</div>
		);
	}

	if ( ! status ) {
		return (
			<div className="orbitwrite-composer">
				<Spinner />
			</div>
		);
	}

	if ( ! status.connected ) {
		return (
			<ConnectPrompt
				status={ status }
				connection={ connection }
				padded={ layout === 'panels' }
			/>
		);
	}

	// Stored drafts and picks belong to a site, a person and a workspace; and
	// a draft to an article. A change of any of them is a different editor.
	const scope = `${ status.draftScope }:${ status.organization?.id || '' }`;
	return (
		<Editing
			key={ `${ scope }:${ postId }` }
			scope={ scope }
			status={ status }
			connection={ connection }
			postId={ postId }
			article={ article }
			articleState={ articleState }
			layout={ layout }
			notify={ notify }
			showAutoShare={ showAutoShare }
			allowDisconnect={ allowDisconnect }
		/>
	);
}
