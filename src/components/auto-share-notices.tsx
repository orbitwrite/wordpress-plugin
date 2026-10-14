/**
 * What auto-share is doing with an article, or why it didn't.
 */
import { Notice } from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';

import type { Sent } from '../hooks/use-shares';
import { isAutoSharing } from '../lib/shares';

export default function AutoShareNotices( { sent }: { sent: Sent } ) {
	const { autoShare, shares } = sent;
	return (
		<>
			{ isAutoSharing( autoShare ) && shares.length === 0 && (
				<Notice status="info" isDismissible={ false }>
					{ __(
						'Auto-share is sending this article to Orbitwrite.',
						'orbitwrite'
					) }
				</Notice>
			) }
			{ autoShare?.error && (
				<Notice status="error" isDismissible={ false }>
					{ sprintf(
						/* translators: %s: why. */
						__(
							"Auto-share didn't send this article: %s",
							'orbitwrite'
						),
						autoShare.error
					) }
				</Notice>
			) }
		</>
	);
}
