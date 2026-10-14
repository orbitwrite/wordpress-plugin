/**
 * Times in the workspace's timezone.
 *
 * Every time the composer shows or takes is in the Orbitwrite workspace's
 * zone, labelled as such, so 9am is the 9am on the Orbitwrite calendar
 * whatever the browser or WordPress is set to. The server does the
 * conversion to UTC; the browser only formats.
 */

/**
 * A zone Intl accepts, or UTC.
 *
 * @param {string} timeZone
 * @return {string} Zone.
 */
export function safeZone( timeZone ) {
	try {
		new Intl.DateTimeFormat( 'en', { timeZone } );
		return timeZone;
	} catch ( e ) {
		return 'UTC';
	}
}

const DISPLAY = {
	weekday: 'short',
	day: 'numeric',
	month: 'short',
	hour: 'numeric',
	minute: '2-digit',
};

/**
 * An instant shown in a zone, e.g. "Thu 15 Oct, 09:00".
 *
 * @param {string} iso
 * @param {string} timeZone
 * @param {string} [locale]
 * @return {string} Formatted.
 */
export function formatInstant( iso, timeZone, locale ) {
	const date = new Date( iso );
	if ( Number.isNaN( date.getTime() ) ) {
		return '';
	}
	return new Intl.DateTimeFormat( locale, {
		...DISPLAY,
		timeZone: safeZone( timeZone ),
	} ).format( date );
}

/**
 * A wall-clock time (`YYYY-MM-DDTHH:MM`) shown as-is, e.g. "Thu 15 Oct, 09:00".
 * Formatted as UTC because it is already the zone's own wall clock.
 *
 * @param {string} local
 * @param {string} [locale]
 * @return {string} Formatted.
 */
export function formatWallClock( local, locale ) {
	const date = new Date( `${ local }:00Z` );
	if ( Number.isNaN( date.getTime() ) ) {
		return '';
	}
	return new Intl.DateTimeFormat( locale, {
		...DISPLAY,
		timeZone: 'UTC',
	} ).format( date );
}

/**
 * The wall clock in a zone at an instant, as `YYYY-MM-DDTHH:MM`.
 *
 * @param {string} timeZone
 * @param {Date}   [now]
 * @return {string} Wall-clock time.
 */
export function wallClockIn( timeZone, now = new Date() ) {
	const parts = {};
	for ( const part of new Intl.DateTimeFormat( 'en-GB', {
		timeZone: safeZone( timeZone ),
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		hourCycle: 'h23',
	} ).formatToParts( now ) ) {
		parts[ part.type ] = part.value;
	}
	return `${ parts.year }-${ parts.month }-${ parts.day }T${ parts.hour }:${ parts.minute }`;
}

/**
 * Tomorrow at 09:00 in a zone: the date-time picker's starting value.
 *
 * @param {string} timeZone
 * @param {Date}   [now]
 * @return {string} Wall-clock time.
 */
export function defaultScheduleTime( timeZone, now = new Date() ) {
	const today = wallClockIn( timeZone, now ).slice( 0, 10 );
	const date = new Date( `${ today }T00:00:00Z` );
	date.setUTCDate( date.getUTCDate() + 1 );
	return `${ date.toISOString().slice( 0, 10 ) }T09:00`;
}
