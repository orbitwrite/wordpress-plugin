/**
 * The plugin and its test double, checked against openapi/orbitwrite.json.
 *
 *   npm run test:contract
 *
 * 1. Every request the PHP builds (tests/contract/requests.php) is one the
 *    API accepts.
 * 2. Every answer the mock Orbitwrite gives (tests/e2e/fixtures.mjs) is one
 *    the API could give, so the end-to-end run tests against something real.
 *
 * Needs `php` on the PATH.
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { test } from 'node:test';

import {
	ACCOUNTS,
	ME,
	OVERVIEW,
	PLATFORMS,
	TOP_POSTS,
	topPostFor,
} from '../e2e/fixtures.mjs';
import { requestProblems, responseProblems } from './openapi.mjs';

const requests = JSON.parse(
	execFileSync(
		'php',
		[ new URL( './requests.php', import.meta.url ).pathname ],
		{
			encoding: 'utf8',
		}
	)
);

for ( const request of requests ) {
	test( `request: ${ request.name }`, () => {
		assert.deepEqual(
			requestProblems(
				request.method,
				request.path,
				new URLSearchParams( request.query || '' ),
				request.body
			),
			[]
		);
	} );
}

test( 'the instants sent end in Z (the API refuses offsets)', () => {
	for ( const request of requests.filter( ( r ) => r.body?.scheduledAt ) ) {
		assert.match( request.body.scheduledAt, /Z$/ );
	}
} );

test( 'a bad request is caught, so the checks above mean something', () => {
	assert.notDeepEqual(
		requestProblems( 'POST', '/api/v1/posts', new URLSearchParams(), {
			scheduledAt: '2026-10-15T08:00:00Z',
			accounts: [
				{ accountId: 'acc_x', items: [ { content: 'no id' } ] },
			],
		} ),
		[]
	);
	assert.notDeepEqual(
		requestProblems(
			'GET',
			'/api/v1/posts',
			new URLSearchParams( 'groupIds=grp_1' ),
			undefined
		),
		[]
	);
	assert.notDeepEqual(
		requestProblems(
			'GET',
			'/api/v1/analytics/overview',
			new URLSearchParams( 'window=28' ),
			undefined
		),
		[]
	);
	// `/posts` names posts with `groupId`; analytics with `groupIds`.
	assert.notDeepEqual(
		requestProblems(
			'GET',
			'/api/v1/analytics/posts',
			new URLSearchParams( 'groupId=grp_1' ),
			undefined
		),
		[]
	);
} );

const responses = [
	[ 'GET', '/api/v1/me', ME ],
	[
		'GET',
		'/api/v1/connected-accounts',
		{ accounts: ACCOUNTS, primaryAccountId: 'acc_x' },
	],
	[ 'GET', '/api/v1/platforms', { platforms: PLATFORMS } ],
	[ 'GET', '/api/v1/analytics/overview', OVERVIEW ],
	[ 'GET', '/api/v1/analytics/posts', TOP_POSTS ],
	[
		'GET',
		'/api/v1/analytics/posts',
		{
			...TOP_POSTS,
			entries: [
				topPostFor(
					'grp_1',
					[ 'acc_x', 'acc_bsky', 'acc_li' ],
					'Sent'
				),
			],
		},
		'named posts',
	],
];
for ( const [ method, path, body, label ] of responses ) {
	test( `mock answer: ${ method } ${ path }${
		label ? ` (${ label })` : ''
	}`, () => {
		assert.deepEqual( responseProblems( method, path, 200, body ), [] );
	} );
}
