import { stillMoving } from '../../src/lib/shares';
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
