<?php
/**
 * Encryption for tokens at rest.
 *
 * @package Orbitwrite
 */

namespace Orbitwrite\WordPress;

defined( 'ABSPATH' ) || exit;

/**
 * Seals tokens before they are written to user meta.
 *
 * The key is derived from the site's auth salt, so this keeps tokens out of
 * database dumps and backups. It does not protect against someone holding
 * both the database and wp-config.php; nothing stored by a plugin can.
 *
 * libsodium ships with PHP 7.2+, and WordPress bundles sodium_compat for
 * hosts built without it, so these functions are always available.
 */
final class Crypto {

	/**
	 * The secretbox key, derived from the auth salt.
	 */
	private static function key(): string {
		return sodium_crypto_generichash(
			'orbitwrite-token-store|' . wp_salt( 'auth' ),
			'',
			SODIUM_CRYPTO_SECRETBOX_KEYBYTES
		);
	}

	/**
	 * Encrypt a string. The nonce travels with the ciphertext.
	 *
	 * @param string $plain Plain text.
	 */
	public static function encrypt( string $plain ): string {
		$nonce = random_bytes( SODIUM_CRYPTO_SECRETBOX_NONCEBYTES );
		// phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_encode -- binary ciphertext stored as text.
		return base64_encode( $nonce . sodium_crypto_secretbox( $plain, $nonce, self::key() ) );
	}

	/**
	 * Decrypt a string sealed by `encrypt`. Null when it can't be opened,
	 * which is what rotating the site's salts does to every stored token.
	 *
	 * @param string $sealed Output of `encrypt`.
	 */
	public static function decrypt( string $sealed ): ?string {
		// phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_decode -- see encrypt().
		$raw = base64_decode( $sealed, true );
		if ( false === $raw || strlen( $raw ) <= SODIUM_CRYPTO_SECRETBOX_NONCEBYTES ) {
			return null;
		}
		$nonce = substr( $raw, 0, SODIUM_CRYPTO_SECRETBOX_NONCEBYTES );
		$box   = substr( $raw, SODIUM_CRYPTO_SECRETBOX_NONCEBYTES );
		$plain = sodium_crypto_secretbox_open( $box, $nonce, self::key() );
		return false === $plain ? null : $plain;
	}
}
