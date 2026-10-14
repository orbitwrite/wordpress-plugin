<?php
/**
 * @package Orbitwrite
 */

use Orbitwrite\WordPress\Pkce;
use PHPUnit\Framework\TestCase;

final class PkceTest extends TestCase {

	public function test_challenge_matches_the_rfc_7636_example(): void {
		// RFC 7636, Appendix B.
		$this->assertSame(
			'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
			Pkce::challenge( 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk' )
		);
	}

	public function test_random_tokens_are_43_url_safe_characters_and_differ(): void {
		$a = Pkce::random_token();
		$b = Pkce::random_token();
		$this->assertMatchesRegularExpression( '/^[A-Za-z0-9_-]{43}$/', $a );
		$this->assertNotSame( $a, $b );
	}
}
