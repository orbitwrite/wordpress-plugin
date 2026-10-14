<?php
/**
 * Connecting a WordPress user to Orbitwrite with OAuth 2.1.
 *
 * @package Orbitwrite
 */

namespace Orbitwrite\WordPress;

use WP_Error;

defined( 'ABSPATH' ) || exit;

/**
 * The OAuth flow, end to end:
 *
 *   Connect → admin-post.php?action=orbitwrite_oauth_start
 *     → Orbitwrite's authorize endpoint (PKCE, `state`, resource = /api/v1)
 *     → the person signs in, picks a workspace, approves
 *     → admin-post.php?action=orbitwrite_oauth_callback?code=…&state=…
 *     → code exchanged for an access token (a JWT, about an hour) and a
 *       refresh token, stored per user.
 *
 * Orbitwrite registers clients by CIMD (Client ID Metadata Document): the
 * client id is an HTTPS URL, and Orbitwrite fetches it to read the client's
 * name and redirect URIs. So every WordPress site is its own OAuth client,
 * describing itself at `/wp-json/orbitwrite/v1/oauth-client`, and nothing has
 * to be registered on the Orbitwrite side. The consequence is that Orbitwrite
 * must be able to fetch that URL: the site has to be public and on HTTPS.
 *
 * This mirrors Orbitwrite's own CLI (`orbitwrite login`), which is the
 * reference implementation of the same flow.
 */
final class OAuth {

	/** RFC 8414 metadata for an issuer at `/api/auth`. */
	const METADATA_PATH = '/.well-known/oauth-authorization-server/api/auth';

	/** The two workspace bundles, plus a refresh token. */
	const SCOPES = 'orbitwrite:read orbitwrite:write offline_access';

	/** Refresh this long before expiry, so a token can't lapse mid-request. */
	const REFRESH_MARGIN = 60;

	const START_ACTION    = 'orbitwrite_oauth_start';
	const CALLBACK_ACTION = 'orbitwrite_oauth_callback';

	/**
	 * Hook the admin-post handlers.
	 */
	public static function register(): void {
		add_action( 'admin_post_' . self::START_ACTION, array( self::class, 'handle_start' ) );
		add_action( 'admin_post_' . self::CALLBACK_ACTION, array( self::class, 'handle_callback' ) );
		add_action( 'admin_post_nopriv_' . self::START_ACTION, 'auth_redirect' );
		add_action( 'admin_post_nopriv_' . self::CALLBACK_ACTION, 'auth_redirect' );
	}

	/**
	 * This site's client id: the URL of its own metadata document. Built by
	 * the same function every time, because Orbitwrite requires the document's
	 * `client_id` to equal the URL it was fetched from, byte for byte.
	 */
	public static function client_id(): string {
		return rest_url( 'orbitwrite/v1/oauth-client' );
	}

	/**
	 * Where Orbitwrite sends the person back. Must match `redirect_uris` in
	 * the metadata document exactly.
	 */
	public static function redirect_uri(): string {
		return admin_url( 'admin-post.php?action=' . self::CALLBACK_ACTION );
	}

	/**
	 * The CIMD document Orbitwrite reads to learn who this client is.
	 */
	public static function client_document(): array {
		$name = wp_specialchars_decode( (string) get_bloginfo( 'name' ), ENT_QUOTES );
		if ( '' === trim( $name ) ) {
			$name = (string) wp_parse_url( home_url(), PHP_URL_HOST );
		}
		$document = array(
			'client_id'                  => self::client_id(),
			/* translators: %s: the site's name. */
			'client_name'                => sprintf( __( '%s (WordPress)', 'orbitwrite' ), $name ),
			'client_uri'                 => home_url(),
			'redirect_uris'              => array( self::redirect_uri() ),
			'grant_types'                => array( 'authorization_code', 'refresh_token' ),
			'response_types'             => array( 'code' ),
			'token_endpoint_auth_method' => 'none',
			'application_type'           => 'web',
		);
		$icon     = get_site_icon_url( 512 );
		if ( $icon ) {
			$document['logo_uri'] = $icon;
		}
		return $document;
	}

	/**
	 * Reasons this site can't connect, as sentences. Empty when it can.
	 *
	 * Checked before sending anyone to Orbitwrite, because each of these
	 * otherwise surfaces as an opaque error on Orbitwrite's side after the
	 * person has already signed in.
	 */
	public static function connect_problems(): array {
		$problems = array();

		if ( '' === (string) get_option( 'permalink_structure' ) ) {
			$problems[] = __( 'Orbitwrite needs pretty permalinks to connect. Choose any setting other than "Plain" under Settings → Permalinks.', 'orbitwrite' );
		}

		$client_id = self::client_id();
		if ( 'https' !== wp_parse_url( $client_id, PHP_URL_SCHEME ) ) {
			$problems[] = __( 'Orbitwrite can only connect to a site served over HTTPS.', 'orbitwrite' );
		}

		$host = (string) wp_parse_url( $client_id, PHP_URL_HOST );
		if ( ! self::is_public_host( $host ) ) {
			$problems[] = sprintf(
				/* translators: %s: the site's host name. */
				__( 'Orbitwrite has to reach this site from the internet to connect, and %s looks private or local. Use a public address, or a tunnel while developing.', 'orbitwrite' ),
				$host
			);
		}

		/**
		 * Filters the reasons this site can't connect to Orbitwrite.
		 *
		 * @param string[] $problems Sentences shown instead of the Connect button.
		 */
		return (array) apply_filters( 'orbitwrite_connect_problems', $problems );
	}

	/**
	 * Whether a host could plausibly be fetched from the internet.
	 *
	 * @param string $host Host name or IP.
	 */
	public static function is_public_host( string $host ): bool {
		$host = strtolower( trim( $host, '[]' ) );
		if ( '' === $host || 'localhost' === $host ) {
			return false;
		}
		if ( filter_var( $host, FILTER_VALIDATE_IP ) ) {
			return false !== filter_var( $host, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE );
		}
		if ( false === strpos( $host, '.' ) ) {
			return false;
		}
		foreach ( array( '.localhost', '.local', '.test', '.invalid', '.example', '.internal', '.lan', '.home.arpa' ) as $suffix ) {
			if ( substr( $host, -strlen( $suffix ) ) === $suffix ) {
				return false;
			}
		}
		return true;
	}

	/**
	 * The URL behind the Connect button.
	 *
	 * @param string $return_to Where to land afterwards (an admin URL).
	 */
	public static function start_url( string $return_to ): string {
		// Not wp_nonce_url(): it HTML-escapes the `&`s, and this URL reaches
		// the browser as JSON, where `&amp;` stays literal and the nonce is lost.
		return add_query_arg(
			array(
				'action'    => self::START_ACTION,
				'return_to' => rawurlencode( $return_to ),
				'_wpnonce'  => wp_create_nonce( self::START_ACTION ),
			),
			admin_url( 'admin-post.php' )
		);
	}

	/**
	 * Begin connecting: remember the PKCE verifier and `state`, then send the
	 * person to Orbitwrite.
	 */
	public static function handle_start(): void {
		check_admin_referer( self::START_ACTION );
		if ( ! current_user_can( 'edit_posts' ) ) {
			wp_die( esc_html__( 'You are not allowed to connect Orbitwrite.', 'orbitwrite' ), 403 );
		}
		$user_id   = get_current_user_id();
		$return_to = wp_validate_redirect(
			isset( $_GET['return_to'] ) ? esc_url_raw( wp_unslash( $_GET['return_to'] ) ) : '',
			Admin::page_url()
		);

		$problems = self::connect_problems();
		if ( $problems ) {
			Notices::push( $user_id, 'error', implode( ' ', $problems ) );
			wp_safe_redirect( $return_to );
			exit;
		}

		$metadata = self::metadata();
		if ( is_wp_error( $metadata ) ) {
			Notices::push( $user_id, 'error', $metadata->get_error_message() );
			wp_safe_redirect( $return_to );
			exit;
		}

		$verifier = Pkce::random_token();
		$state    = Pkce::random_token();
		set_transient(
			self::pending_key( $user_id ),
			array(
				'verifier'            => $verifier,
				'state'               => $state,
				'return_to'           => $return_to,
				'issuer'              => $metadata['issuer'],
				'token_endpoint'      => $metadata['token_endpoint'],
				'revocation_endpoint' => $metadata['revocation_endpoint'] ?? '',
			),
			15 * MINUTE_IN_SECONDS
		);

		$authorize  = $metadata['authorization_endpoint'];
		$authorize .= ( false === strpos( $authorize, '?' ) ? '?' : '&' ) . http_build_query(
			array(
				'response_type'         => 'code',
				'client_id'             => self::client_id(),
				'redirect_uri'          => self::redirect_uri(),
				'scope'                 => self::SCOPES,
				'state'                 => $state,
				'code_challenge'        => Pkce::challenge( $verifier ),
				'code_challenge_method' => 'S256',
				'resource'              => Config::resource(),
			),
			'',
			'&',
			PHP_QUERY_RFC3986
		);

		// phpcs:ignore WordPress.Security.SafeRedirect.wp_redirect_wp_redirect -- Orbitwrite is off-site by design.
		wp_redirect( $authorize );
		exit;
	}

	/**
	 * Orbitwrite's answer: check it is ours, exchange the code, keep the
	 * tokens, then read which workspace they are for.
	 */
	public static function handle_callback(): void {
		$user_id = get_current_user_id();
		$pending = get_transient( self::pending_key( $user_id ) );
		delete_transient( self::pending_key( $user_id ) );

		if ( ! is_array( $pending ) ) {
			self::finish( $user_id, Admin::page_url(), 'error', __( 'The connection took too long. Try connecting again.', 'orbitwrite' ) );
		}
		$return_to = (string) $pending['return_to'];

		// The OAuth `state` is this request's CSRF protection: it was minted
		// for this user moments ago and only Orbitwrite was told it.
		// phpcs:disable WordPress.Security.NonceVerification.Recommended
		$state = isset( $_GET['state'] ) ? sanitize_text_field( wp_unslash( $_GET['state'] ) ) : '';
		$iss   = isset( $_GET['iss'] ) ? esc_url_raw( wp_unslash( $_GET['iss'] ) ) : '';
		$error = isset( $_GET['error'] ) ? sanitize_key( wp_unslash( $_GET['error'] ) ) : '';
		$desc  = isset( $_GET['error_description'] ) ? sanitize_text_field( wp_unslash( $_GET['error_description'] ) ) : '';
		$code  = isset( $_GET['code'] ) ? sanitize_text_field( wp_unslash( $_GET['code'] ) ) : '';
		// phpcs:enable WordPress.Security.NonceVerification.Recommended

		// `state` first: an answer to some other request is not ours to act
		// on, error or not.
		if ( '' === $state || ! hash_equals( (string) $pending['state'], $state ) ) {
			self::finish( $user_id, $return_to, 'error', __( 'Orbitwrite answered a different connection request. Try connecting again.', 'orbitwrite' ) );
		}
		// RFC 9207: a server that names itself must be the one we asked.
		if ( '' !== $iss && untrailingslashit( $iss ) !== untrailingslashit( (string) $pending['issuer'] ) ) {
			self::finish( $user_id, $return_to, 'error', __( 'The answer came from an unexpected server. Try connecting again.', 'orbitwrite' ) );
		}
		if ( '' !== $error ) {
			$message = 'access_denied' === $error
				? __( 'Connection cancelled.', 'orbitwrite' )
				/* translators: %s: the reason Orbitwrite gave. */
				: sprintf( __( 'Orbitwrite couldn\'t connect: %s', 'orbitwrite' ), '' !== $desc ? $desc : $error );
			self::finish( $user_id, $return_to, 'access_denied' === $error ? 'info' : 'error', $message );
		}
		if ( '' === $code ) {
			self::finish( $user_id, $return_to, 'error', __( 'Orbitwrite returned no authorization code. Try connecting again.', 'orbitwrite' ) );
		}

		$tokens = self::token_request(
			(string) $pending['token_endpoint'],
			array(
				'grant_type'    => 'authorization_code',
				'code'          => $code,
				'redirect_uri'  => self::redirect_uri(),
				'client_id'     => self::client_id(),
				'code_verifier' => (string) $pending['verifier'],
				'resource'      => Config::resource(),
			)
		);
		if ( is_wp_error( $tokens ) ) {
			/* translators: %s: the reason Orbitwrite gave. */
			self::finish( $user_id, $return_to, 'error', sprintf( __( 'Orbitwrite couldn\'t connect: %s', 'orbitwrite' ), $tokens->get_error_message() ) );
		}

		$connection = array_merge(
			array(
				'base_url'            => Config::base_url(),
				'client_id'           => self::client_id(),
				'token_endpoint'      => (string) $pending['token_endpoint'],
				'revocation_endpoint' => (string) $pending['revocation_endpoint'],
				'resource'            => Config::resource(),
				'organization'        => null,
				'connected_at'        => time(),
			),
			self::from_token_response( $tokens, time() )
		);
		Token_Store::save( $user_id, $connection );

		// The token names its workspace; ask which one it is, for display and
		// for links into the app.
		$me = ( new Api( $user_id ) )->get( '/me' );
		if ( is_wp_error( $me ) || empty( $me['organization']['id'] ) ) {
			Token_Store::delete( $user_id );
			$reason = is_wp_error( $me ) ? $me->get_error_message() : __( 'no workspace was returned', 'orbitwrite' );
			/* translators: %s: the reason. */
			self::finish( $user_id, $return_to, 'error', sprintf( __( 'Connected, but couldn\'t read your workspace: %s', 'orbitwrite' ), $reason ) );
		}

		$connection                 = Token_Store::get( $user_id );
		$connection['organization'] = array(
			'id'   => (string) $me['organization']['id'],
			'name' => (string) ( $me['organization']['name'] ?? '' ),
			'slug' => (string) ( $me['organization']['slug'] ?? '' ),
		);
		Token_Store::save( $user_id, $connection );
		Workspace::forget_channels( $user_id );

		$name = '' !== $connection['organization']['name'] ? $connection['organization']['name'] : __( 'your workspace', 'orbitwrite' );
		/* translators: %s: the Orbitwrite workspace name. */
		self::finish( $user_id, $return_to, 'success', sprintf( __( 'Connected to %s on Orbitwrite.', 'orbitwrite' ), $name ) );
	}

	/**
	 * Leave a notice and go back to where the person started.
	 *
	 * @param int    $user_id   WordPress user id.
	 * @param string $return_to Admin URL.
	 * @param string $type      Notice type.
	 * @param string $message   Notice text.
	 * @return never
	 */
	private static function finish( int $user_id, string $return_to, string $type, string $message ): void {
		Notices::push( $user_id, $type, $message );
		wp_safe_redirect( $return_to );
		exit;
	}

	/**
	 * A current access token for the user, refreshed first if it is about to
	 * lapse.
	 *
	 * @param int  $user_id WordPress user id.
	 * @param bool $force   Refresh even if it looks valid (after a 401).
	 * @return string|WP_Error
	 */
	public static function access_token( int $user_id, bool $force = false ) {
		$connection = Token_Store::get( $user_id );
		if ( ! $connection ) {
			return self::not_connected();
		}
		if ( ! $force && (int) $connection['expires_at'] - time() > self::REFRESH_MARGIN ) {
			return (string) $connection['access_token'];
		}
		return self::refresh( $user_id, $connection );
	}

	/**
	 * Swap the refresh token for a new access token.
	 *
	 * Two requests can need a refresh at once (the editor fires several), and
	 * a rotated refresh token can only be spent once, so the swap is guarded
	 * by a per-user lock: the loser waits for the winner's token instead of
	 * spending the old refresh token a second time.
	 *
	 * @param int   $user_id    WordPress user id.
	 * @param array $connection The connection whose token is stale.
	 * @return string|WP_Error
	 */
	private static function refresh( int $user_id, array $connection ) {
		if ( empty( $connection['refresh_token'] ) ) {
			Token_Store::delete( $user_id );
			return self::not_connected( __( 'Your Orbitwrite connection has expired. Reconnect to keep posting.', 'orbitwrite' ) );
		}

		$lock = 'orbitwrite_refresh_lock_' . $user_id;
		if ( ! self::acquire_lock( $lock ) ) {
			for ( $i = 0; $i < 20; $i++ ) {
				usleep( 250000 );
				wp_cache_delete( $user_id, 'user_meta' );
				$fresh = Token_Store::get( $user_id );
				if ( $fresh && $fresh['access_token'] !== $connection['access_token'] ) {
					return (string) $fresh['access_token'];
				}
			}
			return new WP_Error( 'orbitwrite_busy', __( 'Orbitwrite is busy refreshing your connection. Try again in a moment.', 'orbitwrite' ), array( 'status' => 503 ) );
		}

		try {
			// Re-read inside the lock: another request may have refreshed
			// between our read and taking the lock.
			wp_cache_delete( $user_id, 'user_meta' );
			$current = Token_Store::get( $user_id );
			if ( ! $current ) {
				return self::not_connected();
			}
			if ( $current['access_token'] !== $connection['access_token'] && (int) $current['expires_at'] - time() > self::REFRESH_MARGIN ) {
				return (string) $current['access_token'];
			}

			$tokens = self::token_request(
				(string) $current['token_endpoint'],
				array(
					'grant_type'    => 'refresh_token',
					'refresh_token' => (string) $current['refresh_token'],
					'client_id'     => (string) $current['client_id'],
					'resource'      => (string) $current['resource'],
				)
			);
			if ( is_wp_error( $tokens ) ) {
				// The server saying this sign-in is over: expired, revoked, or
				// the app was removed in Orbitwrite.
				if ( 'invalid_grant' === $tokens->get_error_code() ) {
					// Unless another request rotated it a moment ago, which is
					// a race lost, not a sign-in over: use what it stored.
					wp_cache_delete( $user_id, 'user_meta' );
					$latest = Token_Store::get( $user_id );
					if ( $latest && $latest['refresh_token'] !== $current['refresh_token'] ) {
						return (string) $latest['access_token'];
					}
					Token_Store::delete( $user_id );
					return self::not_connected( __( 'Your Orbitwrite connection has expired or was removed. Reconnect to keep posting.', 'orbitwrite' ) );
				}
				return $tokens;
			}

			$refreshed = array_merge( $current, self::from_token_response( $tokens, time() ) );
			// Rotation is the server's choice; without a new one the old stands.
			if ( empty( $tokens['refresh_token'] ) ) {
				$refreshed['refresh_token'] = $current['refresh_token'];
			}
			Token_Store::save( $user_id, $refreshed );
			return (string) $refreshed['access_token'];
		} finally {
			self::release_lock( $lock );
		}
	}

	/**
	 * Take a lock, atomically. Not add_option(): that reads the option and
	 * then upserts (`INSERT … ON DUPLICATE KEY UPDATE`), so two requests can
	 * both see it missing and both "add" it, and both would then spend the
	 * same single-use refresh token. A plain insert against the unique
	 * `option_name` lets exactly one through.
	 *
	 * @param string $name Lock name.
	 */
	private static function acquire_lock( string $name ): bool {
		global $wpdb;
		// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$inserted = $wpdb->query(
			$wpdb->prepare(
				"INSERT IGNORE INTO {$wpdb->options} (option_name, option_value, autoload) VALUES (%s, %s, 'off')",
				$name,
				(string) time()
			)
		);
		if ( 1 === $inserted ) {
			return true;
		}
		// A request that died holding the lock leaves it behind; after 30s
		// take it over, again so that only one request can.
		$since = (string) $wpdb->get_var( $wpdb->prepare( "SELECT option_value FROM {$wpdb->options} WHERE option_name = %s", $name ) );
		if ( '' !== $since && time() - (int) $since > 30 ) {
			$taken = $wpdb->query(
				$wpdb->prepare(
					"UPDATE {$wpdb->options} SET option_value = %s WHERE option_name = %s AND option_value = %s",
					(string) time(),
					$name,
					$since
				)
			);
			return 1 === $taken;
		}
		// phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		return false;
	}

	/**
	 * Release a lock taken with acquire_lock().
	 *
	 * @param string $name Lock name.
	 */
	private static function release_lock( string $name ): void {
		global $wpdb;
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$wpdb->delete( $wpdb->options, array( 'option_name' => $name ) );
	}

	/**
	 * Revoke the refresh token and forget the connection. Revoking is best
	 * effort: forgetting has to happen either way. The access token is a JWT
	 * that can't be taken back, but it lapses within the hour and Orbitwrite
	 * re-checks the consent on every request.
	 *
	 * @param int $user_id WordPress user id.
	 */
	public static function disconnect( int $user_id ): void {
		$connection = Token_Store::get( $user_id );
		if ( $connection && ! empty( $connection['revocation_endpoint'] ) ) {
			$has_refresh = ! empty( $connection['refresh_token'] );
			wp_remote_post(
				(string) $connection['revocation_endpoint'],
				array(
					'timeout' => 5,
					'headers' => array( 'User-Agent' => Config::user_agent() ),
					'body'    => array(
						'token'           => (string) ( $has_refresh ? $connection['refresh_token'] : $connection['access_token'] ),
						'token_type_hint' => $has_refresh ? 'refresh_token' : 'access_token',
						'client_id'       => (string) $connection['client_id'],
					),
				)
			);
		}
		Token_Store::delete( $user_id );
		Workspace::forget_channels( $user_id );
	}

	/**
	 * The authorization server's endpoints (RFC 8414), cached for a day.
	 *
	 * @return array|WP_Error
	 */
	public static function metadata() {
		$key    = 'orbitwrite_as_' . md5( Config::base_url() );
		$cached = get_transient( $key );
		if ( is_array( $cached ) ) {
			return $cached;
		}

		$response = wp_remote_get(
			Config::base_url() . self::METADATA_PATH,
			array(
				'timeout' => 15,
				'headers' => array(
					'Accept'     => 'application/json',
					'User-Agent' => Config::user_agent(),
				),
			)
		);
		if ( is_wp_error( $response ) ) {
			/* translators: %s: the network error. */
			return new WP_Error( 'orbitwrite_unreachable', sprintf( __( 'Couldn\'t reach Orbitwrite: %s', 'orbitwrite' ), $response->get_error_message() ) );
		}
		$body = json_decode( (string) wp_remote_retrieve_body( $response ), true );
		if (
			200 !== (int) wp_remote_retrieve_response_code( $response )
			|| ! is_array( $body )
			|| empty( $body['issuer'] )
			|| empty( $body['authorization_endpoint'] )
			|| empty( $body['token_endpoint'] )
		) {
			return new WP_Error( 'orbitwrite_no_oauth', __( 'Orbitwrite didn\'t describe its sign-in endpoints. Try again later.', 'orbitwrite' ) );
		}
		if ( isset( $body['code_challenge_methods_supported'] ) && ! in_array( 'S256', (array) $body['code_challenge_methods_supported'], true ) ) {
			return new WP_Error( 'orbitwrite_no_pkce', __( 'Orbitwrite doesn\'t support the sign-in method this plugin needs (PKCE S256).', 'orbitwrite' ) );
		}

		$metadata = array(
			'issuer'                 => (string) $body['issuer'],
			'authorization_endpoint' => (string) $body['authorization_endpoint'],
			'token_endpoint'         => (string) $body['token_endpoint'],
			'revocation_endpoint'    => isset( $body['revocation_endpoint'] ) ? (string) $body['revocation_endpoint'] : '',
		);
		set_transient( $key, $metadata, DAY_IN_SECONDS );
		return $metadata;
	}

	/**
	 * POST a form to the token endpoint.
	 *
	 * @param string $endpoint Token endpoint.
	 * @param array  $form     Form fields.
	 * @return array|WP_Error The token response, or the server's refusal with
	 *                        its OAuth error code as the WP_Error code.
	 */
	private static function token_request( string $endpoint, array $form ) {
		$response = wp_remote_post(
			$endpoint,
			array(
				'timeout' => 20,
				'headers' => array(
					'Accept'     => 'application/json',
					'User-Agent' => Config::user_agent(),
				),
				'body'    => $form,
			)
		);
		if ( is_wp_error( $response ) ) {
			/* translators: %s: the network error. */
			return new WP_Error( 'orbitwrite_unreachable', sprintf( __( 'Couldn\'t reach Orbitwrite: %s', 'orbitwrite' ), $response->get_error_message() ), array( 'status' => 502 ) );
		}
		$status = (int) wp_remote_retrieve_response_code( $response );
		$body   = json_decode( (string) wp_remote_retrieve_body( $response ), true );
		if ( $status < 200 || $status >= 300 || ! is_array( $body ) || empty( $body['access_token'] ) ) {
			$code    = is_array( $body ) && ! empty( $body['error'] ) ? (string) $body['error'] : 'http_' . $status;
			$message = is_array( $body ) && ! empty( $body['error_description'] ) ? (string) $body['error_description'] : $code;
			return new WP_Error( $code, $message, array( 'status' => 502 ) );
		}
		return $body;
	}

	/**
	 * The fields of a token response worth keeping.
	 *
	 * @param array $tokens Token response.
	 * @param int   $now    Unix time the response arrived.
	 */
	public static function from_token_response( array $tokens, int $now ): array {
		// An hour is the server's default; a response that leaves it out is
		// read as that rather than as "never expires".
		$lifetime = isset( $tokens['expires_in'] ) ? (int) $tokens['expires_in'] : HOUR_IN_SECONDS;
		$kept     = array(
			'access_token' => (string) $tokens['access_token'],
			'expires_at'   => $now + $lifetime,
			'scope'        => isset( $tokens['scope'] ) ? (string) $tokens['scope'] : '',
		);
		if ( ! empty( $tokens['refresh_token'] ) ) {
			$kept['refresh_token'] = (string) $tokens['refresh_token'];
		}
		return $kept;
	}

	/**
	 * The error every caller gets when the user has no usable connection.
	 *
	 * @param string|null $message Override the default sentence.
	 */
	public static function not_connected( ?string $message = null ): WP_Error {
		return new WP_Error(
			'orbitwrite_not_connected',
			$message ?? __( 'Connect Orbitwrite first.', 'orbitwrite' ),
			array( 'status' => 403 )
		);
	}

	/**
	 * Transient key for a connection in progress.
	 *
	 * @param int $user_id WordPress user id.
	 */
	private static function pending_key( int $user_id ): string {
		return 'orbitwrite_oauth_' . $user_id;
	}
}
