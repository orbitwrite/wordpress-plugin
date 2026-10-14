<?php
/**
 * PKCE (RFC 7636) and the random values the OAuth flow needs.
 *
 * @package Orbitwrite
 */

namespace Orbitwrite\WordPress;

defined( 'ABSPATH' ) || exit;

/**
 * Proof that the code being exchanged is the one this site asked for. The
 * plugin is a public client (no secret), so PKCE is what stops a stolen
 * authorization code being redeemed by anyone else.
 */
final class Pkce {

	/**
	 * 32 random bytes, base64url: a code verifier or a `state`.
	 */
	public static function random_token(): string {
		return self::base64url( random_bytes( 32 ) );
	}

	/**
	 * The S256 challenge for a verifier.
	 *
	 * @param string $verifier Code verifier.
	 */
	public static function challenge( string $verifier ): string {
		return self::base64url( hash( 'sha256', $verifier, true ) );
	}

	/**
	 * Base64url without padding.
	 *
	 * @param string $bytes Raw bytes.
	 */
	public static function base64url( string $bytes ): string {
		// phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_encode -- RFC 7636 encoding.
		return rtrim( strtr( base64_encode( $bytes ), '+/', '-_' ), '=' );
	}
}
