<?php
/**
 * One-shot messages carried across the OAuth redirects.
 *
 * @package Orbitwrite
 */

namespace Orbitwrite\WordPress;

defined( 'ABSPATH' ) || exit;

/**
 * A message for the user's next page view: "Connected", "Connection
 * cancelled". Read once, by whichever comes first: an admin screen's notices,
 * or the composer's status request (the block editor doesn't show classic
 * admin notices).
 */
final class Notices {

	/**
	 * Transient key for a user.
	 *
	 * @param int $user_id WordPress user id.
	 */
	private static function key( int $user_id ): string {
		return 'orbitwrite_notice_' . $user_id;
	}

	/**
	 * Leave a message.
	 *
	 * @param int    $user_id WordPress user id.
	 * @param string $type    `success` or `error`.
	 * @param string $message Plain text.
	 */
	public static function push( int $user_id, string $type, string $message ): void {
		set_transient(
			self::key( $user_id ),
			array(
				'type'    => $type,
				'message' => $message,
			),
			10 * MINUTE_IN_SECONDS
		);
	}

	/**
	 * Take the message, if there is one.
	 *
	 * @param int $user_id WordPress user id.
	 */
	public static function pop( int $user_id ): ?array {
		$notice = get_transient( self::key( $user_id ) );
		if ( ! is_array( $notice ) ) {
			return null;
		}
		delete_transient( self::key( $user_id ) );
		return $notice;
	}
}
