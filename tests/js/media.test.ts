import { imageFromPicked, imageFromRest } from '../../src/lib/media';

describe( 'imageFromRest', () => {
	it( 'takes the medium size where there is one', () => {
		expect(
			imageFromRest( {
				id: 7,
				source_url: 'full.png',
				alt_text: 'Banner',
				mime_type: 'image/png',
				media_details: {
					width: 1200,
					height: 630,
					sizes: { medium: { source_url: 'medium.png' } },
				},
			} )
		).toEqual( {
			id: 7,
			url: 'medium.png',
			alt: 'Banner',
			mime: 'image/png',
			width: 1200,
			height: 630,
		} );
	} );

	it( 'falls back to the full size and empty details', () => {
		expect( imageFromRest( { id: 7, source_url: 'full.png' } ) ).toEqual( {
			id: 7,
			url: 'full.png',
			alt: '',
			mime: '',
			width: 0,
			height: 0,
		} );
	} );

	it( 'is null without an attachment or a URL', () => {
		expect( imageFromRest( null ) ).toBeNull();
		expect( imageFromRest( undefined ) ).toBeNull();
		expect( imageFromRest( { id: 7, source_url: '' } ) ).toBeNull();
	} );
} );

describe( 'imageFromPicked', () => {
	it( 'takes the medium size where there is one', () => {
		expect(
			imageFromPicked( {
				id: 7,
				url: 'full.png',
				sizes: { medium: { url: 'medium.png' } },
				width: 10,
				height: 20,
			} )
		).toEqual( {
			id: 7,
			url: 'medium.png',
			alt: '',
			mime: '',
			width: 10,
			height: 20,
		} );
		expect( imageFromPicked( { id: 7, url: 'full.png' } ).url ).toBe(
			'full.png'
		);
	} );
} );
