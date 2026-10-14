import {
	autoSharePending,
	isAutoSharing,
	isFailed,
	numbersLine,
	statusLabel,
	stillMoving,
} from '../../src/lib/shares';
import { autoShare, share as makeShare } from './fixtures';

describe( 'stillMoving', () => {
	const share = ( status: string ) => makeShare( { status } );

	it( 'keeps looking while a post is publishing or auto-share has the article', () => {
		expect(
			stillMoving( {
				shares: [ share( 'publishing' ) ],
				autoShare: null,
			} )
		).toBe( true );
		expect(
			stillMoving( {
				shares: [],
				autoShare: autoShare( { state: 'queued' } ),
			} )
		).toBe( true );
		expect(
			stillMoving( { shares: [ share( 'scheduled' ) ], autoShare: null } )
		).toBe( false );
	} );

	it( 'waits for a pending auto-share only right after the editor publishes', () => {
		const answer = {
			shares: [],
			autoShare: autoShare( { pending: true, enabled: true } ),
		};
		expect( stillMoving( answer ) ).toBe( false );
		expect( stillMoving( answer, true ) ).toBe( true );
		expect(
			stillMoving(
				{
					...answer,
					autoShare: { ...answer.autoShare, enabled: false },
				},
				true
			)
		).toBe( false );
	} );
} );

describe( 'statusLabel', () => {
	it( 'puts approval before the status', () => {
		expect( statusLabel( makeShare( { bucket: 'needs_approval' } ) ) ).toBe(
			'Waiting for approval'
		);
		expect(
			statusLabel( makeShare( { status: 'pending_approval' } ) )
		).toBe( 'Waiting for approval' );
		expect( statusLabel( makeShare( { bucket: 'needs_revision' } ) ) ).toBe(
			'Changes requested'
		);
	} );

	it( 'names each status, and a draft with an error as failed', () => {
		expect( statusLabel( makeShare( { status: 'publishing' } ) ) ).toBe(
			'Publishing'
		);
		expect( statusLabel( makeShare( { status: 'published' } ) ) ).toBe(
			'Published'
		);
		expect( statusLabel( makeShare( { status: 'draft' } ) ) ).toBe(
			'Draft'
		);
		expect(
			statusLabel( makeShare( { status: 'draft', lastError: 'No' } ) )
		).toBe( 'Failed' );
		expect( statusLabel( makeShare( { status: 'anything' } ) ) ).toBe(
			'Scheduled'
		);
	} );
} );

describe( 'isFailed', () => {
	it( 'is an error on a post that did not go out', () => {
		expect( isFailed( makeShare( { lastError: 'No' } ) ) ).toBe( true );
		expect(
			isFailed( makeShare( { lastError: 'No', status: 'published' } ) )
		).toBe( false );
		expect( isFailed( makeShare() ) ).toBe( false );
	} );
} );

describe( 'numbersLine', () => {
	it( 'says nothing until read, then the numbers or that they are coming', () => {
		expect( numbersLine( undefined ) ).toBeNull();
		expect(
			numbersLine( {
				impressions: 5,
				reactions: null,
				comments: null,
				reposts: null,
				clicks: 2,
			} )
		).toBe( '5 impressions · 2 link clicks' );
		expect(
			numbersLine( {
				impressions: null,
				reactions: null,
				comments: null,
				reposts: null,
				clicks: null,
			} )
		).toBe( 'Numbers appear here once the networks report them.' );
	} );
} );

describe( 'auto-share state', () => {
	it( 'is sending while queued or sending', () => {
		expect( isAutoSharing( autoShare( { state: 'queued' } ) ) ).toBe(
			true
		);
		expect( isAutoSharing( autoShare( { state: 'sending' } ) ) ).toBe(
			true
		);
		expect( isAutoSharing( autoShare( { state: 'sent' } ) ) ).toBe( false );
		expect( isAutoSharing( null ) ).toBe( false );
	} );

	it( 'is pending only until someone shares by hand', () => {
		const pending = autoShare( { pending: true } );
		expect( autoSharePending( { shares: [], autoShare: pending } ) ).toBe(
			true
		);
		expect(
			autoSharePending( { shares: [ makeShare() ], autoShare: pending } )
		).toBe( false );
		expect( autoSharePending( { shares: [], autoShare: null } ) ).toBe(
			false
		);
	} );
} );
