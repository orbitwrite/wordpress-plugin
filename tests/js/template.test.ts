/**
 * The cases from tests/php/TemplateTest.php: the preview fills a template in
 * exactly as the share does.
 */
import { renderTemplate, unknownTags } from '../../src/lib/template';

const values = {
	title: 'Hello world',
	url: 'https://example.com/hello-world/',
	excerpt: 'A short summary.',
	author: 'Sam',
	hashtags: '#News #SocialMedia',
};

describe( 'renderTemplate', () => {
	it( 'fills in the default, the title then the link', () => {
		expect( renderTemplate( '{title}\n\n{url}', values ) ).toBe(
			'Hello world\n\nhttps://example.com/hello-world/'
		);
	} );

	it( 'fills in every tag', () => {
		expect(
			renderTemplate(
				'{title} by {author}\n{excerpt}\n{url} {hashtags}',
				values
			)
		).toBe(
			'Hello world by Sam\nA short summary.\nhttps://example.com/hello-world/ #News #SocialMedia'
		);
	} );

	it( 'drops a line its tags left empty and folds blank lines', () => {
		expect(
			renderTemplate( '{title}\n\n{excerpt}\n\n{url}', {
				...values,
				excerpt: '',
			} )
		).toBe( 'Hello world\n\nhttps://example.com/hello-world/' );
	} );

	it( 'keeps a line with words of its own when a tag is empty', () => {
		expect(
			renderTemplate( 'Tagged: {hashtags}', { ...values, hashtags: '' } )
		).toBe( 'Tagged:' );
	} );
} );

describe( 'unknownTags', () => {
	it( 'names tags that do not exist', () => {
		expect( unknownTags( '{link} {Title} {title} {url}' ) ).toEqual( [
			'link',
			'Title',
		] );
		expect( unknownTags( '{title}\n\n{url}' ) ).toEqual( [] );
		expect( unknownTags( 'Braces { like this } are just text' ) ).toEqual(
			[]
		);
	} );
} );
