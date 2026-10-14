import {
	defaultScheduleTime,
	formatInstant,
	formatWallClock,
	safeZone,
	wallClockIn,
} from '../../src/shared/time';

describe( 'time', () => {
	it( 'reads the wall clock in the workspace zone', () => {
		const instant = new Date( '2026-10-13T23:30:00Z' );
		expect( wallClockIn( 'Europe/London', instant ) ).toBe(
			'2026-10-14T00:30'
		);
		expect( wallClockIn( 'America/New_York', instant ) ).toBe(
			'2026-10-13T19:30'
		);
	} );

	it( 'defaults to tomorrow at 09:00 in that zone', () => {
		const instant = new Date( '2026-10-13T23:30:00Z' );
		expect( defaultScheduleTime( 'Europe/London', instant ) ).toBe(
			'2026-10-15T09:00'
		);
		expect( defaultScheduleTime( 'America/New_York', instant ) ).toBe(
			'2026-10-14T09:00'
		);
	} );

	it( 'formats instants in the zone, and wall-clock times as written', () => {
		const zoned = formatInstant(
			'2026-10-15T08:00:00Z',
			'Europe/London',
			'en-GB'
		);
		expect( zoned ).toContain( 'Thu 15 Oct, 9:00' );
		expect( formatWallClock( '2026-10-15T09:00', 'en-GB' ) ).toContain(
			'Thu 15 Oct, 9:00'
		);
		expect( formatInstant( 'nonsense', 'UTC' ) ).toBe( '' );
	} );

	it( 'falls back to UTC for an unknown zone', () => {
		expect( safeZone( 'Not/AZone' ) ).toBe( 'UTC' );
		expect( safeZone( 'Asia/Tokyo' ) ).toBe( 'Asia/Tokyo' );
	} );
} );
