/**
 * The foot of the composer: what's in the way, the send button, and
 * starting over.
 */
import { Button, Notice } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

interface Props {
	/** Warn that the article's link won't work yet. */
	unpublished: boolean;
	/** Whether the composer is for an article. */
	hasArticle: boolean;
	error: string | null;
	onDismissError: () => void;
	/** Whether a channel can't take its content. */
	blocked: boolean;
	label: string;
	canSend: boolean;
	sending: boolean;
	onSend: () => void;
	/** Offer to start over, once the person has edited. */
	onStartOver: ( () => void ) | null;
}

export default function SendFooter( {
	unpublished,
	hasArticle,
	error,
	onDismissError,
	blocked,
	label,
	canSend,
	sending,
	onSend,
	onStartOver,
}: Props ) {
	return (
		<div className="orbitwrite-composer__foot">
			{ unpublished && (
				<Notice status="warning" isDismissible={ false }>
					{ __(
						"This article isn't published yet, so its link won't work until it is. Schedule the social post for after it goes live.",
						'orbitwrite'
					) }
				</Notice>
			) }
			{ error && (
				<Notice status="error" onRemove={ onDismissError }>
					{ error }
				</Notice>
			) }

			{ blocked && (
				<p className="orbitwrite-composer__blocked">
					{ __(
						'Fix what’s marked on the channels above to send.',
						'orbitwrite'
					) }
				</p>
			) }
			<Button
				variant="primary"
				className="orbitwrite-composer__send"
				disabled={ ! canSend }
				isBusy={ sending }
				onClick={ onSend }
			>
				{ label }
			</Button>
			{ onStartOver && (
				<Button
					variant="link"
					className="orbitwrite-composer__start-over"
					onClick={ onStartOver }
				>
					{ hasArticle
						? __( 'Start over from the article', 'orbitwrite' )
						: __( 'Start over', 'orbitwrite' ) }
				</Button>
			) }
		</div>
	);
}
