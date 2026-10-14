<?php
/**
 * @package Orbitwrite
 */

use Orbitwrite\WordPress\Schedule_Time;
use PHPUnit\Framework\TestCase;

final class ScheduleTimeTest extends TestCase {

	private function now(): DateTimeImmutable {
		return new DateTimeImmutable( '2026-10-13T12:00:00Z' );
	}

	private function no_slot(): callable {
		return function () {
			$this->fail( 'The slot lookup should not be called.' );
		};
	}

	public function test_now_publishes_now_with_the_current_instant(): void {
		$this->assertSame(
			array(
				'scheduled_at' => '2026-10-13T12:00:00Z',
				'publish_now'  => true,
			),
			Schedule_Time::resolve( 'now', '', 'Europe/London', $this->now(), $this->no_slot() )
		);
	}

	public function test_a_wall_clock_time_is_read_in_the_workspace_zone(): void {
		$result = Schedule_Time::resolve( 'at', '2026-10-15T09:00', 'Europe/London', $this->now(), $this->no_slot() );
		// London is on BST (UTC+1) in October.
		$this->assertSame( '2026-10-15T08:00:00Z', $result['scheduled_at'] );
		$this->assertFalse( $result['publish_now'] );

		$result = Schedule_Time::resolve( 'at', '2026-10-15T09:00', 'America/New_York', $this->now(), $this->no_slot() );
		$this->assertSame( '2026-10-15T13:00:00Z', $result['scheduled_at'] );
	}

	public function test_a_past_time_is_refused(): void {
		$result = Schedule_Time::resolve( 'at', '2026-10-13T12:30', 'Europe/London', $this->now(), $this->no_slot() );
		$this->assertInstanceOf( WP_Error::class, $result );
		$this->assertSame( 'orbitwrite_past_time', $result->get_error_code() );
	}

	public function test_times_that_do_not_exist_are_refused(): void {
		// Feb 30th, and a time inside the March spring-forward gap.
		$this->assertNull( Schedule_Time::wall_clock_to_instant( '2027-02-30T09:00', 'UTC' ) );
		$this->assertNull( Schedule_Time::wall_clock_to_instant( '2027-03-28T01:30', 'Europe/London' ) );
		$this->assertNull( Schedule_Time::wall_clock_to_instant( 'tomorrow 9am', 'UTC' ) );
		$this->assertNull( Schedule_Time::wall_clock_to_instant( '2027-01-01T09:00', 'Not/AZone' ) );
	}

	public function test_next_uses_the_slot_and_normalises_it_to_utc(): void {
		$result = Schedule_Time::resolve(
			'next',
			'',
			'Europe/London',
			$this->now(),
			static function () {
				return '2026-10-14T09:00:00+01:00';
			}
		);
		$this->assertSame( '2026-10-14T08:00:00Z', $result['scheduled_at'] );
		$this->assertFalse( $result['publish_now'] );
	}

	public function test_next_passes_on_the_lookup_error(): void {
		$error  = new WP_Error( 'orbitwrite_no_slot', 'No slot' );
		$result = Schedule_Time::resolve(
			'next',
			'',
			'UTC',
			$this->now(),
			static function () use ( $error ) {
				return $error;
			}
		);
		$this->assertSame( $error, $result );
	}

	public function test_an_unknown_choice_is_refused(): void {
		$this->assertInstanceOf( WP_Error::class, Schedule_Time::resolve( 'later', '', 'UTC', $this->now(), $this->no_slot() ) );
	}

	public function test_earliest_suggestion_compares_instants_not_strings(): void {
		// 09:00+01:00 is 08:00Z, earlier than 08:30Z, though it sorts later
		// as a string.
		$this->assertSame(
			'2026-10-14T09:00:00+01:00',
			Schedule_Time::earliest_suggestion(
				array(
					array( 'times' => array( array( 'at' => '2026-10-14T08:30:00+00:00' ) ) ),
					array( 'times' => array( array( 'at' => '2026-10-14T09:00:00+01:00' ) ) ),
					array( 'times' => array() ),
				)
			)
		);
	}

	public function test_earliest_suggestion_is_null_without_any_time(): void {
		$this->assertNull( Schedule_Time::earliest_suggestion( array( array( 'times' => array() ) ) ) );
		$this->assertNull( Schedule_Time::earliest_suggestion( array() ) );
	}
}
