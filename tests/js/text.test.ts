import {
	articleText,
	countFor,
	graphemeCount,
	limitFor,
} from '../../src/lib/text';

describe( 'countFor', () => {
	it( 'counts every link on X as 23 characters', () => {
		const text =
			'Read this https://example.com/a-very-long-path/that-goes-on-and-on';
		expect( countFor( text, { platform: 'twitter', unit: 'chars' } ) ).toBe(
			'Read this '.length + 23
		);
	} );

	it( 'counts links in full elsewhere', () => {
		const text = 'Read https://example.com/x';
		expect(
			countFor( text, { platform: 'bluesky', unit: 'graphemes' } )
		).toBe( text.length );
	} );

	it( 'counts an emoji as one grapheme', () => {
		expect( graphemeCount( '👩‍👩‍👧 hi' ) ).toBe( 4 );
		expect(
			countFor( '👩‍👩‍👧', { platform: 'bluesky', unit: 'graphemes' } )
		).toBe( 1 );
	} );
} );

describe( 'limitFor', () => {
	it( 'uses the tighter caption limit when there is an image', () => {
		const channel = { maxChars: 4096, withMediaMaxChars: 1024 };
		expect( limitFor( channel, false ) ).toBe( 4096 );
		expect( limitFor( channel, true ) ).toBe( 1024 );
	} );

	it( 'is null when the limit is unknown', () => {
		expect(
			limitFor( { maxChars: null, withMediaMaxChars: null }, false )
		).toBeNull();
	} );
} );

describe( 'articleText', () => {
	it( 'puts the title and link on separate paragraphs', () => {
		expect( articleText( ' Hello ', 'https://example.com/hello' ) ).toBe(
			'Hello\n\nhttps://example.com/hello'
		);
		expect( articleText( '', 'https://example.com/hello' ) ).toBe(
			'https://example.com/hello'
		);
	} );
} );
