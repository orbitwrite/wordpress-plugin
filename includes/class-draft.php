<?php
/**
 * What the composer sends: a main post, and per channel either "same as main
 * post" or that channel's own version.
 *
 * @package Orbitwrite
 */

namespace Orbitwrite\WordPress;

defined( 'ABSPATH' ) || exit;

/**
 * The composer's content, normalised from the request. Pure.
 *
 * A piece of content is `{ text, attachment_id, alt_text }`. The main post is
 * one; each channel is `{ account_id, synced }` plus, when it isn't synced,
 * its own content. A synced channel's own fields are dropped on the way in,
 * so nothing downstream can send a stale version by mistake.
 */
final class Draft {

	/** The longest text accepted, well past any network's limit. */
	const MAX_TEXT = 65000;

	/** Channels in one post. */
	const MAX_CHANNELS = 50;

	/**
	 * The main post.
	 *
	 * @var array
	 */
	public $main;

	/**
	 * The channels, in the order they were picked, one per account.
	 *
	 * @var array[]
	 */
	public $channels;

	/**
	 * Build from already-normalised parts.
	 *
	 * @param array   $main     Main post content.
	 * @param array[] $channels Channels.
	 */
	private function __construct( array $main, array $channels ) {
		$this->main     = $main;
		$this->channels = $channels;
	}

	/**
	 * From the `send` request's fields.
	 *
	 * @param array $main     `{ text, attachmentId, altText }`.
	 * @param array $channels `[{ accountId, synced, text, attachmentId, altText }]`.
	 */
	public static function from_input( array $main, array $channels ): self {
		$normalised = array();
		foreach ( $channels as $channel ) {
			$account_id = (string) ( $channel['accountId'] ?? '' );
			if ( '' === $account_id || isset( $normalised[ $account_id ] ) ) {
				continue;
			}
			$synced                    = ! isset( $channel['synced'] ) || (bool) $channel['synced'];
			$normalised[ $account_id ] = array_merge(
				array(
					'account_id' => $account_id,
					'synced'     => $synced,
				),
				$synced ? self::content( array() ) : self::content( $channel )
			);
		}
		return new self( self::content( $main ), array_values( $normalised ) );
	}

	/**
	 * A piece of content from request fields.
	 *
	 * @param array $fields `{ text, attachmentId, altText }`.
	 */
	private static function content( array $fields ): array {
		return array(
			'text'          => (string) ( $fields['text'] ?? '' ),
			'attachment_id' => max( 0, (int) ( $fields['attachmentId'] ?? 0 ) ),
			'alt_text'      => (string) ( $fields['altText'] ?? '' ),
		);
	}

	/**
	 * What a channel sends: its own version, or the main post.
	 *
	 * @param array $channel One of `$this->channels`.
	 */
	public function content_for( array $channel ): array {
		return $channel['synced'] ? $this->main : array(
			'text'          => $channel['text'],
			'attachment_id' => $channel['attachment_id'],
			'alt_text'      => $channel['alt_text'],
		);
	}

	/**
	 * The channel ids, in order.
	 *
	 * @return string[]
	 */
	public function account_ids(): array {
		return array_column( $this->channels, 'account_id' );
	}

	/**
	 * Every image something will send.
	 *
	 * @return int[]
	 */
	public function attachment_ids(): array {
		$ids = array();
		foreach ( $this->channels as $channel ) {
			$id = $this->content_for( $channel )['attachment_id'];
			if ( $id ) {
				$ids[ $id ] = $id;
			}
		}
		return array_values( $ids );
	}

	/**
	 * What's wrong with it, as a sentence, or null.
	 */
	public function problem(): ?string {
		if ( ! $this->channels ) {
			return __( 'Pick at least one channel.', 'orbitwrite' );
		}
		if ( count( $this->channels ) > self::MAX_CHANNELS ) {
			return __( 'That is too many channels for one post.', 'orbitwrite' );
		}
		foreach ( $this->channels as $channel ) {
			$text = $this->content_for( $channel )['text'];
			if ( '' === trim( $text ) ) {
				return $channel['synced']
					? __( 'Write something to post.', 'orbitwrite' )
					: __( 'A channel with its own version has no text. Write it, or tick "Same as main post".', 'orbitwrite' );
			}
			if ( strlen( $text ) > self::MAX_TEXT ) {
				return __( 'That post is too long.', 'orbitwrite' );
			}
		}
		return null;
	}
}
