<?php
/**
 * @package Orbitwrite
 */

use Orbitwrite\WordPress\Api;
use Orbitwrite\WordPress\Config;
use Orbitwrite\WordPress\OAuth;
use PHPUnit\Framework\TestCase;

final class ApiTest extends TestCase {

	protected function tearDown(): void {
		$GLOBALS['test_filters'] = array();
	}

	private static function response( int $code, $body, array $headers = array() ): array {
		return array(
			'response' => array( 'code' => $code ),
			'body'     => is_string( $body ) ? $body : json_encode( $body ),
			'headers'  => $headers,
		);
	}

	public function test_lists_are_repeated_keys(): void {
		$this->assertSame(
			'accountIds=a&accountIds=b%20c&count=1&flag=true',
			Api::query_string(
				array(
					'accountIds' => array( 'a', 'b c' ),
					'count'      => 1,
					'skip'       => null,
					'flag'       => true,
				)
			)
		);
	}

	public function test_success_returns_the_decoded_body(): void {
		$this->assertSame( array( 'ok' => true ), Api::parse( self::response( 200, array( 'ok' => true ) ) ) );
		$this->assertSame( array(), Api::parse( self::response( 204, '' ) ) );
	}

	public function test_errors_carry_orbitwrites_message_and_a_passable_status(): void {
		$error = Api::parse( self::response( 403, array( 'error' => 'You don\'t have permission to publish.' ) ) );
		$this->assertInstanceOf( WP_Error::class, $error );
		$this->assertSame( 'You don\'t have permission to publish.', $error->get_error_message() );
		$this->assertSame( 403, $error->get_error_data()['status'] );
		$this->assertSame( 403, $error->get_error_data()['upstream'] );
	}

	public function test_upstream_auth_and_server_errors_become_bad_gateway(): void {
		$this->assertSame( 502, Api::parse( self::response( 401, array( 'error' => 'x' ) ) )->get_error_data()['status'] );
		$this->assertSame( 502, Api::parse( self::response( 500, 'oops' ) )->get_error_data()['status'] );
		$this->assertSame( 'Orbitwrite answered with HTTP 500.', Api::parse( self::response( 500, 'oops' ) )->get_error_message() );
	}

	public function test_rate_limits_say_when_to_retry(): void {
		$error = Api::parse( self::response( 429, array( 'error' => 'Too many' ), array( 'retry-after' => '12' ) ) );
		$this->assertSame( 429, $error->get_error_data()['status'] );
		$this->assertSame( 12, $error->get_error_data()['retry_after'] );
		$this->assertStringContainsString( '12 seconds', $error->get_error_message() );
	}

	public function test_network_failures_are_unreachable(): void {
		$error = Api::parse( new WP_Error( 'http_request_failed', 'timed out' ) );
		$this->assertSame( 'orbitwrite_unreachable', $error->get_error_code() );
		$this->assertSame( 502, $error->get_error_data()['status'] );
	}

	public function test_base_url_is_normalised(): void {
		$GLOBALS['test_filters']['orbitwrite_base_url'] = static function () {
			return ' https://staging.orbitwrite.com/api/v1/ ';
		};
		$this->assertSame( 'https://staging.orbitwrite.com', Config::base_url() );
		$this->assertSame( 'https://staging.orbitwrite.com/api/v1', Config::resource() );
	}

	public function test_public_hosts(): void {
		$this->assertTrue( OAuth::is_public_host( 'blog.example.com' ) );
		$this->assertTrue( OAuth::is_public_host( '93.184.216.34' ) );
		foreach ( array( 'localhost', 'mysite.local', 'site.test', 'intranet', '127.0.0.1', '10.0.0.4', '192.168.1.2', '[::1]', 'wp.localhost' ) as $host ) {
			$this->assertFalse( OAuth::is_public_host( $host ), $host );
		}
	}

	public function test_token_responses_default_to_an_hour(): void {
		$kept = OAuth::from_token_response( array( 'access_token' => 'at' ), 1000 );
		$this->assertSame( 1000 + 3600, $kept['expires_at'] );
		$this->assertArrayNotHasKey( 'refresh_token', $kept );

		$kept = OAuth::from_token_response(
			array(
				'access_token'  => 'at',
				'refresh_token' => 'rt',
				'expires_in'    => 60,
				'scope'         => 'orbitwrite:read',
			),
			1000
		);
		$this->assertSame( 1060, $kept['expires_at'] );
		$this->assertSame( 'rt', $kept['refresh_token'] );
	}
}
