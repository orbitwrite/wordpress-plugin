<?php
/**
 * Unit-test bootstrap: just enough of WordPress for the pure classes.
 *
 * These tests cover the parts of the plugin whose correctness doesn't depend
 * on WordPress itself (PKCE, times, the request body, response parsing,
 * status folding). The flow through a real WordPress is exercised by the
 * end-to-end script in tests/e2e.
 *
 * @package Orbitwrite
 */

define( 'ABSPATH', __DIR__ . '/' );
define( 'ORBITWRITE_PLUGIN_VERSION', 'test' );
define( 'MINUTE_IN_SECONDS', 60 );
define( 'HOUR_IN_SECONDS', 3600 );
define( 'DAY_IN_SECONDS', 86400 );
define( 'MB_IN_BYTES', 1048576 );

$GLOBALS['wp_version'] = '6.8';
$GLOBALS['test_filters'] = array();

// phpcs:disable
class WP_Error {
	private $code;
	private $message;
	private $data;
	public function __construct( $code = '', $message = '', $data = '' ) {
		$this->code    = $code;
		$this->message = $message;
		$this->data    = $data;
	}
	public function get_error_code() { return $this->code; }
	public function get_error_message() { return $this->message; }
	public function get_error_data() { return $this->data; }
}

function is_wp_error( $thing ) { return $thing instanceof WP_Error; }
function __( $text ) { return $text; }
function size_format( $bytes ) { return $bytes . ' B'; }
function _n( $single, $plural, $number ) { return 1 === $number ? $single : $plural; }
function apply_filters( $hook, $value ) {
	return isset( $GLOBALS['test_filters'][ $hook ] ) ? $GLOBALS['test_filters'][ $hook ]( $value ) : $value;
}
function wp_remote_retrieve_response_code( $response ) { return $response['response']['code'] ?? ''; }
function wp_remote_retrieve_body( $response ) { return $response['body'] ?? ''; }
function wp_remote_retrieve_header( $response, $header ) { return $response['headers'][ strtolower( $header ) ] ?? ''; }
function wp_get_attachment_metadata( $id ) { return $GLOBALS['test_attachment_meta'][ $id ] ?? false; }
function get_post_mime_type( $id ) { return $GLOBALS['test_attachment_mime'][ $id ] ?? 'image/png'; }
// phpcs:enable

require __DIR__ . '/../../includes/autoload.php';
