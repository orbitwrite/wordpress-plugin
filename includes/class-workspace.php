<?php
/**
 * What the composer needs to know about the connected workspace.
 *
 * @package Orbitwrite
 */

namespace Orbitwrite\WordPress;

use WP_Error;

defined( 'ABSPATH' ) || exit;

/**
 * Channels and their networks' rules, the workspace's timezone and its next
 * free posting slot. All read from Orbitwrite; nothing here decides anything
 * Orbitwrite would decide differently.
 */
final class Workspace {

	/**
	 * Channels the user can post to, each with its network's text and media
	 * rules.
	 *
	 * Disconnected channels are left out (Orbitwrite returns them so they can
	 * be reconnected in the app). Channels whose credentials died stay in,
	 * flagged, so the composer can say why they can't be picked; so do
	 * video-only networks, which this plugin can't post to yet.
	 *
	 * @param Api $api Client.
	 * @return array|WP_Error
	 */
	public static function channels( Api $api ) {
		$list = $api->get( '/connected-accounts' );
		if ( is_wp_error( $list ) ) {
			return $list;
		}
		$channels = self::from_accounts( (array) ( $list['accounts'] ?? array() ), self::platform_rules( $api ) );
		set_transient( self::channels_key( $api->user_id() ), $channels, 5 * MINUTE_IN_SECONDS );
		return $channels;
	}

	/**
	 * The channels as recently read (the composer reads them when it opens),
	 * or read again when that copy is missing or doesn't know a channel being
	 * sent to. Empty when they can't be read: sending then goes ahead without
	 * the plugin's own media checks and Orbitwrite judges it, rather than a
	 * failed lookup failing a send that would have worked.
	 *
	 * @param Api      $api    Client.
	 * @param string[] $needed Channel ids about to be used.
	 */
	public static function recent_channels( Api $api, array $needed = array() ): array {
		$cached = get_transient( self::channels_key( $api->user_id() ) );
		if ( is_array( $cached ) && ! array_diff( $needed, array_column( $cached, 'id' ) ) ) {
			return $cached;
		}
		$channels = self::channels( $api );
		return is_wp_error( $channels ) ? array() : $channels;
	}

	/**
	 * Forget a user's cached channels: they belong to the connection, which
	 * just changed.
	 *
	 * @param int $user_id WordPress user id.
	 */
	public static function forget_channels( int $user_id ): void {
		delete_transient( self::channels_key( $user_id ) );
	}

	/**
	 * Transient key for a user's channels on this Orbitwrite.
	 *
	 * @param int $user_id WordPress user id.
	 */
	private static function channels_key( int $user_id ): string {
		return 'orbitwrite_channels_' . md5( Config::base_url() . '|' . $user_id );
	}

	/**
	 * Channels from `/connected-accounts` entries and the networks' rules.
	 *
	 * @param array $accounts The `accounts` list.
	 * @param array $rules    From platform_rules().
	 */
	public static function from_accounts( array $accounts, array $rules ): array {
		$channels = array();
		foreach ( $accounts as $account ) {
			if ( ! is_array( $account ) || ! empty( $account['disconnected'] ) ) {
				continue;
			}
			$platform = (string) ( $account['platform'] ?? '' );
			$rule     = $rules[ $platform ] ?? null;
			$premium  = ! empty( $account['isPremium'] ) && $rule && ! empty( $rule['premiumMaxChars'] );

			$channels[] = array(
				'id'                => (string) $account['id'],
				'platform'          => $platform,
				'platformName'      => $rule['name'] ?? $platform,
				'handle'            => $account['handle'] ?? null,
				'displayName'       => $account['displayName'] ?? null,
				'avatarUrl'         => $account['avatarUrl'] ?? null,
				'needsReconnect'    => ! empty( $account['needsReconnect'] ),
				'defaultSelected'   => ! empty( $account['defaultSelected'] ),
				'maxChars'          => $rule ? (int) ( $premium ? $rule['premiumMaxChars'] : $rule['maxChars'] ) : null,
				'withMediaMaxChars' => $rule && ! empty( $rule['withMediaMaxChars'] ) ? (int) $rule['withMediaMaxChars'] : null,
				'unit'              => $rule['unit'] ?? 'chars',
				'media'             => $rule['media'] ?? self::media_rules( array() ),
			);
		}
		return $channels;
	}

	/**
	 * Each network's text rules, keyed by platform id. Cached for a day; an
	 * unreadable answer degrades to no limits rather than failing the list.
	 *
	 * @param Api $api Client.
	 */
	public static function platform_rules( Api $api ): array {
		$key    = 'orbitwrite_platforms_v3_' . md5( Config::base_url() );
		$cached = get_transient( $key );
		if ( is_array( $cached ) ) {
			return $cached;
		}
		$answer = $api->get( '/platforms' );
		if ( is_wp_error( $answer ) ) {
			return array();
		}
		$rules = array();
		foreach ( (array) ( $answer['platforms'] ?? array() ) as $platform ) {
			if ( ! is_array( $platform ) || empty( $platform['platform'] ) || empty( $platform['text'] ) ) {
				continue;
			}
			$text                                    = (array) $platform['text'];
			$rules[ (string) $platform['platform'] ] = array(
				'name'              => (string) ( $platform['name'] ?? $platform['platform'] ),
				'maxChars'          => (int) ( $text['maxChars'] ?? 0 ),
				'unit'              => (string) ( $text['unit'] ?? 'chars' ),
				'premiumMaxChars'   => $text['premiumMaxChars'] ?? null,
				'withMediaMaxChars' => $text['withMediaMaxChars'] ?? null,
				'media'             => self::media_rules( (array) ( $platform['media'] ?? array() ) ),
			);
		}
		set_transient( $key, $rules, DAY_IN_SECONDS );
		return $rules;
	}

	/**
	 * The part of a network's media rules that matters for one image:
	 * whether it needs media at all, whether it takes images, how large, and
	 * what shape. Missing rules read as "anything goes", leaving the refusal
	 * to Orbitwrite rather than inventing one.
	 *
	 * @param array $media The `/platforms` entry's `media`.
	 */
	public static function media_rules( array $media ): array {
		// `image: null` means "no images"; a missing key means nothing is known.
		$image  = array_key_exists( 'image', $media ) ? $media['image'] : array();
		$ratio  = $media['aspectRatio'] ?? null;
		$images = null !== $image && ( ! isset( $media['maxItems'] ) || (int) $media['maxItems'] > 0 );
		// The image types among what the network takes. Null when it doesn't
		// say, and an empty list restricts nothing either (Orbitwrite's own
		// rule), so both read as "any".
		$types = ! empty( $media['mimeTypes'] ) && is_array( $media['mimeTypes'] )
			? array_values( array_intersect( Media::ALLOWED_TYPES, $media['mimeTypes'] ) )
			: null;
		return array(
			'required'      => ! empty( $media['required'] ),
			'images'        => $images,
			'imageTypes'    => $images ? $types : array(),
			'imageMaxBytes' => $images && is_array( $image ) && ! empty( $image['maxBytes'] ) ? (int) $image['maxBytes'] : null,
			// GIFs have their own, usually larger, cap on some networks.
			'gifMaxBytes'   => $images && is_array( $image ) && ! empty( $image['maxGifBytes'] ) ? (int) $image['maxGifBytes'] : null,
			'aspectRatio'   => is_array( $ratio ) && ( isset( $ratio['min'] ) || isset( $ratio['max'] ) )
				? array(
					'min' => isset( $ratio['min'] ) ? (float) $ratio['min'] : null,
					'max' => isset( $ratio['max'] ) ? (float) $ratio['max'] : null,
				)
				: null,
		);
	}

	/**
	 * The workspace's IANA timezone. Every time the composer shows or accepts
	 * is in this zone, so 9am means the 9am on the Orbitwrite calendar.
	 *
	 * The scheduling suggestions are where the API reports it; cached for six
	 * hours per workspace. Falls back to UTC, and says so in the UI by
	 * labelling every time with its zone.
	 *
	 * @param Api    $api             Client.
	 * @param string $organization_id Workspace id.
	 */
	public static function timezone( Api $api, string $organization_id ): string {
		$key    = 'orbitwrite_tz_' . md5( Config::base_url() . '|' . $organization_id );
		$cached = get_transient( $key );
		if ( is_string( $cached ) && '' !== $cached ) {
			return $cached;
		}
		$answer   = $api->get( '/scheduling/suggestions', self::timezone_query() );
		$timezone = 'UTC';
		if ( ! is_wp_error( $answer ) ) {
			foreach ( (array) ( $answer['suggestions'] ?? array() ) as $suggestion ) {
				if ( ! empty( $suggestion['timezone'] ) && self::is_valid_timezone( (string) $suggestion['timezone'] ) ) {
					$timezone = (string) $suggestion['timezone'];
					break;
				}
			}
			set_transient( $key, $timezone, 6 * HOUR_IN_SECONDS );
		}
		return $timezone;
	}

	/**
	 * The soonest free posting slot across the given channels.
	 *
	 * @param Api      $api         Client.
	 * @param string[] $account_ids Channel ids.
	 * @return string|WP_Error An ISO 8601 instant.
	 */
	public static function next_slot( Api $api, array $account_ids ) {
		$answer = $api->get( '/scheduling/suggestions', self::next_slot_query( $account_ids ) );
		if ( is_wp_error( $answer ) ) {
			return $answer;
		}
		$earliest = Schedule_Time::earliest_suggestion( (array) ( $answer['suggestions'] ?? array() ) );
		if ( null === $earliest ) {
			return new WP_Error(
				'orbitwrite_no_slot',
				__( 'None of these channels has a free posting slot in the next two weeks. Pick a time instead.', 'orbitwrite' ),
				array( 'status' => 409 )
			);
		}
		return $earliest;
	}

	/**
	 * The query for one suggestion per channel: the soonest free slot.
	 *
	 * @param string[] $account_ids Channel ids.
	 */
	public static function next_slot_query( array $account_ids ): array {
		return array(
			'accountIds' => array_values( $account_ids ),
			'count'      => 1,
		);
	}

	/**
	 * The query whose answer names the workspace's timezone.
	 */
	public static function timezone_query(): array {
		return array( 'count' => 1 );
	}

	/**
	 * Whether PHP knows a timezone name.
	 *
	 * @param string $timezone IANA name.
	 */
	public static function is_valid_timezone( string $timezone ): bool {
		return in_array( $timezone, timezone_identifiers_list( \DateTimeZone::ALL_WITH_BC ), true );
	}
}
