<?php
/**
 * Turning "now", "next free slot" or a wall-clock time into an instant.
 *
 * @package Orbitwrite
 */

namespace Orbitwrite\WordPress;

use DateTimeImmutable;
use DateTimeZone;
use Exception;
use WP_Error;

defined( 'ABSPATH' ) || exit;

/**
 * When a post goes out. Pure: the clock and the slot lookup are passed in.
 *
 * Wall-clock times are read in the **workspace's** timezone, not the
 * browser's or WordPress's, because a post is a team artifact and 9am has to
 * mean the 9am on the Orbitwrite calendar. Instants go to the API as UTC with
 * a `Z`; the API refuses an offset like `+01:00`.
 */
final class Schedule_Time {

	const NOW  = 'now';
	const NEXT = 'next';
	const AT   = 'at';

	/**
	 * Resolve the composer's choice.
	 *
	 * @param string            $when      `now`, `next` or `at`.
	 * @param string            $at        For `at`: `YYYY-MM-DDTHH:MM` in `$timezone`.
	 * @param string            $timezone  Workspace IANA zone.
	 * @param DateTimeImmutable $now       The current instant.
	 * @param callable          $next_slot Returns the next free slot as an ISO
	 *                                     instant, or a WP_Error. Only called for `next`.
	 * @return array|WP_Error `{ scheduled_at, publish_now }`.
	 */
	public static function resolve( string $when, string $at, string $timezone, DateTimeImmutable $now, callable $next_slot ) {
		if ( self::NOW === $when ) {
			// The API requires a fire time even when publishing now.
			return array(
				'scheduled_at' => self::iso( $now ),
				'publish_now'  => true,
			);
		}

		if ( self::NEXT === $when ) {
			$slot = $next_slot();
			if ( is_wp_error( $slot ) ) {
				return $slot;
			}
			$instant = self::parse_instant( (string) $slot );
			if ( null === $instant ) {
				return new WP_Error( 'orbitwrite_bad_slot', __( 'Orbitwrite suggested a time this plugin couldn\'t read. Pick a time instead.', 'orbitwrite' ), array( 'status' => 502 ) );
			}
			return array(
				'scheduled_at' => self::iso( $instant ),
				'publish_now'  => false,
			);
		}

		if ( self::AT === $when ) {
			$instant = self::wall_clock_to_instant( $at, $timezone );
			if ( null === $instant ) {
				return new WP_Error( 'orbitwrite_bad_time', __( 'Pick a date and time.', 'orbitwrite' ), array( 'status' => 400 ) );
			}
			if ( $instant <= $now ) {
				return new WP_Error(
					'orbitwrite_past_time',
					/* translators: %s: timezone name. */
					sprintf( __( 'That time has already passed in %s. Pick a later one.', 'orbitwrite' ), $timezone ),
					array( 'status' => 400 )
				);
			}
			return array(
				'scheduled_at' => self::iso( $instant ),
				'publish_now'  => false,
			);
		}

		return new WP_Error( 'orbitwrite_bad_when', __( 'Choose when to post.', 'orbitwrite' ), array( 'status' => 400 ) );
	}

	/**
	 * `YYYY-MM-DDTHH:MM[:SS]` read in a zone, as an instant. Null when it
	 * isn't a real time (including a wall-clock time a DST jump skips).
	 *
	 * @param string $local    Wall-clock time.
	 * @param string $timezone IANA zone.
	 */
	public static function wall_clock_to_instant( string $local, string $timezone ): ?DateTimeImmutable {
		if ( ! preg_match( '/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/', $local ) ) {
			return null;
		}
		try {
			$zone = new DateTimeZone( $timezone );
		} catch ( Exception $e ) {
			return null;
		}
		$format = strlen( $local ) === 16 ? '!Y-m-d\TH:i' : '!Y-m-d\TH:i:s';
		$parsed = DateTimeImmutable::createFromFormat( $format, $local, $zone );
		if ( false === $parsed ) {
			return null;
		}
		// createFromFormat rolls 2026-02-30 over to March, and a time inside a
		// spring-forward gap to the hour after; neither is what was picked.
		if ( $parsed->format( 16 === strlen( $local ) ? 'Y-m-d\TH:i' : 'Y-m-d\TH:i:s' ) !== $local ) {
			return null;
		}
		return $parsed->setTimezone( new DateTimeZone( 'UTC' ) );
	}

	/**
	 * Parse an ISO 8601 instant that names its offset.
	 *
	 * @param string $value Instant.
	 */
	public static function parse_instant( string $value ): ?DateTimeImmutable {
		if ( ! preg_match( '/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$/', $value ) ) {
			return null;
		}
		try {
			return ( new DateTimeImmutable( $value ) )->setTimezone( new DateTimeZone( 'UTC' ) );
		} catch ( Exception $e ) {
			return null;
		}
	}

	/**
	 * An instant as the API wants it: UTC, with `Z`.
	 *
	 * @param DateTimeImmutable $instant Instant.
	 */
	public static function iso( DateTimeImmutable $instant ): string {
		return $instant->setTimezone( new DateTimeZone( 'UTC' ) )->format( 'Y-m-d\TH:i:s\Z' );
	}

	/**
	 * The soonest time across `/scheduling/suggestions` entries, as given.
	 *
	 * @param array $suggestions The response's `suggestions`.
	 */
	public static function earliest_suggestion( array $suggestions ): ?string {
		$best       = null;
		$best_value = null;
		foreach ( $suggestions as $suggestion ) {
			foreach ( (array) ( $suggestion['times'] ?? array() ) as $time ) {
				$at      = is_array( $time ) && isset( $time['at'] ) ? (string) $time['at'] : '';
				$instant = self::parse_instant( $at );
				if ( null !== $instant && ( null === $best || $instant < $best ) ) {
					$best       = $instant;
					$best_value = $at;
				}
			}
		}
		return $best_value;
	}
}
