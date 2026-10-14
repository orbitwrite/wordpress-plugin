import { formatChange, numberPhrases } from '../../src/lib/numbers';

describe( 'numberPhrases', () => {
	it( 'says each reported number, in order', () => {
		expect(
			numberPhrases( {
				impressions: 1204,
				reactions: 1,
				comments: 0,
				reposts: null,
				clicks: 12,
			} )
		).toEqual( [
			'1,204 impressions',
			'1 reaction',
			'0 comments',
			'12 link clicks',
		] );
	} );

	it( 'leaves out what nothing reported, rather than saying 0', () => {
		expect(
			numberPhrases( {
				impressions: null,
				reactions: null,
				comments: null,
				reposts: null,
				clicks: null,
			} )
		).toEqual( [] );
		expect( numberPhrases( undefined ) ).toEqual( [] );
	} );
} );

describe( 'formatChange', () => {
	it( 'signs and rounds the change', () => {
		expect( formatChange( 24.6 ) ).toBe( '+25%' );
		expect( formatChange( -3.2 ) ).toBe( '−3%' );
		expect( formatChange( 0.4 ) ).toBe( 'No change' );
	} );

	it( 'says nothing when there is nothing to compare with', () => {
		expect( formatChange( null ) ).toBeNull();
		expect( formatChange( Infinity ) ).toBeNull();
	} );
} );
