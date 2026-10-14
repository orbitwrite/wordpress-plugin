<?php
/**
 * The one place this plugin talks to the Orbitwrite API.
 *
 * @package Orbitwrite
 */

namespace Orbitwrite\WordPress;

use WP_Error;

defined( 'ABSPATH' ) || exit;

/**
 * Orbitwrite's `/api/v1`, called as one WordPress user.
 *
 * Every request carries that user's bearer token, refreshed first when it is
 * about to lapse. A 401 refreshes once and repeats the request once, which is
 * safe for every route including `POST /posts`: a 401 is refused before
 * anything runs. Nothing else is retried. In particular a create that times
 * out may already have created the post, and repeating it would post twice.
 *
 * Failures come back as WP_Error carrying Orbitwrite's own message (written
 * for people, so it is shown as-is) and a `status` the plugin's REST routes
 * pass on.
 */
final class Api {

	/**
	 * The WordPress user the requests are made as.
	 *
	 * @var int
	 */
	private $user_id;

	/**
	 * Requests as a given user.
	 *
	 * @param int $user_id WordPress user id.
	 */
	public function __construct( int $user_id ) {
		$this->user_id = $user_id;
	}

	/**
	 * The WordPress user the requests are made as.
	 */
	public function user_id(): int {
		return $this->user_id;
	}

	/**
	 * Requests as the current user.
	 */
	public static function for_current_user(): self {
		return new self( get_current_user_id() );
	}

	/**
	 * GET a path under /api/v1.
	 *
	 * @param string $path  Path, e.g. `/connected-accounts`.
	 * @param array  $query Query parameters; array values repeat the key.
	 * @return array|WP_Error
	 */
	public function get( string $path, array $query = array() ) {
		return $this->request( 'GET', $path, $query, null );
	}

	/**
	 * POST JSON to a path under /api/v1.
	 *
	 * @param string $path Path.
	 * @param array  $body JSON body.
	 * @return array|WP_Error
	 */
	public function post( string $path, array $body ) {
		return $this->request( 'POST', $path, array(), $body );
	}

	/**
	 * Make a request.
	 *
	 * @param string     $method HTTP method.
	 * @param string     $path   Path under /api/v1.
	 * @param array      $query  Query parameters.
	 * @param array|null $body   JSON body.
	 * @return array|WP_Error
	 */
	public function request( string $method, string $path, array $query = array(), ?array $body = null ) {
		$url = Config::api_url( $path );
		$qs  = self::query_string( $query );
		if ( '' !== $qs ) {
			$url .= '?' . $qs;
		}

		$token = OAuth::access_token( $this->user_id );
		if ( is_wp_error( $token ) ) {
			return $token;
		}
		$response = $this->send( $method, $url, $token, $body );

		if ( ! is_wp_error( $response ) && 401 === (int) wp_remote_retrieve_response_code( $response ) ) {
			$token = OAuth::access_token( $this->user_id, true );
			if ( is_wp_error( $token ) ) {
				return $token;
			}
			$response = $this->send( $method, $url, $token, $body );
			if ( ! is_wp_error( $response ) && 401 === (int) wp_remote_retrieve_response_code( $response ) ) {
				// A token minted a moment ago still refused: the consent or
				// the membership behind it is gone.
				Token_Store::delete( $this->user_id );
				return OAuth::not_connected( __( 'Orbitwrite no longer accepts this connection. Reconnect to keep posting.', 'orbitwrite' ) );
			}
		}

		return self::parse( $response );
	}

	/**
	 * Send one request.
	 *
	 * @param string     $method HTTP method.
	 * @param string     $url    Full URL.
	 * @param string     $token  Access token.
	 * @param array|null $body   JSON body.
	 * @return array|WP_Error The raw WordPress HTTP response.
	 */
	private function send( string $method, string $url, string $token, ?array $body ) {
		$args = array(
			'method'  => $method,
			'timeout' => 30,
			'headers' => array(
				'Authorization' => 'Bearer ' . $token,
				'Accept'        => 'application/json',
				'User-Agent'    => Config::user_agent(),
			),
		);
		if ( null !== $body ) {
			$args['headers']['Content-Type'] = 'application/json';
			$args['body']                    = wp_json_encode( $body );
		}
		return wp_remote_request( $url, $args );
	}

	/**
	 * Turn a WordPress HTTP response into the decoded body or a WP_Error.
	 *
	 * @param array|WP_Error $response WordPress HTTP response.
	 * @return array|WP_Error
	 */
	public static function parse( $response ) {
		if ( is_wp_error( $response ) ) {
			return new WP_Error(
				'orbitwrite_unreachable',
				/* translators: %s: the network error. */
				sprintf( __( 'Couldn\'t reach Orbitwrite: %s', 'orbitwrite' ), $response->get_error_message() ),
				array( 'status' => 502 )
			);
		}

		$status  = (int) wp_remote_retrieve_response_code( $response );
		$decoded = json_decode( (string) wp_remote_retrieve_body( $response ), true );

		if ( $status >= 200 && $status < 300 ) {
			return is_array( $decoded ) ? $decoded : array();
		}

		$message = is_array( $decoded ) && isset( $decoded['error'] ) && is_string( $decoded['error'] ) && '' !== $decoded['error']
			? $decoded['error']
			/* translators: %d: HTTP status code. */
			: sprintf( __( 'Orbitwrite answered with HTTP %d.', 'orbitwrite' ), $status );

		$data = array(
			'status'   => self::status_for( $status ),
			'upstream' => $status,
		);
		if ( 429 === $status ) {
			$retry_after = (int) wp_remote_retrieve_header( $response, 'retry-after' );
			if ( $retry_after > 0 ) {
				$data['retry_after'] = $retry_after;
				$message             = sprintf(
					/* translators: %d: seconds. */
					_n( 'Orbitwrite is busy. Try again in %d second.', 'Orbitwrite is busy. Try again in %d seconds.', $retry_after, 'orbitwrite' ),
					$retry_after
				);
			}
		}

		return new WP_Error( 'orbitwrite_http_' . $status, $message, $data );
	}

	/**
	 * The status the plugin's own routes answer with for an upstream status.
	 * The caller's mistakes pass through; anything else is a bad gateway, so
	 * the editor never mistakes Orbitwrite's 401 for its own session expiring.
	 *
	 * @param int $status Orbitwrite's status.
	 */
	public static function status_for( int $status ): int {
		return in_array( $status, array( 400, 403, 404, 409, 422, 429 ), true ) ? $status : 502;
	}

	/**
	 * A query string with array values written as repeated keys
	 * (`accountIds=a&accountIds=b`), which is how the API reads lists.
	 *
	 * @param array $query Parameters. Null values are dropped.
	 */
	public static function query_string( array $query ): string {
		$pairs = array();
		foreach ( $query as $key => $value ) {
			foreach ( is_array( $value ) ? $value : array( $value ) as $item ) {
				if ( null === $item ) {
					continue;
				}
				if ( is_bool( $item ) ) {
					$item = $item ? 'true' : 'false';
				}
				$pairs[] = rawurlencode( (string) $key ) . '=' . rawurlencode( (string) $item );
			}
		}
		return implode( '&', $pairs );
	}
}
