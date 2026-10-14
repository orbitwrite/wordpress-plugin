/**
 * Auto-share on one article: the "Share automatically when this is
 * published" checkbox while it waits to be published, then what auto-share
 * did with it. Shown in the classic editor's box, and in the block editor's
 * Post tab and pre-publish panel.
 */
import { CheckboxControl, Notice } from '@wordpress/components';
import { __, _n, sprintf } from '@wordpress/i18n';

import * as api from './api';

/**
 * Whether the checkbox applies: auto-share will take the article, and
 * nobody has shared it by hand (which takes over from auto-share).
 *
 * @param {Object} sent From useShares().
 * @return {boolean} Whether.
 */
export function autoSharePending( sent ) {
	return Boolean( sent.autoShare?.pending && sent.shares.length === 0 );
}

/**
 * What auto-share will do with the article, under its checkbox.
 *
 * @param {Object} autoShare   From the shares route.
 * @param {string} settingsUrl The auto-share settings page.
 * @return {*} Help.
 */
function help( autoShare, settingsUrl ) {
	const where =
		autoShare.when === 'now'
			? sprintf(
					/* translators: %d: number of channels. */
					_n(
						'Goes to %d channel as soon as the article is published.',
						'Goes to %d channels as soon as the article is published.',
						autoShare.channels,
						'orbitwrite'
					),
					autoShare.channels
			  )
			: sprintf(
					/* translators: %d: number of channels. */
					_n(
						'Goes to %d channel at the next free slot after the article is published.',
						'Goes to %d channels at the next free slot after the article is published.',
						autoShare.channels,
						'orbitwrite'
					),
					autoShare.channels
			  );
	if ( ! autoShare.isAuthor ) {
		return `${ where } ${ sprintf(
			/* translators: %s: the article's author. */
			__( "Uses %s's auto-share settings.", 'orbitwrite' ),
			autoShare.authorName
		) }`;
	}
	return (
		<>
			{ where }{ ' ' }
			<a href={ settingsUrl }>
				{ __( 'Auto-share settings', 'orbitwrite' ) }
			</a>
		</>
	);
}

/**
 * @param {Object}   props
 * @param {number}   props.postId
 * @param {Object}   props.sent        From useShares().
 * @param {string}   props.settingsUrl The auto-share settings page.
 * @param {Function} props.onError     Called with a message when saving fails.
 */
export default function AutoShareToggle( {
	postId,
	sent,
	settingsUrl,
	onError,
} ) {
	if ( ! autoSharePending( sent ) ) {
		return null;
	}
	const onChange = ( enabled ) => {
		sent.setAutoShare( { ...sent.autoShare, enabled } );
		api.setArticleAutoShare( postId, enabled )
			.then( ( answer ) => sent.setAutoShare( answer.autoShare ) )
			.catch( ( err ) => onError( err.message ) );
	};
	return (
		<CheckboxControl
			__nextHasNoMarginBottom
			label={ __(
				'Share automatically when this is published',
				'orbitwrite'
			) }
			checked={ sent.autoShare.enabled }
			onChange={ onChange }
			help={ help( sent.autoShare, settingsUrl ) }
		/>
	);
}

/**
 * What auto-share is doing with the article, or why it didn't.
 *
 * @param {Object} props
 * @param {Object} props.sent From useShares().
 */
export function AutoShareNotices( { sent } ) {
	const state = sent.autoShare?.state;
	return (
		<>
			{ [ 'queued', 'sending' ].includes( state ) &&
				sent.shares.length === 0 && (
					<Notice status="info" isDismissible={ false }>
						{ __(
							'Auto-share is sending this article to Orbitwrite.',
							'orbitwrite'
						) }
					</Notice>
				) }
			{ sent.autoShare?.error && (
				<Notice status="error" isDismissible={ false }>
					{ sprintf(
						/* translators: %s: why. */
						__(
							"Auto-share didn't send this article: %s",
							'orbitwrite'
						),
						sent.autoShare.error
					) }
				</Notice>
			) }
		</>
	);
}
