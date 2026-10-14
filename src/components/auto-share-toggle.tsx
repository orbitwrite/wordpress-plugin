/**
 * Auto-share on one article: the "Share automatically when this is
 * published" checkbox while it waits to be published. Shown in the classic
 * editor's box, and in the block editor's Post tab and pre-publish panel.
 */
import { CheckboxControl } from '@wordpress/components';
import { __, _n, sprintf } from '@wordpress/i18n';

import type { Sent } from '../hooks/use-shares';
import * as api from '../lib/api';
import { autoSharePending } from '../lib/shares';
import type { ArticleAutoShare } from '../lib/types';

/**
 * Where and when auto-share will send the article.
 *
 * @param autoShare From the shares route.
 * @return Sentence.
 */
function whereAndWhen( autoShare: ArticleAutoShare ): string {
	return autoShare.when === 'now'
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
}

/**
 * What auto-share will do with the article, under its checkbox.
 *
 * @param autoShare   From the shares route.
 * @param settingsUrl The auto-share settings page.
 * @return Help.
 */
function help( autoShare: ArticleAutoShare, settingsUrl: string ) {
	const where = whereAndWhen( autoShare );
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

interface Props {
	postId: number;
	/** From useShares(). */
	sent: Sent;
	/** The auto-share settings page. */
	settingsUrl: string;
	/** Called with a message when saving fails. */
	onError: ( message: string ) => void;
}

export default function AutoShareToggle( {
	postId,
	sent,
	settingsUrl,
	onError,
}: Props ) {
	const autoShare = sent.autoShare;
	if ( ! autoShare || ! autoSharePending( sent ) ) {
		return null;
	}
	const onChange = ( enabled: boolean ) => {
		sent.setAutoShare( { ...autoShare, enabled } );
		api.setArticleAutoShare( postId, enabled )
			.then( ( answer ) => sent.setAutoShare( answer.autoShare ) )
			.catch( ( err ) => onError( api.messageOf( err ) ) );
	};
	return (
		<CheckboxControl
			__nextHasNoMarginBottom
			label={ __(
				'Share automatically when this is published',
				'orbitwrite'
			) }
			checked={ autoShare.enabled }
			onChange={ onChange }
			help={ help( autoShare, settingsUrl ) }
		/>
	);
}
