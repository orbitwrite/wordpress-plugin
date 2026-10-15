import {
	channelName,
	channelNames,
	versionLabel,
} from '../../src/lib/channels';
import { toggle } from '../../src/lib/list';
import { channel } from './fixtures';

describe( 'channel names', () => {
	it( 'prefers the display name, then the handle, then the network', () => {
		expect(
			channelName( channel( { displayName: 'Acme', handle: '@acme' } ) )
		).toBe( 'Acme' );
		expect( channelName( channel( { handle: '@acme' } ) ) ).toBe( '@acme' );
		expect( channelName( channel() ) ).toBe( 'X' );
	} );

	it( 'names channels by id, skipping any no longer listed', () => {
		const channels = [
			channel( { id: 'a', displayName: 'Acme' } ),
			channel( { id: 'b', displayName: 'Beta' } ),
		];
		expect( channelNames( [ 'b', 'gone', 'a' ], channels ) ).toEqual( [
			'Beta',
			'Acme',
		] );
	} );

	it( 'names the account in a version label only when the network has two', () => {
		const bluesky = channel( {
			id: 'a',
			platform: 'bluesky',
			platformName: 'Bluesky',
			displayName: 'Acme',
		} );
		expect( versionLabel( bluesky, [ bluesky ] ) ).toBe(
			'Text for Bluesky'
		);
		expect(
			versionLabel( bluesky, [ bluesky, { ...bluesky, id: 'b' } ] )
		).toBe( 'Text for Acme on Bluesky' );
	} );
} );

describe( 'toggle', () => {
	it( 'ticks a value onto the end, once', () => {
		expect( toggle( [ 'a', 'b' ], 'a', true ) ).toEqual( [ 'b', 'a' ] );
		expect( toggle( [ 'a' ], 'c', true ) ).toEqual( [ 'a', 'c' ] );
	} );

	it( 'unticks a value', () => {
		expect( toggle( [ 'a', 'b' ], 'a', false ) ).toEqual( [ 'b' ] );
		expect( toggle( [ 'a' ], 'c', false ) ).toEqual( [ 'a' ] );
	} );
} );
