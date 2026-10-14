/**
 * The channels a post goes to. Picking a channel shows its character count
 * and a "Same as main post" checkbox; unticking that opens the channel's own
 * text and image right there, under the channel it belongs to. Anything
 * stopping a channel from taking its content is said on the channel.
 */
import { Button, ExternalLink, TextareaControl } from '@wordpress/components';
import { useState } from '@wordpress/element';
import { __, _n, sprintf } from '@wordpress/i18n';

import ImageField from './image-field';
import {
	channelNotes,
	channelProblems,
	isPostable,
	measure,
	unavailableReason,
} from './rules';
import {
	backToMainPost,
	contentFor,
	copyMainPost,
	editVersion,
	giveOwnVersion,
	hasOwnVersion,
} from './versions';
import type { Channel, Content, Versions } from './types';
import { CheckboxControl } from './wp-components';

/**
 * A channel's display name.
 *
 * @param channel
 * @return Name.
 */
export function channelName( channel: Channel ): string {
	return channel.displayName || channel.handle || channel.platformName;
}

/**
 * How a channel's own version is labelled: by network ("Text for Bluesky"),
 * adding the account only when the workspace has two on that network.
 *
 * @param channel
 * @param channels Every channel listed.
 * @return Label.
 */
export function versionLabel( channel: Channel, channels: Channel[] ): string {
	const sameNetwork = channels.filter(
		( other ) => other.platform === channel.platform
	).length;
	return sameNetwork > 1
		? sprintf(
				/* translators: 1: account name, 2: network name. */
				__( 'Text for %1$s on %2$s', 'orbitwrite' ),
				channelName( channel ),
				channel.platformName
		  )
		: sprintf(
				/* translators: %s: network name. */
				__( 'Text for %s', 'orbitwrite' ),
				channel.platformName
		  );
}

interface Props {
	channels: Channel[];
	selected: string[];
	onSelect: ( id: string, checked: boolean ) => void;
	main: Content;
	versions: Versions;
	onVersions: ( versions: Versions ) => void;
	appUrl: string;
}

export default function ChannelList( {
	channels,
	selected,
	onSelect,
	main,
	versions,
	onVersions,
	appUrl,
}: Props ) {
	const [ showUnavailable, setShowUnavailable ] = useState( false );

	if ( channels.length === 0 ) {
		return (
			<p>
				{ __(
					'This workspace has no channels yet. Connect one in Orbitwrite.',
					'orbitwrite'
				) }{ ' ' }
				<ExternalLink href={ appUrl }>
					{ __( 'Open Orbitwrite', 'orbitwrite' ) }
				</ExternalLink>
			</p>
		);
	}

	// With one channel picked there is nothing to differ from, so the
	// choice only appears once there are two (or the channel already has a
	// version of its own, so it can be put back).
	const several = selected.length > 1;

	// Channels that can't be picked (reconnect, video only) are folded into
	// one line: each says why once shown, but a list of them shouldn't push
	// the channels that can be picked off the screen. One already picked
	// stays visible, so it can be unticked.
	const unavailable = channels.filter(
		( channel ) =>
			! isPostable( channel ) && ! selected.includes( channel.id )
	);
	const listed = channels.filter(
		( channel ) => ! unavailable.includes( channel )
	);

	const row = ( channel: Channel ) => {
		const isSelected = selected.includes( channel.id );
		const own = hasOwnVersion( versions, channel.id );
		const content = contentFor( main, versions, channel.id );
		const { count, limit, over } = measure( channel, content );
		const problems = isSelected
			? channelProblems( channel, content, own )
			: [];
		const notes = isSelected ? channelNotes( channel, content ) : [];

		return (
			<div
				key={ channel.id }
				className={ [
					'orbitwrite-channel-row',
					isSelected ? 'is-selected' : '',
					own ? 'has-own-version' : '',
					problems.length ? 'has-problems' : '',
				].join( ' ' ) }
			>
				<div className="orbitwrite-channel-row__head">
					<CheckboxControl
						__nextHasNoMarginBottom
						disabled={ ! isPostable( channel ) }
						checked={ isSelected }
						onChange={ ( checked ) =>
							onSelect( channel.id, checked )
						}
						label={ <ChannelLabel channel={ channel } /> }
						help={ unavailableReason( channel ) }
					/>
					{ isSelected && limit && (
						<span
							className={
								over
									? 'orbitwrite-channel-row__count is-over'
									: 'orbitwrite-channel-row__count'
							}
						>
							{ `${ count }/${ limit }` }
						</span>
					) }
				</div>

				{ isSelected && ( several || own ) && (
					<div className="orbitwrite-channel-row__body">
						<CheckboxControl
							__nextHasNoMarginBottom
							label={ __( 'Same as main post', 'orbitwrite' ) }
							checked={ ! own }
							onChange={ ( same ) =>
								onVersions(
									same
										? backToMainPost( versions, channel.id )
										: giveOwnVersion(
												versions,
												channel.id,
												main
										  )
								)
							}
							help={
								own
									? __(
											'Goes out as its own post in Orbitwrite, with the text and image below.',
											'orbitwrite'
									  )
									: undefined
							}
						/>
						{ own && (
							<div className="orbitwrite-channel-row__version">
								<TextareaControl
									__nextHasNoMarginBottom
									label={ versionLabel( channel, channels ) }
									value={ content.text }
									rows={ 5 }
									onChange={ ( text ) =>
										onVersions(
											editVersion( versions, channel.id, {
												text,
											} )
										)
									}
								/>
								<ImageField
									image={ content.image }
									onChange={ ( image ) =>
										onVersions(
											editVersion( versions, channel.id, {
												image,
											} )
										)
									}
								/>
								<Button
									variant="link"
									onClick={ () =>
										onVersions(
											copyMainPost(
												versions,
												channel.id,
												main
											)
										)
									}
								>
									{ __(
										'Start again from main post',
										'orbitwrite'
									) }
								</Button>
							</div>
						) }
					</div>
				) }

				{ problems.length > 0 && (
					<ul className="orbitwrite-channel-row__problems">
						{ problems.map( ( problem ) => (
							<li key={ problem }>{ problem }</li>
						) ) }
					</ul>
				) }
				{ notes.length > 0 && (
					<ul className="orbitwrite-channel-row__notes">
						{ notes.map( ( note ) => (
							<li key={ note }>{ note }</li>
						) ) }
					</ul>
				) }
			</div>
		);
	};

	return (
		<>
			{ listed.map( row ) }
			{ unavailable.length > 0 && (
				<>
					<Button
						variant="link"
						className="orbitwrite-channel-list__more"
						aria-expanded={ showUnavailable }
						onClick={ () =>
							setShowUnavailable( ! showUnavailable )
						}
					>
						{ showUnavailable
							? __( 'Hide unavailable channels', 'orbitwrite' )
							: sprintf(
									/* translators: %d: number of channels. */
									_n(
										'%d channel unavailable',
										'%d channels unavailable',
										unavailable.length,
										'orbitwrite'
									),
									unavailable.length
							  ) }
					</Button>
					{ showUnavailable && unavailable.map( row ) }
				</>
			) }
		</>
	);
}

/**
 * A channel as it's shown wherever one is picked: avatar, name, network.
 *
 * @param props
 * @param props.channel
 */
export function ChannelLabel( { channel }: { channel: Channel } ) {
	return (
		<span className="orbitwrite-channel">
			{ channel.avatarUrl && (
				<img
					src={ channel.avatarUrl }
					alt=""
					className="orbitwrite-channel__avatar"
				/>
			) }
			<span className="orbitwrite-channel__name">
				{ channelName( channel ) }
			</span>
			<span className="orbitwrite-channel__platform">
				{ channel.platformName }
			</span>
		</span>
	);
}
