import {
	backToMainPost,
	contentFor,
	copyMainPost,
	editVersion,
	giveOwnVersion,
	hasOwnVersion,
	mainPostInUse,
	sendPayload,
} from '../../src/lib/versions';
import { image } from './fixtures';

const main = {
	text: 'New post https://example.com/a',
	image: image( { id: 7, url: 'a.png', alt: 'Banner' } ),
};

describe( 'channel versions', () => {
	it( 'uses the main post until a channel is given its own', () => {
		expect( hasOwnVersion( {}, 'x' ) ).toBe( false );
		expect( contentFor( main, {}, 'x' ) ).toBe( main );
	} );

	it( 'starts a channel’s own version as a copy of the main post', () => {
		const versions = giveOwnVersion( {}, 'x', main );
		expect( hasOwnVersion( versions, 'x' ) ).toBe( true );
		expect( contentFor( main, versions, 'x' ) ).toEqual( {
			text: main.text,
			image: main.image,
			synced: false,
		} );
	} );

	it( 'keeps what was written when the channel goes back to the main post', () => {
		let versions = giveOwnVersion( {}, 'x', main );
		versions = editVersion( versions, 'x', { text: 'Thread time' } );
		versions = backToMainPost( versions, 'x' );
		expect( contentFor( main, versions, 'x' ) ).toBe( main );

		versions = giveOwnVersion( versions, 'x', {
			text: 'a newer main post',
			image: null,
		} );
		expect( contentFor( main, versions, 'x' ).text ).toBe( 'Thread time' );
	} );

	it( 'can start a version again from the main post', () => {
		let versions = giveOwnVersion( {}, 'x', main );
		versions = editVersion( versions, 'x', {
			text: 'Edited',
			image: null,
		} );
		versions = copyMainPost( versions, 'x', main );
		expect( contentFor( main, versions, 'x' ).text ).toBe( main.text );
		expect( contentFor( main, versions, 'x' ).image ).toBe( main.image );
	} );

	it( 'knows when nobody uses the main post', () => {
		const versions = giveOwnVersion( {}, 'x', main );
		expect( mainPostInUse( [ 'x', 'y' ], versions ) ).toBe( true );
		expect( mainPostInUse( [ 'x' ], versions ) ).toBe( false );
	} );

	it( 'sends synced channels bare and own versions in full', () => {
		let versions = giveOwnVersion( {}, 'bsky', main );
		versions = editVersion( versions, 'bsky', {
			text: 'Bluesky words',
			image: null,
		} );
		// A version that went back to the main post is sent as synced.
		versions = giveOwnVersion( versions, 'li', main );
		versions = backToMainPost( versions, 'li' );

		expect( sendPayload( [ 'x', 'bsky', 'li' ], main, versions ) ).toEqual(
			{
				text: main.text,
				attachmentId: 7,
				altText: 'Banner',
				channels: [
					{ accountId: 'x', synced: true },
					{
						accountId: 'bsky',
						synced: false,
						text: 'Bluesky words',
						attachmentId: 0,
						altText: '',
					},
					{ accountId: 'li', synced: true },
				],
			}
		);
	} );
} );
