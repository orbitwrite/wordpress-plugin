import {
	EMPTY_DRAFT,
	draftKey,
	prefsKey,
	worthKeeping,
} from '../../src/lib/draft';

describe( 'draft storage', () => {
	it( 'keys drafts per site, user and article', () => {
		expect( draftKey( '1-2', 5 ) ).not.toBe( draftKey( '1-2', 6 ) );
		expect( draftKey( '1-2', 5 ) ).not.toBe( draftKey( '3-2', 5 ) );
		expect( draftKey( '1-2', 5 ) ).not.toBe( draftKey( '1-9', 5 ) );
		expect( draftKey( '1-2', 0 ) ).toBe( 'orbitwrite:draft:v2:1-2:page' );
		expect( prefsKey( '1-2' ) ).not.toBe( prefsKey( '1-9' ) );
	} );

	it( 'keeps a draft only once the person has done something', () => {
		expect(
			worthKeeping( { ...EMPTY_DRAFT, text: 'From the article' } )
		).toBe( false );
		expect( worthKeeping( { ...EMPTY_DRAFT, textTouched: true } ) ).toBe(
			true
		);
		expect(
			worthKeeping( {
				...EMPTY_DRAFT,
				versions: { x: { text: 'a', image: null, synced: true } },
			} )
		).toBe( true );
		expect(
			worthKeeping( { ...EMPTY_DRAFT, at: '2026-10-15T09:00' } )
		).toBe( true );
	} );
} );
