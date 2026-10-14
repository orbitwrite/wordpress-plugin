<?php
/**
 * Where a WordPress user's Orbitwrite connection is kept.
 *
 * @package Orbitwrite
 */

namespace Orbitwrite\WordPress;

defined( 'ABSPATH' ) || exit;

/**
 * One Orbitwrite connection per WordPress user, in user meta.
 *
 * Per user rather than per site because a token is a grant to a person:
 * Orbitwrite applies that person's role and consent, and attributes posts to
 * them. Two authors on one blog connect separately, and may even post to
 * different workspaces.
 *
 * Shape (tokens decrypted on read):
 *
 *     base_url, client_id, token_endpoint, revocation_endpoint, resource,
 *     access_token, refresh_token, expires_at (unix seconds), scope,
 *     organization { id, name, slug }, connected_at (unix seconds)
 */
final class Token_Store {

	const META_KEY = '_orbitwrite_connection';

	/**
	 * The user's connection, or null when there is none usable.
	 *
	 * A connection made against another Orbitwrite server, or under another
	 * client id (the site's address changed since), is not this one: its
	 * tokens would be refused or would belong to a client that no longer
	 * exists, so it reads as disconnected.
	 *
	 * @param int $user_id WordPress user id.
	 */
	public static function get( int $user_id ): ?array {
		$stored = get_user_meta( $user_id, self::META_KEY, true );
		if ( ! is_array( $stored ) || empty( $stored['access_token'] ) ) {
			return null;
		}
		if ( ( $stored['base_url'] ?? '' ) !== Config::base_url() || ( $stored['client_id'] ?? '' ) !== OAuth::client_id() ) {
			return null;
		}
		$access = Crypto::decrypt( (string) $stored['access_token'] );
		if ( null === $access ) {
			return null;
		}
		$refresh = null;
		if ( ! empty( $stored['refresh_token'] ) ) {
			$refresh = Crypto::decrypt( (string) $stored['refresh_token'] );
		}
		$stored['access_token']  = $access;
		$stored['refresh_token'] = $refresh;
		return $stored;
	}

	/**
	 * Store a connection, sealing its tokens.
	 *
	 * @param int   $user_id    WordPress user id.
	 * @param array $connection Connection with plain tokens.
	 */
	public static function save( int $user_id, array $connection ): void {
		$connection['access_token']  = Crypto::encrypt( (string) $connection['access_token'] );
		$connection['refresh_token'] = empty( $connection['refresh_token'] )
			? ''
			: Crypto::encrypt( (string) $connection['refresh_token'] );
		update_user_meta( $user_id, self::META_KEY, $connection );
	}

	/**
	 * Forget the user's connection.
	 *
	 * @param int $user_id WordPress user id.
	 */
	public static function delete( int $user_id ): void {
		delete_user_meta( $user_id, self::META_KEY );
	}
}
