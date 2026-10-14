<?php
/**
 * Turning a composed draft into Orbitwrite posts.
 *
 * @package Orbitwrite
 */

namespace Orbitwrite\WordPress;

use WP_Error;

defined( 'ABSPATH' ) || exit;

/**
 * Sends a Draft: checks it against each network's media rules, uploads each
 * distinct image once (sized for the strictest network sending it), and
 * creates the posts.
 *
 * Nothing here retries a create that might have gone through. The one repeat
 * is after Orbitwrite refuses a remembered upload (deleted in the app since):
 * a 400/404 is a refusal before anything was written, so uploading again and
 * repeating can't post twice.
 */
final class Sender {

	/**
	 * Client.
	 *
	 * @var Api
	 */
	private $api;

	/**
	 * The workspace the posts go to.
	 *
	 * @var string
	 */
	private $organization_id;

	/**
	 * Send as one user, into their workspace.
	 *
	 * @param Api    $api             Client.
	 * @param string $organization_id Workspace.
	 */
	public function __construct( Api $api, string $organization_id ) {
		$this->api             = $api;
		$this->organization_id = $organization_id;
	}

	/**
	 * Create the posts.
	 *
	 * @param Draft  $draft    What to send.
	 * @param array  $schedule `{ scheduled_at, publish_now }`.
	 * @param string $title    The posts' name inside Orbitwrite.
	 * @return array|WP_Error `{ result, entries }`: the API's answer and what
	 *                        was sent per channel.
	 */
	public function send( Draft $draft, array $schedule, string $title ) {
		$started = time();
		$by_id   = array_column( Workspace::recent_channels( $this->api, $draft->account_ids() ), null, 'id' );
		$problem = self::media_problem( $draft, $by_id );
		if ( null !== $problem ) {
			return new WP_Error( 'orbitwrite_invalid', $problem, array( 'status' => 400 ) );
		}

		$groups = self::content_groups( $draft, $by_id );
		$sent   = $this->attempt( $draft, $groups, $schedule, $title, $started, false );
		// Only a remembered upload can have gone stale; a refusal of a fresh
		// one would just be refused again.
		if ( ! is_wp_error( $sent ) && is_wp_error( $sent['result'] ) && $sent['reused'] && self::is_media_refusal( $sent['result'] ) ) {
			$sent = $this->attempt( $draft, $groups, $schedule, $title, $started, true );
		}
		if ( is_wp_error( $sent ) ) {
			return $sent;
		}
		if ( is_wp_error( $sent['result'] ) ) {
			return $sent['result'];
		}
		return array(
			'result'  => $sent['result'],
			'entries' => $sent['entries'],
		);
	}

	/**
	 * Upload, build and create, once.
	 *
	 * @param Draft   $draft    What to send.
	 * @param array[] $groups   From content_groups().
	 * @param array   $schedule `{ scheduled_at, publish_now }`.
	 * @param string  $title    Post name.
	 * @param int     $started  When the send began.
	 * @param bool    $fresh    Ignore uploads remembered from earlier sends.
	 * @return array|WP_Error `{ result, entries, reused }`.
	 */
	private function attempt( Draft $draft, array $groups, array $schedule, string $title, int $started, bool $fresh ) {
		$media_ids = array();
		$reused    = false;
		foreach ( $groups as $key => $group ) {
			if ( ! $group['content']['attachment_id'] ) {
				continue;
			}
			$upload = Media::upload(
				$this->api,
				$this->organization_id,
				$group['content']['attachment_id'],
				$group['content']['alt_text'],
				$group['limits'],
				$started,
				$fresh
			);
			if ( is_wp_error( $upload ) ) {
				return $upload;
			}
			$media_ids[ $key ] = $upload['id'];
			$reused            = $reused || $upload['reused'];
		}

		$entries = self::entries( $draft, $groups, $media_ids );
		return array(
			'entries' => $entries,
			'result'  => $this->api->post( '/posts', Post_Builder::build( $entries, $schedule, $title, 'wp_generate_uuid4' ) ),
			'reused'  => $reused,
		);
	}

	/**
	 * What each channel sends, for Post_Builder. Pure.
	 *
	 * @param Draft   $draft     What to send.
	 * @param array[] $groups    From content_groups().
	 * @param array   $media_ids Uploaded media ids by group key.
	 * @return array[] `[{ account_id, synced, text, media_id }]`.
	 */
	public static function entries( Draft $draft, array $groups, array $media_ids ): array {
		$entries = array();
		foreach ( $draft->channels as $index => $channel ) {
			$key       = self::group_key( $channel, $index );
			$entries[] = array(
				'account_id' => $channel['account_id'],
				'synced'     => $channel['synced'],
				'text'       => $groups[ $key ]['content']['text'],
				'media_id'   => $media_ids[ $key ] ?? null,
			);
		}
		return $entries;
	}

	/**
	 * The distinct pieces of content being sent, each with the limits of the
	 * channels sending it: the main post (shared by every synced channel) and
	 * each own version. An image has to suit every network sending it, so
	 * the byte cap is the strictest one (a GIF's own cap where the network
	 * has one) and the types are those all of them take.
	 *
	 * @param Draft   $draft What to send.
	 * @param array[] $by_id Channels by id; unknown channels add no limits.
	 * @return array[] `[ key => { content, limits: { max_bytes, set_by, types, types_by } } ]`.
	 */
	public static function content_groups( Draft $draft, array $by_id ): array {
		$groups = array();
		foreach ( $draft->channels as $index => $channel ) {
			$key = self::group_key( $channel, $index );
			if ( ! isset( $groups[ $key ] ) ) {
				$content        = $draft->content_for( $channel );
				$groups[ $key ] = array(
					'content' => $content,
					'is_gif'  => $content['attachment_id'] && 'image/gif' === get_post_mime_type( $content['attachment_id'] ),
					'limits'  => array(
						'max_bytes' => null,
						'set_by'    => array(),
						'types'     => null,
						'types_by'  => array(),
					),
				);
			}
			$known = $by_id[ $channel['account_id'] ] ?? null;
			if ( ! $known ) {
				continue;
			}
			$limits = &$groups[ $key ]['limits'];
			$max    = $groups[ $key ]['is_gif'] && ! empty( $known['media']['gifMaxBytes'] )
				? (int) $known['media']['gifMaxBytes']
				: ( $known['media']['imageMaxBytes'] ?? null );
			if ( null !== $max && ( null === $limits['max_bytes'] || $max < $limits['max_bytes'] ) ) {
				$limits['max_bytes'] = (int) $max;
				$limits['set_by']    = array();
			}
			if ( null !== $max && (int) $max === $limits['max_bytes'] ) {
				$limits['set_by'][] = (string) $known['platformName'];
			}
			$types = $known['media']['imageTypes'] ?? null;
			if ( null !== $types ) {
				$limits['types']      = null === $limits['types'] ? $types : array_values( array_intersect( $limits['types'], $types ) );
				$limits['types_by'][] = (string) $known['platformName'];
			}
			unset( $limits );
		}
		foreach ( $groups as $key => $group ) {
			$groups[ $key ]['limits']['set_by']   = implode( ', ', array_unique( $group['limits']['set_by'] ) );
			$groups[ $key ]['limits']['types_by'] = implode( ', ', array_unique( $group['limits']['types_by'] ) );
			unset( $groups[ $key ]['is_gif'] );
		}
		return $groups;
	}

	/**
	 * Which piece of content a channel sends.
	 *
	 * @param array $channel A Draft channel.
	 * @param int   $index   Its position.
	 */
	private static function group_key( array $channel, int $index ): string {
		return $channel['synced'] ? 'main' : 'own:' . $index;
	}

	/**
	 * The first way the draft breaks a network's media rules, as a sentence.
	 * The composer checks the same rules as you type; this is the answer for
	 * a request that skipped it, or rules that changed since the page loaded.
	 *
	 * @param Draft   $draft What to send.
	 * @param array[] $by_id Channels by id.
	 */
	public static function media_problem( Draft $draft, array $by_id ): ?string {
		foreach ( $draft->channels as $channel ) {
			if ( ! isset( $by_id[ $channel['account_id'] ] ) ) {
				continue; // Unknown here; Orbitwrite will say what's wrong.
			}
			$known = $by_id[ $channel['account_id'] ];
			$rules = $known['media'];
			$name  = self::channel_name( $known );
			$image = $draft->content_for( $channel )['attachment_id'];

			if ( $rules['required'] && ! $rules['images'] ) {
				/* translators: %s: channel name. */
				return sprintf( __( '%s only takes video, which this plugin can\'t attach yet.', 'orbitwrite' ), $name );
			}
			if ( $rules['required'] && ! $image ) {
				/* translators: %s: channel name. */
				return sprintf( __( '%s needs an image.', 'orbitwrite' ), $name );
			}
			if ( $image && ! $rules['images'] ) {
				/* translators: %s: channel name. */
				return sprintf( __( '%s doesn\'t take images. Remove the image, or give it its own version without one.', 'orbitwrite' ), $name );
			}
			if ( $image && $rules['aspectRatio'] ) {
				$meta = wp_get_attachment_metadata( $image );
				$off  = is_array( $meta ) ? Aspect::problem( (int) ( $meta['width'] ?? 0 ), (int) ( $meta['height'] ?? 0 ), $rules['aspectRatio'] ) : null;
				if ( null !== $off ) {
					/* translators: 1: channel name, 2: what's wrong with the shape. */
					return sprintf( __( '%1$s: %2$s', 'orbitwrite' ), $name, $off );
				}
			}
		}
		return null;
	}

	/**
	 * A channel as people know it: "Acme on Instagram".
	 *
	 * @param array $channel A Workspace channel.
	 */
	private static function channel_name( array $channel ): string {
		$name = $channel['displayName'] ?? $channel['handle'] ?? '';
		/* translators: 1: account name, 2: network name. */
		return '' !== (string) $name ? sprintf( __( '%1$s on %2$s', 'orbitwrite' ), $name, $channel['platformName'] ) : (string) $channel['platformName'];
	}

	/**
	 * Whether a create was refused over its media.
	 *
	 * @param WP_Error $error The create's error.
	 */
	private static function is_media_refusal( WP_Error $error ): bool {
		$data     = (array) $error->get_error_data();
		$upstream = (int) ( $data['upstream'] ?? 0 );
		return in_array( $upstream, array( 400, 404 ), true ) && false !== stripos( $error->get_error_message(), 'media' );
	}
}
