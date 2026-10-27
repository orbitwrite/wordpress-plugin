/* eslint-disable no-console */
/* global NodeFilter */
/**
 * The screenshots on the WordPress.org plugin page, taken from the test site
 * against the mock Orbitwrite. Numbered as readme.txt's == Screenshots ==.
 *
 * Run through `npm run screenshots` (tests/e2e/run.sh), which sets everything
 * up. They land in .wordpress-org/, which the deploy uploads to SVN assets/.
 */
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright-core';

const SITE = process.env.SITE_URL || 'http://127.0.0.1:8080';
const SITE_DIR = process.env.SITE_DIR;
const OUT = new URL( '../../.wordpress-org/', import.meta.url ).pathname;

function wp( ...args ) {
	return execFileSync(
		'php',
		[
			'-d',
			'error_reporting=E_ALL&~E_DEPRECATED',
			'wp-cli.phar',
			'--allow-root',
			'--path=wordpress',
			...args,
		],
		{ cwd: SITE_DIR, encoding: 'utf8' }
	).trim();
}

// An article worth sharing, with a featured image that isn't noise.
execFileSync(
	'php',
	[
		'-r',
		'$w = 1600; $h = 840; $im = imagecreatetruecolor( $w, $h ); for ( $x = 0; $x < $w; $x++ ) { $t = $x / $w; imageline( $im, $x, 0, $x, $h, imagecolorallocate( $im, (int) ( 251 - 105 * $t ), (int) ( 176 - 145 * $t ), (int) ( 64 + 170 * $t ) ) ); } imagepng( $im, "roadmap.png" );',
	],
	{ cwd: SITE_DIR }
);
const postId = wp(
	'post',
	'create',
	'--post_title=Our autumn roadmap: three things shipping before December',
	'--post_content=<!-- wp:paragraph --><p>Here is what the team is working on for the rest of the year, and why each one matters to you.</p><!-- /wp:paragraph --><!-- wp:heading --><h2 class="wp-block-heading">1. Faster publishing</h2><!-- /wp:heading --><!-- wp:paragraph --><p>Posts go out in seconds, and you hear straight away if a network turns one down.</p><!-- /wp:paragraph -->',
	'--post_status=publish',
	'--post_author=1',
	'--porcelain'
);
wp(
	'media',
	'import',
	'roadmap.png',
	`--post_id=${ postId }`,
	'--featured_image',
	'--alt=An orange to purple gradient',
	'--porcelain'
);

const TEXT =
	'Our autumn roadmap is out: three things shipping before December, starting with faster publishing.';

const browser = await chromium.launch(
	process.env.CHROMIUM_PATH
		? { executablePath: process.env.CHROMIUM_PATH }
		: {}
);
const page = await browser.newPage( {
	viewport: { width: 1400, height: 1200 },
	deviceScaleFactor: 2,
} );
// The test site's SQLite notice in the admin bar isn't part of the plugin.
const hideSqlite = () =>
	page.addStyleTag( {
		content: '#wp-admin-bar-sqlite-db-integration { display: none; }',
	} );
// Links read as a real site's rather than the test server's.
const PRETTY = 'https://example.blog';
const prettyLinks = () =>
	page.evaluate(
		( [ from, to ] ) => {
			const walker = document.createTreeWalker(
				document.body,
				NodeFilter.SHOW_TEXT
			);
			while ( walker.nextNode() ) {
				walker.currentNode.nodeValue =
					walker.currentNode.nodeValue.replaceAll( from, to );
			}
		},
		[ SITE, PRETTY ]
	);
// Once the next free slot has loaded, the button names it.
const slotLoaded = () =>
	page.waitForFunction( () =>
		/Schedule for (Mon|Tue|Wed|Thu|Fri|Sat|Sun)/.test(
			document.querySelector( '.orbitwrite-composer__send' )
				?.textContent || ''
		)
	);

try {
	await page.goto( `${ SITE }/wp-login.php` );
	await page.fill( '#user_login', 'admin' );
	await page.fill( '#user_pass', 'password' );
	await page.click( '#wp-submit' );
	await page.waitForURL( /wp-admin/ );

	await page.goto( `${ SITE }/wp-admin/admin.php?page=orbitwrite` );
	await page.getByRole( 'link', { name: 'Connect Orbitwrite' } ).click();
	await page.waitForURL( /page=orbitwrite/ );
	await page
		.locator( '.orbitwrite-composer' )
		.getByRole( 'checkbox', { name: /Acme on X/ } )
		.waitFor();

	// 1. The block editor sidebar.
	await page.goto(
		`${ SITE }/wp-admin/post.php?post=${ postId }&action=edit&classic-editor__forget`
	);
	await page.waitForFunction( () =>
		window.wp?.data?.select( 'core/editor' )?.getCurrentPostId()
	);
	await page.evaluate( () => {
		const prefs = window.wp.data.dispatch( 'core/preferences' );
		prefs.set( 'core/edit-post', 'welcomeGuide', false );
		prefs.set( 'core', 'welcomeGuide', false );
		window.wp.data
			.dispatch( 'core/interface' )
			.enableComplementaryArea( 'core', 'orbitwrite/orbitwrite-sidebar' );
	} );
	await hideSqlite();
	const main = page.getByLabel( 'Main post', { exact: true } );
	await main.waitFor();
	await page.locator( '.orbitwrite-image__thumb' ).first().waitFor();
	await main.fill( `${ TEXT }\n\n${ PRETTY }/our-autumn-roadmap/` );
	await page.getByRole( 'radio', { name: 'Next slot' } ).check();
	await slotLoaded();
	await main.blur();
	await page.screenshot( { path: `${ OUT }screenshot-1.png` } );

	// 2. The Orbitwrite page: the last four weeks and a composer.
	await page.setViewportSize( { width: 1400, height: 1000 } );
	await page.goto( `${ SITE }/wp-admin/admin.php?page=orbitwrite` );
	await hideSqlite();
	await page.locator( '.orbitwrite-summary' ).getByText( '18,240' ).waitFor();
	await page
		.getByLabel( 'Main post', { exact: true } )
		.fill( 'New in the shop this week: our autumn colours are back.' );
	await page.getByRole( 'radio', { name: 'Next slot' } ).check();
	await slotLoaded();
	await page.getByLabel( 'Main post', { exact: true } ).blur();
	await page.screenshot( { path: `${ OUT }screenshot-2.png` } );

	// 3. Auto-share settings. A tall viewport rather than fullPage, which
	// leaves the fixed admin bar halfway down.
	await page.setViewportSize( { width: 1400, height: 1240 } );
	await page.goto(
		`${ SITE }/wp-admin/admin.php?page=orbitwrite-auto-share`
	);
	await hideSqlite();
	const settings = page.locator( '.orbitwrite-auto-share' );
	await settings
		.getByRole( 'checkbox', {
			name: 'Share my articles when they’re published',
		} )
		.check();
	await settings.getByRole( 'checkbox', { name: /Acme on X/ } ).check();
	await settings.getByRole( 'checkbox', { name: /Bluesky/ } ).check();
	await settings
		.getByLabel( 'Text', { exact: true } )
		.fill( 'New on the blog: {title}\n\n{url} {hashtags}' );
	await settings
		.locator( '.orbitwrite-auto-share__preview' )
		.getByText( /Our autumn roadmap/ )
		.first()
		.waitFor();
	await settings.getByLabel( 'Text', { exact: true } ).blur();
	await prettyLinks();
	// Let the toggle finish sliding.
	await page.waitForTimeout( 500 );
	await page.screenshot( { path: `${ OUT }screenshot-3.png` } );

	console.log( `Screenshots in ${ OUT }` );
} finally {
	await browser.close();
}
