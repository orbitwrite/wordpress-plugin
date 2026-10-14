/**
 * One channel in the list: its checkbox and count, its own version once it
 * has one, and anything stopping it from taking its content.
 */
import ChannelLabel from '../components/channel-label';
import { CheckboxControl } from '../components/wp-components';
import {
	channelNotes,
	channelProblems,
	isPostable,
	measure,
	unavailableReason,
} from '../lib/rules';
import type { Channel, Content, Versions } from '../lib/types';
import { contentFor, hasOwnVersion } from '../lib/versions';
import ChannelVersion from './channel-version';

interface Props {
	channel: Channel;
	/** Every channel listed. */
	channels: Channel[];
	isSelected: boolean;
	/** Whether "Same as main post" is offered (two or more picked). */
	offerVersion: boolean;
	onSelect: ( id: string, checked: boolean ) => void;
	main: Content;
	versions: Versions;
	onVersions: ( versions: Versions ) => void;
}

/**
 * Sentences in a list, or nothing when there are none.
 *
 * @param props
 * @param props.items
 * @param props.className
 */
function Sentences( {
	items,
	className,
}: {
	items: string[];
	className: string;
} ) {
	if ( ! items.length ) {
		return null;
	}
	return (
		<ul className={ className }>
			{ items.map( ( item ) => (
				<li key={ item }>{ item }</li>
			) ) }
		</ul>
	);
}

export default function ChannelRow( {
	channel,
	channels,
	isSelected,
	offerVersion,
	onSelect,
	main,
	versions,
	onVersions,
}: Props ) {
	const own = hasOwnVersion( versions, channel.id );
	const content = contentFor( main, versions, channel.id );
	const { count, limit, over } = measure( channel, content );
	const problems = isSelected ? channelProblems( channel, content, own ) : [];
	const notes = isSelected ? channelNotes( channel, content ) : [];

	return (
		<div
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
					onChange={ ( checked ) => onSelect( channel.id, checked ) }
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

			{ isSelected && ( offerVersion || own ) && (
				<ChannelVersion
					channel={ channel }
					channels={ channels }
					own={ own }
					content={ content }
					main={ main }
					versions={ versions }
					onVersions={ onVersions }
				/>
			) }

			<Sentences
				items={ problems }
				className="orbitwrite-channel-row__problems"
			/>
			<Sentences
				items={ notes }
				className="orbitwrite-channel-row__notes"
			/>
		</div>
	);
}
