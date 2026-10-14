import {
	mainPostHelp,
	sendLabel,
	sentNotice,
} from '../../src/composer/messages';
import { channel, share } from './fixtures';

describe( 'sendLabel', () => {
	it( 'says what the button does for each choice', () => {
		expect( sendLabel( 'now', undefined, '', 'UTC' ) ).toBe(
			'Publish now'
		);
		expect( sendLabel( 'next', undefined, '', 'UTC' ) ).toBe(
			'Schedule for next free slot'
		);
		expect( sendLabel( 'at', undefined, '', 'UTC' ) ).toBe( 'Schedule' );
	} );

	it( 'names the time once there is one', () => {
		expect(
			sendLabel( 'next', '2026-10-15T09:00:00Z', '', 'UTC' )
		).toMatch( /^Schedule for .*15/ );
		expect(
			sendLabel( 'at', undefined, '2026-10-15T09:00', 'UTC' )
		).toMatch( /^Schedule for .*15/ );
	} );
} );

describe( 'sentNotice', () => {
	it( 'says publishing now, with the first post’s link', () => {
		expect(
			sentNotice(
				[ share( { status: 'publishing', openUrl: 'https://o/1' } ) ],
				'UTC'
			)
		).toEqual( {
			type: 'success',
			message: 'Sent to Orbitwrite. Publishing now.',
			openUrl: 'https://o/1',
		} );
	} );

	it( 'says when it is scheduled, and how many posts it became', () => {
		const notice = sentNotice(
			[
				share( { scheduledAt: '2026-10-15T09:00:00Z' } ),
				share( { groupId: 'grp_2' } ),
			],
			'UTC'
		);
		expect( notice.message ).toMatch( /^Scheduled for .*\. / );
		expect( notice.message ).toMatch( /2 posts, one per version\.$/ );
	} );
} );

describe( 'mainPostHelp', () => {
	const a = channel( { id: 'a', displayName: 'Acme' } );
	const b = channel( { id: 'b', displayName: 'Beta' } );

	it( 'says nothing when every picked channel uses the main post', () => {
		expect( mainPostHelp( [], [] ) ).toBeUndefined();
		expect( mainPostHelp( [ a, b ], [ a, b ] ) ).toBeUndefined();
	} );

	it( 'names who uses it, or says nobody does', () => {
		expect( mainPostHelp( [ a, b ], [ b ] ) ).toBe( 'Sent to Beta.' );
		expect( mainPostHelp( [ a, b ], [] ) ).toBe(
			"Every channel has its own version, so the main post won't be sent."
		);
	} );
} );
