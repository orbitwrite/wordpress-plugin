/* eslint-disable no-console */
/**
 * Drives the plugin in a real browser against a test site and the mock
 * Orbitwrite: connect, compose in the block editor, schedule, publish now,
 * a published post's numbers, delete, a refused token being refreshed, a
 * past time refused, the last four weeks, auto-share, disconnect.
 *
 * Run through `npm run test:e2e` (tests/e2e/run.sh), which sets everything
 * up. Screenshots land in tests/e2e/shots/.
 *
 * Env: SITE_URL, MOCK_URL, POST_ID (an article with a featured image),
 * SITE_DIR (the test site, for running its cron with WP-CLI),
 * CHROMIUM_PATH (optional; otherwise Playwright's own browser).
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';

const SITE = process.env.SITE_URL || 'http://127.0.0.1:8080';
const MOCK = process.env.MOCK_URL || 'http://127.0.0.1:4010';
const POST_ID = process.env.POST_ID;
const SITE_DIR = process.env.SITE_DIR;
const OUT = new URL( './shots/', import.meta.url ).pathname;
mkdirSync( OUT, { recursive: true } );

const results = [];
function check( name, ok, detail = '' ) {
	results.push( { name, ok, detail } );
	console.log(
		`${ ok ? 'PASS' : 'FAIL' }  ${ name }${
			detail ? `  — ${ detail }` : ''
		}`
	);
}
const mockLog = async () => ( await fetch( `${ MOCK }/__log` ) ).json();
const creates = async () =>
	( await mockLog() ).filter(
		( entry ) => entry.method === 'POST' && entry.path === '/posts'
	);

/**
 * Run the site's due cron events now, as WordPress's own cron would, with
 * nobody signed in.
 */
function runCron() {
	execFileSync(
		'php',
		[
			'-d',
			'error_reporting=E_ALL&~E_DEPRECATED',
			'wp-cli.phar',
			'--allow-root',
			'--path=wordpress',
			'cron',
			'event',
			'run',
			'--due-now',
		],
		{ cwd: SITE_DIR, stdio: 'ignore' }
	);
}

const browser = await chromium.launch(
	process.env.CHROMIUM_PATH
		? { executablePath: process.env.CHROMIUM_PATH }
		: {}
);
const page = await browser.newPage( {
	viewport: { width: 1400, height: 1000 },
} );
const consoleErrors = [];
page.on(
	'console',
	( msg ) => msg.type() === 'error' && consoleErrors.push( msg.text() )
);
page.on( 'pageerror', ( err ) => consoleErrors.push( String( err ) ) );

try {
	// Sign in.
	await page.goto( `${ SITE }/wp-login.php` );
	await page.fill( '#user_login', 'admin' );
	await page.fill( '#user_pass', 'password' );
	await page.click( '#wp-submit' );
	await page.waitForURL( /wp-admin/ );

	// 1. The admin page offers to connect.
	await page.goto( `${ SITE }/wp-admin/admin.php?page=orbitwrite` );
	await page.locator( '.orbitwrite-composer' ).waitFor();
	await page.waitForTimeout( 500 );
	if ( await page.getByRole( 'button', { name: 'Disconnect' } ).count() ) {
		await page.getByRole( 'button', { name: 'Disconnect' } ).click();
	}
	const connect = page.getByRole( 'link', { name: 'Connect Orbitwrite' } );
	await connect.waitFor();
	check( 'admin page shows Connect', true );
	await page.screenshot( { path: `${ OUT }01-connect.png` } );

	// 2. Connect: through the mock's authorize (which fetches our CIMD doc) and back.
	await connect.click();
	await page.waitForURL( /page=orbitwrite/ );
	await page
		.locator( '.orbitwrite-composer' )
		.getByText( 'Connected to Acme on Orbitwrite.' )
		.waitFor();
	check( 'OAuth round trip lands back connected', true );
	await page
		.locator( '.orbitwrite-composer' )
		.getByRole( 'checkbox', { name: /Acme on X/ } )
		.waitFor();
	// Channels that can't be picked are folded into one line.
	const fold = page
		.locator( '.orbitwrite-composer' )
		.getByRole( 'button', { name: '2 channels unavailable' } );
	await fold.waitFor();
	check(
		'unavailable channels are folded away',
		( await page.getByRole( 'checkbox', { name: /Acme Ltd/ } ).count() ) ===
			0
	);
	await fold.click();
	const liDisabled = await page
		.getByRole( 'checkbox', { name: /Acme Ltd/ } )
		.isDisabled();
	check( 'channel needing reconnect is disabled', liDisabled );
	check(
		'disconnected channel is hidden',
		( await page
			.locator( '.orbitwrite-composer' )
			.getByText( 'Old', { exact: true } )
			.count() ) === 0
	);
	const tiktokRow = page.locator( '.orbitwrite-channel-row', {
		hasText: 'TikTok',
	} );
	check(
		'video-only channel is listed but disabled, saying why',
		( await tiktokRow.getByRole( 'checkbox' ).isDisabled() ) &&
			( await tiktokRow.innerText() ).includes( 'Only takes video' )
	);
	const sameBoxes = page.getByRole( 'checkbox', {
		name: 'Same as main post',
	} );
	const withTwo = await sameBoxes.count();
	await page.getByRole( 'checkbox', { name: /Bluesky/ } ).uncheck();
	const withOne = await sameBoxes.count();
	await page.getByRole( 'checkbox', { name: /Bluesky/ } ).check();
	check(
		'"Same as main post" only offered with two or more channels',
		withTwo === 2 && withOne === 0,
		`${ withTwo } then ${ withOne }`
	);
	await page.screenshot( {
		path: `${ OUT }02-connected-admin.png`,
		fullPage: true,
	} );

	let log;

	// 3. The block editor sidebar, prefilled from the article. Classic Editor
	// is installed and would open this blockless article in the classic
	// screen; `classic-editor__forget` asks for the block editor (and, with
	// `classic-editor`, for the classic one) explicitly.
	await page.goto(
		`${ SITE }/wp-admin/post.php?post=${ POST_ID }&action=edit&classic-editor__forget`
	);
	await page.waitForFunction( () =>
		window.wp?.data?.select( 'core/editor' )?.getCurrentPostId()
	);
	await page.evaluate( () => {
		window.wp.data
			.dispatch( 'core/preferences' )
			.set( 'core/edit-post', 'welcomeGuide', false );
		window.wp.data
			.dispatch( 'core/preferences' )
			.set( 'core', 'welcomeGuide', false );
		const ui = window.wp.data.dispatch( 'core/interface' );
		ui.enableComplementaryArea( 'core', 'orbitwrite/orbitwrite-sidebar' );
	} );
	const textarea = page.getByLabel( 'Main post', { exact: true } );
	await textarea.waitFor();
	await page.waitForFunction( () =>
		document
			.querySelector( '.orbitwrite-composer textarea' )
			?.value.includes( 'Hello from WordPress' )
	);
	const text = await textarea.inputValue();
	check(
		'text prefilled with title and link',
		text === `Hello from WordPress\n\n${ SITE }/hello-from-wordpress/`,
		JSON.stringify( text )
	);
	await page.locator( '.orbitwrite-image__thumb' ).first().waitFor();
	check( 'featured image shown', true );
	check(
		'alt text prefilled',
		( await page.getByLabel( 'Alt text' ).first().inputValue() ) ===
			'A purple banner'
	);
	const xRow = page.locator( '.orbitwrite-channel-row', {
		hasText: 'Acme on X',
	} );
	const bskyRow = page.locator( '.orbitwrite-channel-row', {
		hasText: 'Bluesky',
	} );
	const xCount = await xRow
		.locator( '.orbitwrite-channel-row__count' )
		.innerText();
	check(
		'X counts the link as 23',
		xCount === `${ 'Hello from WordPress\n\n'.length + 23 }/280`,
		xCount
	);

	// 4. Next free slot.
	await page.getByRole( 'radio', { name: 'Next slot' } ).check();
	const send = page.locator( '.orbitwrite-composer__send' );
	await page.waitForFunction( () =>
		/Schedule for (Mon|Tue|Wed|Thu|Fri|Sat|Sun)/.test(
			document.querySelector( '.orbitwrite-composer__send' )
				?.textContent || ''
		)
	);
	check( 'send button names the slot', true, await send.innerText() );
	await page.screenshot( { path: `${ OUT }03-editor-sidebar.png` } );
	await send.click();
	// Said the way the editor says "Post published": a snackbar.
	await page
		.locator( '.components-snackbar' )
		.getByText( /^Scheduled for/ )
		.first()
		.waitFor();
	check( 'a send is confirmed with an editor snackbar', true );
	await page.locator( '.orbitwrite-sent__item' ).first().waitFor();
	check(
		'sent list shows the scheduled post',
		(
			await page.locator( '.orbitwrite-sent__item' ).first().innerText()
		).includes( 'Scheduled' )
	);
	await page.screenshot( { path: `${ OUT }04-scheduled.png` } );

	log = await mockLog();
	const create = log
		.filter(
			( entry ) => entry.method === 'POST' && entry.path === '/posts'
		)
		.at( -1 );
	const upload = log.find(
		( entry ) => entry.path === '/media/create-upload-url'
	);
	check(
		'image uploaded with alt text',
		upload?.body?.alt_text === 'A purple banner' &&
			upload?.body?.mime_type === 'image/png',
		JSON.stringify( upload?.body )
	);
	check(
		'image sent at the largest size Bluesky takes (2 MB)',
		upload?.body?.width === 1024 &&
			upload.body.size_bytes <= 2_000_000 &&
			upload.body.name !== 'hero.png',
		`${ upload?.body?.name } ${ upload?.body?.size_bytes } bytes`
	);
	check(
		'create body: two synced channels, same text, media id, title, Z instant',
		create &&
			create.body.accounts.map( ( a ) => a.accountId ).join() ===
				'acc_x,acc_bsky' &&
			create.body.accounts.every(
				( a ) =>
					a.isSynced === true &&
					a.items[ 0 ].content === text &&
					a.items[ 0 ].mediaIds?.[ 0 ] === 'med_1'
			) &&
			create.body.info?.title === 'Hello from WordPress' &&
			/Z$/.test( create.body.scheduledAt ) &&
			! create.body.publishNow,
		JSON.stringify( create?.body )
	);
	check(
		'user agent names the plugin',
		/^orbitwrite-wordpress\/0\.1\.0 WordPress\//.test(
			create?.userAgent || ''
		),
		create?.userAgent
	);

	// 4b. Give Bluesky its own version.
	const sameAsMain = bskyRow.getByRole( 'checkbox', {
		name: 'Same as main post',
	} );
	await sameAsMain.uncheck();
	const ownText = bskyRow.getByLabel( 'Text for Bluesky' );
	await ownText.waitFor();
	check(
		'own version starts as a copy of the main post',
		( await ownText.inputValue() ) === text
	);
	const bskyWords = 'Bluesky gets its own words';
	await ownText.fill( bskyWords );
	await bskyRow.getByRole( 'button', { name: 'Remove' } ).click();
	check(
		'own version counts its own text',
		( await bskyRow
			.locator( '.orbitwrite-channel-row__count' )
			.innerText() ) === `${ bskyWords.length }/300`
	);
	check(
		'main post says which channels it is sent to',
		(
			await page.locator( '.orbitwrite-composer__main' ).innerText()
		).includes( 'Sent to Acme on X.' )
	);
	await page.screenshot( { path: `${ OUT }04b-own-version.png` } );

	await sameAsMain.check();
	check(
		'ticking "Same as main post" hides the version',
		( await bskyRow.getByLabel( 'Text for Bluesky' ).count() ) === 0
	);
	await sameAsMain.uncheck();
	check(
		'unticking again restores what was written',
		( await bskyRow.getByLabel( 'Text for Bluesky' ).inputValue() ) ===
			bskyWords
	);

	// The block editor unmounts a closed sidebar; the draft must survive it.
	await page.evaluate( () =>
		window.wp.data
			.dispatch( 'core/interface' )
			.disableComplementaryArea( 'core' )
	);
	await page
		.locator( '.orbitwrite-composer' )
		.waitFor( { state: 'detached' } );
	await page.evaluate( () =>
		window.wp.data
			.dispatch( 'core/interface' )
			.enableComplementaryArea( 'core', 'orbitwrite/orbitwrite-sidebar' )
	);
	await bskyRow.getByLabel( 'Text for Bluesky' ).waitFor();
	check(
		'closing and reopening the sidebar keeps the draft',
		( await bskyRow.getByLabel( 'Text for Bluesky' ).inputValue() ) ===
			bskyWords
	);

	await send.click();
	await page
		.locator( '.components-snackbar' )
		.getByText( /one per version/ )
		.waitFor();
	log = await mockLog();
	const split = log
		.filter(
			( entry ) => entry.method === 'POST' && entry.path === '/posts'
		)
		.at( -1 );
	const [ xEntry, bskyEntry ] = split?.body?.accounts || [];
	check(
		'X stays synced with the main post and its image',
		xEntry?.isSynced === true &&
			xEntry.items[ 0 ].content === text &&
			xEntry.items[ 0 ].mediaIds?.length === 1
	);
	const uploads = await ( await fetch( `${ MOCK }/__media` ) ).json();
	check(
		'with Bluesky on its own version, X gets the full-size image (5 MB limit)',
		uploads.length === 2 &&
			uploads[ 1 ].name === 'hero.png' &&
			uploads[ 1 ].width === 1600,
		uploads.map( ( u ) => `${ u.name } ${ u.size_bytes }` ).join( ', ' )
	);
	check(
		'Bluesky is sent unsynced with its own text and no image',
		bskyEntry?.accountId === 'acc_bsky' &&
			bskyEntry.isSynced === false &&
			bskyEntry.items[ 0 ].content === bskyWords &&
			! bskyEntry.items[ 0 ].mediaIds,
		JSON.stringify( bskyEntry )
	);
	const ownRow = page.locator( '.orbitwrite-sent__item', {
		hasText: 'Own version',
	} );
	await ownRow.waitFor();
	const ownRowText = await ownRow.innerText();
	check(
		'sent list shows each post, the own version tagged',
		ownRowText.includes( bskyWords ) &&
			! ownRowText.includes( 'Acme on X' ) &&
			( await page.locator( '.orbitwrite-sent__item' ).count() ) === 3,
		ownRowText.replace( /\n/g, ' | ' )
	);
	await page.screenshot( { path: `${ OUT }04c-sent-versions.png` } );
	check(
		'sending starts a fresh draft from the article',
		( await page
			.getByLabel( 'Main post', { exact: true } )
			.inputValue() ) === text &&
			( await bskyRow.getByLabel( 'Text for Bluesky' ).count() ) === 0
	);

	const stored = await page.evaluate( () =>
		Object.keys( window.localStorage )
	);
	check(
		'a sent draft is removed from the browser; channel picks are kept',
		! stored.some( ( key ) => key.startsWith( 'orbitwrite:draft:' ) ) &&
			stored.some( ( key ) => key.startsWith( 'orbitwrite:prefs:' ) ),
		stored.filter( ( key ) => key.startsWith( 'orbitwrite:' ) ).join( ', ' )
	);

	// 4d. Instagram needs an image: an own version without one is blocked.
	const igRow = page.locator( '.orbitwrite-channel-row', {
		hasText: 'Instagram',
	} );
	await igRow.getByRole( 'checkbox', { name: /Acme Studio/ } ).check();
	await igRow
		.getByRole( 'checkbox', { name: 'Same as main post' } )
		.uncheck();
	await igRow.getByRole( 'button', { name: 'Remove' } ).click();
	check(
		'a channel that needs an image says so and blocks sending',
		( await igRow.innerText() ).includes( 'Needs an image.' ) &&
			( await send.isDisabled() )
	);
	await page.screenshot( { path: `${ OUT }04d-needs-image.png` } );
	await igRow.getByRole( 'checkbox', { name: 'Same as main post' } ).check();
	check(
		'back on the main post (which has an image) it can send',
		! ( await igRow.innerText() ).includes( 'Needs an image.' ) &&
			! ( await send.isDisabled() )
	);
	await igRow.getByRole( 'checkbox', { name: /Acme Studio/ } ).uncheck();

	// 5. Publish now, then watch it publish (the mock flips it after 2s).
	await page.getByRole( 'radio', { name: 'Now', exact: true } ).check();
	await send.click();
	await page
		.locator( '.components-snackbar' )
		.getByText( 'Sent to Orbitwrite. Publishing now.' )
		.waitFor();
	await page
		.locator( '.orbitwrite-sent__item', { hasText: 'Published' } )
		.waitFor( { timeout: 15000 } );
	const published = await page
		.locator( '.orbitwrite-sent__item', { hasText: 'Published' } )
		.innerText();
	check(
		'publish now polls to Published with links',
		published.includes( 'acme.bsky.social' ),
		published.replace( /\n/g, ' | ' )
	);
	log = await mockLog();
	const second = log
		.filter(
			( entry ) => entry.method === 'POST' && entry.path === '/posts'
		)
		.at( -1 );
	check(
		'publish now sends publishNow: true',
		second?.body?.publishNow === true
	);
	check(
		'publishing to X and Bluesky again reused the Bluesky-sized upload',
		log.filter( ( entry ) => entry.path === '/media/create-upload-url' )
			.length === 2 &&
			second.body.accounts[ 0 ].items[ 0 ].mediaIds?.[ 0 ] === 'med_1'
	);
	const numbers = page
		.locator( '.orbitwrite-sent__item', { hasText: 'Published' } )
		.locator( '.orbitwrite-sent__numbers' );
	await numbers.waitFor();
	const numbersText = await numbers.innerText();
	check(
		'a published post shows its numbers, leaving out what nothing reported',
		// X: 1,180 impressions and 31 reactions; Bluesky: no impressions, 9.
		numbersText.startsWith(
			'1,180 impressions · 40 reactions · 6 comments · 9 reposts · 17 link clicks'
		),
		numbersText
	);
	await page.screenshot( { path: `${ OUT }05-published.png` } );
	check(
		'"Now" is not remembered: the next post is scheduled again',
		( await page
			.getByRole( 'radio', { name: 'Next slot' } )
			.isChecked() ) && ! /Publish now/.test( await send.innerText() )
	);

	// 6. Delete the first scheduled one (the oldest, listed last).
	const before = await page.locator( '.orbitwrite-sent__item' ).count();
	page.once( 'dialog', ( dialog ) => dialog.accept() );
	await page
		.locator( '.orbitwrite-sent__item', { hasText: 'Scheduled' } )
		.last()
		.getByRole( 'button', { name: 'More actions' } )
		.click();
	await page.getByRole( 'menuitem', { name: 'Delete' } ).click();
	await page.waitForFunction(
		( count ) =>
			document.querySelectorAll( '.orbitwrite-sent__item' ).length ===
			count - 1,
		before
	);
	log = await mockLog();
	check(
		'delete calls /posts/discard',
		log.some(
			( entry ) =>
				entry.path === '/posts/discard' &&
				entry.body?.groupId === 'grp_1'
		)
	);

	// 6b. The classic editor (the Classic Editor plugin) gets a box with the
	// same composer, reading the article from the form.
	page.on( 'dialog', ( dialog ) =>
		dialog.type() === 'beforeunload' ? dialog.accept() : null
	);
	await page.goto(
		`${ SITE }/wp-admin/post.php?post=${ POST_ID }&action=edit&classic-editor&classic-editor__forget`
	);
	const box = page.locator( '#orbitwrite-share' );
	await box.waitFor();
	check(
		'classic editor shows the Share on Orbitwrite box',
		( await page.locator( '.block-editor' ).count() ) === 0
	);
	await page.waitForFunction( () =>
		document
			.querySelector( '#orbitwrite-share textarea' )
			?.value.includes( 'Hello from WordPress' )
	);
	check(
		'classic box prefilled with title and link',
		( await box
			.getByLabel( 'Main post', { exact: true } )
			.inputValue() ) === text
	);
	await box.locator( '.orbitwrite-image__thumb' ).first().waitFor();
	check( 'classic box picks up the featured image', true );
	check(
		'classic box lists what was sent from the article',
		( await box.locator( '.orbitwrite-sent__item' ).count() ) >= 1
	);
	await page.fill( '#title', 'Hello from the classic editor' );
	await page.waitForFunction( () =>
		document
			.querySelector( '#orbitwrite-share textarea' )
			?.value.startsWith( 'Hello from the classic editor' )
	);
	check( 'main post follows the title as it is typed', true );

	check(
		'the classic box sits under Publish, not above it',
		await page.evaluate( () => {
			const boxes = [
				...document.querySelectorAll( '#side-sortables > .postbox' ),
			].map( ( el ) => el.id );
			return (
				boxes.indexOf( 'submitdiv' ) <
				boxes.indexOf( 'orbitwrite-share' )
			);
		} )
	);
	await box.getByRole( 'radio', { name: 'Next slot' } ).check();
	await page.waitForFunction( () =>
		/Schedule for (Mon|Tue|Wed|Thu|Fri|Sat|Sun)/.test(
			document.querySelector(
				'#orbitwrite-share .orbitwrite-composer__send'
			)?.textContent || ''
		)
	);
	await page.screenshot( { path: `${ OUT }06b-classic.png` } );
	await box.locator( '.orbitwrite-composer__send' ).click();
	await box
		.getByText( /^Scheduled for/ )
		.first()
		.waitFor();
	log = await mockLog();
	const classic = log
		.filter(
			( entry ) => entry.method === 'POST' && entry.path === '/posts'
		)
		.at( -1 );
	check(
		'classic send uses the edited title and the permalink',
		classic?.body?.accounts?.[ 0 ]?.items?.[ 0 ]?.content ===
			`Hello from the classic editor\n\n${ SITE }/hello-from-wordpress/` &&
			classic.body.accounts[ 0 ].items[ 0 ].mediaIds?.[ 0 ] === 'med_1',
		JSON.stringify( classic?.body?.accounts?.[ 0 ]?.items?.[ 0 ] )
	);

	// 7. A refused (expired) token is refreshed transparently.
	await fetch( `${ MOCK }/__expire`, { method: 'POST' } );
	await page.goto(
		`${ SITE }/wp-admin/post.php?post=${ POST_ID }&action=edit&classic-editor__forget`
	);
	await page.waitForFunction( () =>
		window.wp?.data?.select( 'core/editor' )?.getCurrentPostId()
	);
	await page.evaluate( () =>
		window.wp.data
			.dispatch( 'core/interface' )
			.enableComplementaryArea( 'core', 'orbitwrite/orbitwrite-sidebar' )
	);
	await page
		.locator( '.orbitwrite-composer' )
		.getByRole( 'checkbox', { name: /Acme on X/ } )
		.waitFor();
	log = await mockLog();
	const unauthorized = log.filter(
		( entry ) => entry.path === '/connected-accounts'
	).length;
	// Many requests needing a refresh at once must spend the refresh token
	// once between them: Orbitwrite rotates it, so a second spend is
	// `invalid_grant`, which must not read as a disconnect.
	await fetch( `${ MOCK }/__expire`, { method: 'POST' } );
	const burst = await page.evaluate( () =>
		Promise.all(
			Array.from( { length: 5 }, () =>
				window.wp
					.apiFetch( { path: '/orbitwrite/v1/channels' } )
					.then( () => 'ok' )
					.catch( ( err ) => err.code || err.message )
			)
		)
	);
	check(
		'parallel requests after expiry all succeed (one refresh between them)',
		burst.every( ( outcome ) => outcome === 'ok' ),
		burst.join( ', ' )
	);
	check(
		'channels load again after the token was refused (refresh worked)',
		unauthorized >= 2
	);

	// 8. A time in the past is refused with a sentence.
	await page.getByRole( 'radio', { name: 'Pick a time' } ).check();
	await page
		.locator( '.orbitwrite-composer__date' )
		.getByRole( 'button' )
		.click();
	const picker = page.locator( '.orbitwrite-date-popover' );
	await picker.getByLabel( 'Year' ).fill( '2020' );
	await picker.getByLabel( 'Year' ).press( 'Tab' );
	check(
		"the date picker doesn't show the site's timezone as if it were the workspace's",
		( await picker.locator( '.components-datetime__timezone' ).count() ) ===
			0 ||
			! ( await picker
				.locator( '.components-datetime__timezone' )
				.isVisible() )
	);
	await page.keyboard.press( 'Escape' );
	await page.locator( '.orbitwrite-composer__send' ).click();
	await page
		.locator( '.orbitwrite-composer' )
		.getByText( /That time has already passed in Europe\/London/ )
		.waitFor();
	check( 'past time refused with the workspace zone', true );

	// 9. The Orbitwrite page leads with the last four weeks.
	await page.goto( `${ SITE }/wp-admin/admin.php?page=orbitwrite` );
	const summary = page.locator( '.orbitwrite-summary' );
	await summary.getByText( '18,240' ).waitFor();
	const summaryText = await summary.innerText();
	check(
		'the summary shows the totals, their changes and the top post',
		summaryText.includes( '18,240' ) &&
			summaryText.includes( '\u221213%' ) &&
			summaryText.includes( '+8%' ) &&
			summaryText.includes( '11 the 4 weeks before' ) &&
			summaryText.includes( 'Our autumn roadmap' ) &&
			summaryText.includes( 'No change' ),
		summaryText.replace( /\n/g, ' | ' )
	);
	await page.screenshot( {
		path: `${ OUT }07-summary.png`,
		fullPage: true,
	} );

	// 10. Auto-share: set it up, then publish an article and let cron send it.
	await page.goto(
		`${ SITE }/wp-admin/admin.php?page=orbitwrite-auto-share`
	);
	const settings = page.locator( '.orbitwrite-auto-share' );
	const autoToggle = settings.getByRole( 'checkbox', {
		name: 'Share my articles when they’re published',
	} );
	await autoToggle.waitFor();
	check(
		'the rest of the form waits until auto-share is on',
		( await settings
			.getByRole( 'checkbox', { name: /Acme on X/ } )
			.count() ) === 0
	);
	await autoToggle.check();
	await settings.getByRole( 'checkbox', { name: /Acme on X/ } ).check();
	const template = settings.getByLabel( 'Text', { exact: true } );
	await template.fill( '{title} {link}' );
	await settings.getByText( /isn't a tag, so it would be posted/ ).waitFor();
	await settings.getByRole( 'button', { name: 'Save' } ).click();
	await settings.getByText( /The text uses \{link\}/ ).waitFor();
	check(
		'an unknown template tag is flagged as typed, and refused on save',
		true
	);
	// A tag button inserts at the cursor.
	await template.fill( '{title}\n\n{url} ' );
	await template.press( 'End' );
	await settings.getByRole( 'button', { name: '{hashtags}' } ).click();
	check(
		'a tag button inserts the tag where the cursor is',
		( await template.inputValue() ) === '{title}\n\n{url} {hashtags}',
		await template.inputValue()
	);
	const preview = await settings
		.locator( '.orbitwrite-auto-share__preview' )
		.innerText();
	check(
		"the preview fills the text in from the person's latest article",
		preview.includes( `Hello world!\n\n${ SITE }/hello-world/` ),
		preview.replace( /\n/g, ' | ' )
	);
	await settings.getByRole( 'button', { name: 'Save' } ).click();
	await settings
		.getByText( 'Saved. Your articles are shared when they’re published.' )
		.waitFor();
	check( 'auto-share settings save', true );
	await page.screenshot( {
		path: `${ OUT }08-auto-share-settings.png`,
		fullPage: true,
	} );

	const draft = await page.evaluate( async () => {
		const tag = await window.wp.apiFetch( {
			path: '/wp/v2/tags',
			method: 'POST',
			data: { name: 'Social media' },
		} );
		return window.wp.apiFetch( {
			path: '/wp/v2/posts',
			method: 'POST',
			data: {
				title: 'Auto shared article',
				status: 'draft',
				tags: [ tag.id ],
			},
		} );
	} );
	await page.goto(
		`${ SITE }/wp-admin/post.php?post=${ draft.id }&action=edit&classic-editor__forget`
	);
	await page.waitForFunction( () =>
		window.wp?.data?.select( 'core/editor' )?.getCurrentPostId()
	);
	// The Post tab carries it too, without opening the Orbitwrite sidebar.
	await page.evaluate( () =>
		window.wp.data
			.dispatch( 'core/interface' )
			.enableComplementaryArea( 'core', 'edit-post/document' )
	);
	// Collapsed at first, like core's own panels there.
	await page
		.locator( '.components-panel__body-toggle', { hasText: 'Orbitwrite' } )
		.click();
	const docPanel = page.locator( '.orbitwrite-panel' );
	const autoBox = docPanel.getByRole( 'checkbox', {
		name: 'Share automatically when this is published',
	} );
	await autoBox.waitFor();
	check(
		'the Post tab offers auto-share on an unpublished article, ticked',
		await autoBox.isChecked()
	);
	await page.screenshot( { path: `${ OUT }09-post-tab.png` } );

	// Publish the way a person does, through the pre-publish checks.
	const createsBefore = ( await creates() ).length;
	await page
		.locator(
			'.editor-post-publish-panel__toggle, .editor-post-publish-button__button'
		)
		.first()
		.click();
	const publishPanel = page.locator( '.editor-post-publish-panel' );
	await publishPanel
		.getByRole( 'checkbox', {
			name: 'Share automatically when this is published',
		} )
		.waitFor();
	check( 'the pre-publish checks include auto-share', true );
	await page.waitForTimeout( 400 ); // the panel slides in
	await page.screenshot( { path: `${ OUT }09b-pre-publish.png` } );
	await publishPanel
		.locator( '.editor-post-publish-panel__header-publish-button button' )
		.click();
	// WordPress may run its own cron straight after the save, in which case
	// the post is already there by the time the panel looks.
	await publishPanel
		.getByText( 'Auto-share is sending this article to Orbitwrite.' )
		.or( publishPanel.locator( '.orbitwrite-share-summary li' ) )
		.first()
		.waitFor( { timeout: 15000 } );
	check( 'the post-publish panel follows the article into auto-share', true );
	runCron();
	await publishPanel
		.locator( '.orbitwrite-share-summary li' )
		.first()
		.waitFor( { timeout: 15000 } );
	check( 'the post-publish panel lists the auto-shared post', true );
	await page.screenshot( { path: `${ OUT }10-post-publish.png` } );
	await page.evaluate( () =>
		window.wp.data
			.dispatch( 'core/interface' )
			.enableComplementaryArea( 'core', 'orbitwrite/orbitwrite-sidebar' )
	);
	await page
		.locator( '.orbitwrite-composer .orbitwrite-sent__item' )
		.first()
		.waitFor( { timeout: 15000 } );
	check( 'the auto-shared post appears in the sidebar', true );
	const auto = ( await creates() ).slice( createsBefore );
	check(
		'auto-share sends the template, filled in, to the picked channels',
		auto.length === 1 &&
			auto[ 0 ].body.accounts.length === 1 &&
			auto[ 0 ].body.accounts[ 0 ].accountId === 'acc_x' &&
			auto[ 0 ].body.accounts[ 0 ].items[ 0 ].content ===
				`Auto shared article\n\n${ SITE }/auto-shared-article/ #SocialMedia` &&
			! auto[ 0 ].body.publishNow,
		JSON.stringify( auto.map( ( entry ) => entry.body ) ).slice( 0, 400 )
	);
	await page.screenshot( { path: `${ OUT }10b-auto-shared.png` } );

	// Unpublished and published again: still only the one share.
	await page.evaluate( async ( id ) => {
		await window.wp.apiFetch( {
			path: `/wp/v2/posts/${ id }`,
			method: 'POST',
			data: { status: 'draft' },
		} );
		await window.wp.apiFetch( {
			path: `/wp/v2/posts/${ id }`,
			method: 'POST',
			data: { status: 'publish' },
		} );
	}, draft.id );
	runCron();
	check(
		'publishing an article again does not share it again',
		( await creates() ).length === createsBefore + 1
	);

	// An article opted out is not shared.
	const optedOut = await page.evaluate( async () => {
		const post = await window.wp.apiFetch( {
			path: '/wp/v2/posts',
			method: 'POST',
			data: { title: 'Not this one', status: 'draft' },
		} );
		await window.wp.apiFetch( {
			path: '/orbitwrite/v1/auto-share/article',
			method: 'POST',
			data: { postId: post.id, enabled: false },
		} );
		await window.wp.apiFetch( {
			path: `/wp/v2/posts/${ post.id }`,
			method: 'POST',
			data: { status: 'publish' },
		} );
		return post.id;
	} );
	runCron();
	const optedOutShares = await page.evaluate(
		( id ) =>
			window.wp.apiFetch( {
				path: `/orbitwrite/v1/shares?postId=${ id }`,
			} ),
		optedOut
	);
	check(
		'an article opted out of auto-share is not shared',
		( await creates() ).length === createsBefore + 1 &&
			optedOutShares.shares.length === 0 &&
			optedOutShares.autoShare.state === null
	);

	// 11. The dashboard widget, and the Posts list's column and row action.
	await page.goto( `${ SITE }/wp-admin/` );
	const widget = page.locator( '#orbitwrite_summary' );
	await widget.getByText( '18,240' ).waitFor();
	check( 'the dashboard widget shows the last four weeks', true );
	await page.screenshot( { path: `${ OUT }11-dashboard.png` } );

	await page.goto( `${ SITE }/wp-admin/edit.php` );
	const helloRow = page.locator( `#post-${ POST_ID }` );
	const social = await helloRow.locator( '.column-orbitwrite' ).innerText();
	check(
		'the Social column counts what was sent, with stored numbers',
		/published/.test( social ) &&
			/scheduled/.test( social ) &&
			social.includes( '1,180 impressions' ),
		social.replace( /\n/g, ' | ' )
	);
	await page.screenshot( { path: `${ OUT }12-posts-list.png` } );
	const autoRow = page.locator( `#post-${ draft.id }` );
	await autoRow.hover();
	await autoRow
		.getByRole( 'link', {
			name: /Share “Auto shared article” on Orbitwrite/,
		} )
		.click();
	await page
		.locator( '.interface-complementary-area .orbitwrite-composer' )
		.waitFor();
	check(
		'"Share on Orbitwrite" in the list opens the editor with the sidebar',
		true
	);

	// Several posts' numbers are one read.
	await fetch( `${ MOCK }/__publish-all`, { method: 'POST' } );
	const numbersReads = async () =>
		( await mockLog() ).filter(
			( entry ) =>
				entry.path === '/analytics/posts' &&
				/[?&]groupIds=/.test( entry.query || '' )
		);
	const readsBefore = ( await numbersReads() ).length;
	const many = await page.evaluate(
		( id ) =>
			window.wp
				.apiFetch( {
					path: `/orbitwrite/v1/shares?postId=${ id }`,
				} )
				.then( () =>
					window.wp.apiFetch( {
						path: `/orbitwrite/v1/share-numbers?postId=${ id }`,
					} )
				),
		POST_ID
	);
	const reads = ( await numbersReads() ).slice( readsBefore );
	const named = reads.reduce(
		( total, entry ) =>
			total +
			new URLSearchParams( entry.query ).getAll( 'groupIds' ).length,
		0
	);
	check(
		'numbers for several posts come back in one read',
		Object.keys( many.numbers ).length >= 3 &&
			reads.length === 1 &&
			named >= 2,
		`${ Object.keys( many.numbers ).length } posts, ${
			reads.length
		} reads naming ${ named }`
	);

	// 12. Disconnect (on the Orbitwrite page; editors don't offer it) revokes
	// and shows Connect again.
	await page.goto( `${ SITE }/wp-admin/admin.php?page=orbitwrite` );
	await page.getByRole( 'button', { name: 'Disconnect' } ).click();
	await page.getByRole( 'link', { name: 'Connect Orbitwrite' } ).waitFor();
	log = await mockLog();
	check(
		'disconnect revokes the refresh token',
		log.some(
			( entry ) =>
				entry.path === '/oauth2/revoke' &&
				entry.body?.token_type_hint === 'refresh_token'
		)
	);
	await page.screenshot( { path: `${ OUT }06-disconnected.png` } );

	const violations = await ( await fetch( `${ MOCK }/__contract` ) ).json();
	check(
		'every request and answer matched the OpenAPI contract',
		violations.length === 0,
		JSON.stringify( violations ).slice( 0, 400 )
	);
} catch ( err ) {
	check( 'run completed', false, err.message.split( '\n' )[ 0 ] );
	await page
		.screenshot( { path: `${ OUT }error.png`, fullPage: true } )
		.catch( () => {} );
} finally {
	const relevant = consoleErrors.filter(
		( line ) =>
			! /favicon|Download the React DevTools|status of 400/.test( line )
	); // the past-time check is a deliberate 400
	check(
		'no browser console errors',
		relevant.length === 0,
		relevant.slice( 0, 5 ).join( ' || ' )
	);
	await browser.close();
	const failed = results.filter( ( r ) => ! r.ok ).length;
	console.log( `\n${ results.length - failed }/${ results.length } passed` );
	process.exit( failed ? 1 : 0 );
}
