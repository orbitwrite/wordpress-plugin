import {
	anyBlocked,
	aspectLabel,
	aspectProblem,
	channelNotes,
	channelProblems,
	isPostable,
	unavailableReason,
} from '../../src/lib/rules';

import { channel, image, media } from './fixtures';

const x = channel( { platform: 'twitter', maxChars: 280 } );
const instagram = channel( {
	platform: 'instagram',
	maxChars: 2200,
	unit: 'chars',
	media: media( { required: true, aspectRatio: { min: 0.8, max: 1.91 } } ),
} );
const tiktok = channel( {
	platform: 'tiktok',
	maxChars: 2200,
	media: media( { required: true, images: false, imageMaxBytes: null } ),
} );
const textOnly = channel( {
	platform: 'textonly',
	maxChars: 500,
	media: media( { images: false } ),
} );

const wide = image( { id: 7, url: 'a.png', width: 1200, height: 630 } );
const tall = image( { id: 8, url: 'b.png', width: 1080, height: 1920 } );

describe( 'channel rules', () => {
	it( 'has nothing to say about content that fits', () => {
		expect(
			channelProblems( x, { text: 'Hi', image: wide }, false )
		).toEqual( [] );
		expect(
			channelProblems( instagram, { text: 'Hi', image: wide }, false )
		).toEqual( [] );
	} );

	it( 'asks for text, naming whose', () => {
		expect(
			channelProblems( x, { text: ' ', image: null }, false )
		).toEqual( [ 'Write the main post.' ] );
		expect( channelProblems( x, { text: '', image: null }, true ) ).toEqual(
			[ 'Write this channel’s text.' ]
		);
	} );

	it( 'counts characters over the limit', () => {
		expect(
			channelProblems(
				x,
				{ text: 'a'.repeat( 283 ), image: null },
				false
			)
		).toEqual( [ '3 characters over the limit.' ] );
	} );

	it( 'says when a network needs an image, or takes none', () => {
		expect(
			channelProblems( instagram, { text: 'Hi', image: null }, true )
		).toEqual( [ 'Needs an image.' ] );
		expect(
			channelProblems( textOnly, { text: 'Hi', image: wide }, false )[ 0 ]
		).toMatch( /own version without one/ );
	} );

	it( 'checks the image shape', () => {
		expect(
			channelProblems( instagram, { text: 'Hi', image: tall }, false )
		).toEqual( [
			'Images can be no narrower than 4:5, and this one is 9:16.',
		] );
		expect( aspectProblem( 0, 0, { min: 0.8 } ) ).toBeNull();
		expect(
			aspectProblem( 1080, 1350, { min: 0.8, max: 1.91 } )
		).toBeNull();
		expect( aspectLabel( 1.91 ) ).toBe( '1.91:1' );
		expect( aspectLabel( 0.8 ) ).toBe( '4:5' );
	} );

	it( 'keeps video-only and disconnected channels out of reach, saying why', () => {
		expect( isPostable( tiktok ) ).toBe( false );
		expect( unavailableReason( tiktok ) ).toMatch( /Only takes video/ );
		expect( isPostable( { ...x, needsReconnect: true } ) ).toBe( false );
		expect( isPostable( x ) ).toBe( true );
		expect( unavailableReason( x ) ).toBeUndefined();
	} );
} );

describe( 'image types', () => {
	const linkedin = channel( {
		platform: 'linkedin_personal',
		maxChars: 3000,
		media: media( {
			imageTypes: [ 'image/jpeg', 'image/png', 'image/gif' ],
		} ),
	} );
	const webp = { ...wide, mime: 'image/webp' };

	it( 'notes an unaccepted type without blocking the send', () => {
		expect(
			channelProblems( linkedin, { text: 'Hi', image: webp }, false )
		).toEqual( [] );
		expect( channelNotes( linkedin, { image: webp } ) ).toEqual( [
			'Takes JPEG, PNG, GIF images, not WEBP. A copy in one of those types is sent if WordPress has one.',
		] );
	} );

	it( 'has nothing to note for an accepted type, or a network that does not say', () => {
		expect(
			channelNotes( linkedin, { image: { ...wide, mime: 'image/png' } } )
		).toEqual( [] );
		expect( channelNotes( x, { image: webp } ) ).toEqual( [] );
		expect(
			channelNotes(
				{ ...linkedin, media: media( { imageTypes: [] } ) },
				{ image: webp }
			)
		).toEqual( [] );
	} );
} );

describe( 'anyBlocked', () => {
	const main = { text: 'Hi', image: null };
	const ig = { ...instagram, id: 'acc_ig' };

	it( 'blocks when a picked channel cannot take what it would send', () => {
		expect( anyBlocked( [ x ], main, {} ) ).toBe( false );
		expect( anyBlocked( [ x, ig ], main, {} ) ).toBe( true );
	} );

	it( 'checks a channel with its own version against that version', () => {
		const versions = {
			acc_ig: { text: 'Hi', image: wide, synced: false },
		};
		expect( anyBlocked( [ x, ig ], main, versions ) ).toBe( false );
	} );
} );
