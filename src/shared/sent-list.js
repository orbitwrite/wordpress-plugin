/**
 * What was sent to Orbitwrite from this article.
 */
import {
	DropdownMenu,
	ExternalLink,
	MenuGroup,
	MenuItem,
} from '@wordpress/components';
import { __ } from '@wordpress/i18n';

import { numberPhrases } from './numbers';
import { formatInstant } from './time';

/**
 * A share's state in words.
 *
 * @param {Object} share
 * @return {string} Label.
 */
export function statusLabel( share ) {
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
 * @param {Object|undefined} totals Undefined until read.
 * @return {string|null} Line.
 */
export function numbersLine( totals ) {
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

export default function SentList( {
	shares,
	numbers = {},
	channels,
	timezone,
	onDelete,
	showLabel = true,
} ) {
	const nameOf = ( id ) => {
		const channel = channels.find( ( item ) => item.id === id );
		return channel
			? channel.displayName || channel.handle || channel.platformName
			: null;
	};

	return (
		<div className="orbitwrite-sent">
			{ showLabel && (
				<p className="orbitwrite-composer__label">
					{ __( 'Sent from this article', 'orbitwrite' ) }
				</p>
			) }
			<ul>
				{ shares.map( ( share ) => (
					<li key={ share.groupId } className="orbitwrite-sent__item">
						<div className="orbitwrite-sent__head">
							<span
								className={ `orbitwrite-pill is-${
									share.lastError &&
									share.status !== 'published'
										? 'failed'
										: share.status
								}` }
							>
								{ statusLabel( share ) }
							</span>
							{ share.scheduledAt &&
								share.status !== 'published' && (
									<span className="orbitwrite-sent__when">
										{ formatInstant(
											share.scheduledAt,
											timezone
										) }
									</span>
								) }
							{ ( share.openUrl || share.canDelete ) && (
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
													{ __(
														'Open in Orbitwrite',
														'orbitwrite'
													) }
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
													{ __(
														'Delete',
														'orbitwrite'
													) }
												</MenuItem>
											) }
										</MenuGroup>
									) }
								</DropdownMenu>
							) }
						</div>
						<p className="orbitwrite-sent__channels">
							{ share.accountIds
								.map( nameOf )
								.filter( Boolean )
								.join( ', ' ) }
							{ share.ownVersion && (
								<span className="orbitwrite-sent__tag">
									{ __( 'Own version', 'orbitwrite' ) }
								</span>
							) }
						</p>
						{ share.excerpt && (
							<p className="orbitwrite-sent__excerpt">
								{ share.excerpt }
							</p>
						) }
						{ share.status === 'published' &&
							numbersLine( numbers[ share.groupId ] ) && (
								<p className="orbitwrite-sent__numbers">
									{ numbersLine( numbers[ share.groupId ] ) }
								</p>
							) }
						{ share.lastError && share.status !== 'published' && (
							<p className="orbitwrite-sent__error">
								{ share.lastError }
							</p>
						) }
						{ share.links.length > 0 && (
							<p className="orbitwrite-composer__row">
								{ share.links.map( ( link ) => (
									<ExternalLink
										key={ link.url }
										href={ link.url }
									>
										{ link.handle || link.platform }
									</ExternalLink>
								) ) }
							</p>
						) }
					</li>
				) ) }
			</ul>
		</div>
	);
}
