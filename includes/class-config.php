<?php
/**
 * Where Orbitwrite lives, and how this plugin introduces itself to it.
 *
 * @package Orbitwrite
 */

namespace Orbitwrite\WordPress;

defined( 'ABSPATH' ) || exit;

/**
 * The Orbitwrite origin and the strings sent with every request.
 *
 * The origin defaults to production. Staging is reached by defining
 * `ORBITWRITE_BASE_URL` in wp-config.php; it is deliberately not a setting in
 * the admin, because pointing a site at another server silently disconnects
 * everyone on it.
 */
final class Config {

	const DEFAULT_BASE_URL = 'https://orbitwrite.com';

	/**
	 * The Orbitwrite origin, without a trailing slash or `/api/v1`.
	 */
	public static function base_url(): string {
		$url = defined( 'ORBITWRITE_BASE_URL' ) ? (string) ORBITWRITE_BASE_URL : self::DEFAULT_BASE_URL;
		/**
		 * Filters the Orbitwrite origin the plugin talks to.
		 *
		 * @param string $url Origin, e.g. https://orbitwrite.com.
		 */
		$url = (string) apply_filters( 'orbitwrite_base_url', $url );
		$url = preg_replace( '#/api/v1/?$#', '', trim( $url ) );
		return rtrim( (string) $url, '/' );
	}

	/**
	 * The API resource tokens are minted for. A token bound to anything else
	 * is refused by the API.
	 */
	public static function resource(): string {
		return self::base_url() . '/api/v1';
	}

	/**
	 * A full API URL for a path such as `/posts`.
	 *
	 * @param string $path Path under /api/v1, with a leading slash.
	 */
	public static function api_url( string $path ): string {
		return self::resource() . $path;
	}

	/**
	 * Sent on every request, so Orbitwrite can record that a post came from
	 * WordPress. Provenance only; Orbitwrite never authorizes on it.
	 */
	public static function user_agent(): string {
		global $wp_version;
		return sprintf( 'orbitwrite-wordpress/%s WordPress/%s', ORBITWRITE_PLUGIN_VERSION, (string) $wp_version );
	}
}
