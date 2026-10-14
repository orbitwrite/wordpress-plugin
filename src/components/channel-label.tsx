/**
 * A channel as it's shown wherever one is picked: avatar, name, network.
 */
import { channelName } from '../lib/channels';
import type { Channel } from '../lib/types';

export default function ChannelLabel( { channel }: { channel: Channel } ) {
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
