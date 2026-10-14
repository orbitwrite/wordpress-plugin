import { stillMoving } from '../../src/shared/still-moving';

describe( 'stillMoving', () => {
	const share = ( status ) => ( { groupId: 'grp_1', status } );

	it( 'keeps looking while a post is publishing or auto-share has the article', () => {
		expect(
			stillMoving( {
				shares: [ share( 'publishing' ) ],
				autoShare: null,
			} )
		).toBe( true );
		expect(
			stillMoving( { shares: [], autoShare: { state: 'queued' } } )
		).toBe( true );
		expect(
			stillMoving( { shares: [ share( 'scheduled' ) ], autoShare: null } )
		).toBe( false );
	} );

	it( 'waits for a pending auto-share only right after the editor publishes', () => {
		const answer = {
			shares: [],
			autoShare: { pending: true, enabled: true, state: null },
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
