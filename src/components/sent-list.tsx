/**
 * What was sent to Orbitwrite from this article.
 */
import { DropdownMenu, MenuGroup } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

import { channelNames } from '../lib/channels';
import { isFailed, numbersLine } from '../lib/shares';
import { formatInstant } from '../lib/time';
import type { Channel, Numbers, Share } from '../lib/types';
import { PlatformLinks } from './links';
import StatusPill from './status-pill';
import { MenuItem } from './wp-components';

/**
 * A post's "More actions" menu: open it in Orbitwrite, delete it.
 *
 * @param props
 * @param props.share
 * @param props.onDelete
 */
function ShareActions( {
	share,
	onDelete,
}: {
	share: Share;
	onDelete: ( share: Share ) => void;
} ) {
	if ( ! share.openUrl && ! share.canDelete ) {
		return null;
	}
	return (
		<DropdownMenu
			icon="ellipsis"
			label={ __( 'More actions', 'orbitwrite' ) }
			className="orbitwrite-sent__menu"
			popoverProps={ { placement: 'bottom-end' } }
		>
			{ ( { onClose } ) => (
				<MenuGroup>
					{ share.openUrl && (
						<MenuItem
							href={ share.openUrl }
							target="_blank"
							rel="noopener noreferrer"
							onClick={ onClose }
						>
							{ __( 'Open in Orbitwrite', 'orbitwrite' ) }
						</MenuItem>
					) }
					{ share.canDelete && (
						<MenuItem
							isDestructive
							onClick={ () => {
								onClose();
								onDelete( share );
							} }
						>
							{ __( 'Delete', 'orbitwrite' ) }
						</MenuItem>
					) }
				</MenuGroup>
			) }
		</DropdownMenu>
	);
}

interface ItemProps {
	share: Share;
	numbers: Numbers;
	channels: Channel[];
	timezone: string;
	onDelete: ( share: Share ) => void;
}

function SentItem( {
	share,
	numbers,
	channels,
	timezone,
	onDelete,
}: ItemProps ) {
	const published = share.status === 'published';
	const line = published ? numbersLine( numbers[ share.groupId ] ) : null;

	return (
		<li className="orbitwrite-sent__item">
			<div className="orbitwrite-sent__head">
				<StatusPill share={ share } />
				{ share.scheduledAt && ! published && (
					<span className="orbitwrite-sent__when">
						{ formatInstant( share.scheduledAt, timezone ) }
					</span>
				) }
				<ShareActions share={ share } onDelete={ onDelete } />
			</div>
			<p className="orbitwrite-sent__channels">
				{ channelNames( share.accountIds, channels ).join( ', ' ) }
				{ share.ownVersion && (
					<span className="orbitwrite-sent__tag">
						{ __( 'Own version', 'orbitwrite' ) }
					</span>
				) }
			</p>
			{ share.excerpt && (
				<p className="orbitwrite-sent__excerpt">{ share.excerpt }</p>
			) }
			{ line && <p className="orbitwrite-sent__numbers">{ line }</p> }
			{ isFailed( share ) && (
				<p className="orbitwrite-sent__error">{ share.lastError }</p>
			) }
			{ share.links.length > 0 && (
				<p className="orbitwrite-composer__row">
					<PlatformLinks links={ share.links } />
				</p>
			) }
		</li>
	);
}

interface Props {
	shares: Share[];
	numbers?: Numbers;
	channels: Channel[];
	timezone: string;
	onDelete: ( share: Share ) => void;
	showLabel?: boolean;
}

export default function SentList( {
	shares,
	numbers = {},
	channels,
	timezone,
	onDelete,
	showLabel = true,
}: Props ) {
	return (
		<div className="orbitwrite-sent">
			{ showLabel && (
				<p className="orbitwrite-composer__label">
					{ __( 'Sent from this article', 'orbitwrite' ) }
				</p>
			) }
			<ul>
				{ shares.map( ( share ) => (
					<SentItem
						key={ share.groupId }
						share={ share }
						numbers={ numbers }
						channels={ channels }
						timezone={ timezone }
						onDelete={ onDelete }
					/>
				) ) }
			</ul>
		</div>
	);
}
