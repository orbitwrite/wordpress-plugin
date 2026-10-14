#!/usr/bin/env node
/**
 * A stand-in for Orbitwrite, for running the plugin end to end without an
 * account or a public site. No dependencies; Node 18+.
 *
 *   node tests/e2e/mock-orbitwrite.mjs [port]      (default 4010)
 *
 * Point a test site at it with
 *
 *   define( 'ORBITWRITE_BASE_URL', 'http://127.0.0.1:4010' );
 *
 * and let it connect from http://localhost with
 *
 *   add_filter( 'orbitwrite_connect_problems', '__return_empty_array' );
 *
 * It is strict where the real server is strict, so a test passing here means
 * something: it fetches the site's client metadata document (CIMD) and checks
 * `client_id` equals its URL and the redirect URI is listed, checks PKCE,
 * `state`/`resource`, rotates refresh tokens (a spent one is `invalid_grant`),
 * refuses a bearer it didn't mint, refuses instants with an offset, checks a
 * PUT's Content-Type and length against what was declared, and refuses media
 * ids it doesn't know.
 *
 * Every `/api/v1` request it receives and every answer it gives is also
 * checked against openapi/orbitwrite.json, the vendored slice of the real
 * API. A mismatch is answered with a 400 naming it and listed at
 * `GET /__contract`, which the end-to-end run asserts is empty: the plugin
 * can't pass against a mock that has drifted from Orbitwrite, or send
 * something Orbitwrite wouldn't take.
 *
 * `GET /__log` returns every API request it saw; `POST /__expire` makes the
 * current access tokens look expired to the API (401), to exercise refresh;
 * `POST /__publish-all` marks every post published.
 */
import { createHash, randomBytes } from 'node:crypto';
import { createServer } from 'node:http';

import { requestProblems, responseProblems } from '../contract/openapi.mjs';
import {
	ACCOUNTS,
	ME,
	OVERVIEW,
	PLATFORMS,
	TOP_POSTS,
	topPostFor,
} from './fixtures.mjs';

const PORT = Number( process.argv[ 2 ] || process.env.PORT || 4010 );
const ORIGIN = `http://127.0.0.1:${ PORT }`;
const ISSUER = `${ ORIGIN }/api/auth`;
const RESOURCE = `${ ORIGIN }/api/v1`;
const TIMEZONE = 'Europe/London';

const codes = new Map(); // code → { challenge, clientId, redirectUri, resource }
const accessTokens = new Set();
const refreshTokens = new Map(); // refresh → clientId
const media = new Map(); // id → { mime, size, uploaded, request }
const posts = new Map(); // groupId → post
let groupCounter = 0;
const log = [];
const violations = [];

const ISO_Z = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

function json( res, status, body, headers = {} ) {
	res.writeHead( status, { 'Content-Type': 'application/json', ...headers } );
	res.end( JSON.stringify( body ) );
}

function oauthError( res, status, error, description ) {
	json( res, status, { error, error_description: description } );
}

function readBody( req ) {
	return new Promise( ( resolve ) => {
		const chunks = [];
		req.on( 'data', ( chunk ) => chunks.push( chunk ) );
		req.on( 'end', () => resolve( Buffer.concat( chunks ) ) );
	} );
}

const token = () => randomBytes( 24 ).toString( 'base64url' );
const s256 = ( verifier ) =>
	createHash( 'sha256' ).update( verifier ).digest( 'base64url' );

function nextSlot( offsetHours ) {
	const at = new Date( Date.now() + offsetHours * 3600_000 );
	at.setUTCMinutes( 0, 0, 0 );
	return at.toISOString();
}

async function authorize( url, res ) {
	const p = url.searchParams;
	const required = [
		'response_type',
		'client_id',
		'redirect_uri',
		'state',
		'code_challenge',
		'code_challenge_method',
		'resource',
		'scope',
	];
	for ( const name of required ) {
		if ( ! p.get( name ) ) {
			return json( res, 400, { error: `missing ${ name }` } );
		}
	}
	if ( p.get( 'code_challenge_method' ) !== 'S256' ) {
		return json( res, 400, { error: 'PKCE S256 required' } );
	}
	if ( p.get( 'resource' ) !== RESOURCE ) {
		return json( res, 400, {
			error: `unknown resource ${ p.get( 'resource' ) }`,
		} );
	}
	if ( ! p.get( 'scope' ).split( ' ' ).includes( 'offline_access' ) ) {
		return json( res, 400, { error: 'expected offline_access' } );
	}

	// CIMD: the client id is a URL; fetch it and check it describes itself.
	const clientId = p.get( 'client_id' );
	let document;
	try {
		const answer = await fetch( clientId, {
			headers: { Accept: 'application/json' },
		} );
		document = await answer.json();
	} catch ( err ) {
		return json( res, 400, {
			error: `couldn't fetch client metadata: ${ err.message }`,
		} );
	}
	if ( document.client_id !== clientId ) {
		return json( res, 400, {
			error: 'client_id in the document does not match its URL',
		} );
	}
	if (
		! ( document.redirect_uris || [] ).includes( p.get( 'redirect_uri' ) )
	) {
		return json( res, 400, { error: 'redirect_uri not registered' } );
	}
	if ( document.token_endpoint_auth_method !== 'none' ) {
		return json( res, 400, { error: 'expected a public client' } );
	}

	// Consent is assumed; deny with ?deny=1 on the authorize URL.
	const back = new URL( p.get( 'redirect_uri' ) );
	back.searchParams.set( 'state', p.get( 'state' ) );
	back.searchParams.set( 'iss', ISSUER );
	if ( p.get( 'deny' ) ) {
		back.searchParams.set( 'error', 'access_denied' );
	} else {
		const code = token();
		codes.set( code, {
			challenge: p.get( 'code_challenge' ),
			clientId,
			redirectUri: p.get( 'redirect_uri' ),
			resource: p.get( 'resource' ),
		} );
		back.searchParams.set( 'code', code );
	}
	res.writeHead( 302, { Location: back.toString() } );
	res.end();
}

function issue( clientId ) {
	const access = token();
	const refresh = token();
	accessTokens.add( access );
	refreshTokens.set( refresh, clientId );
	return {
		access_token: access,
		token_type: 'Bearer',
		expires_in: 3600,
		refresh_token: refresh,
		scope: 'orbitwrite:read orbitwrite:write offline_access',
	};
}

async function tokenEndpoint( req, res ) {
	const form = new URLSearchParams( ( await readBody( req ) ).toString() );
	if ( form.get( 'resource' ) !== RESOURCE ) {
		return oauthError( res, 400, 'invalid_target', 'wrong resource' );
	}
	if ( form.get( 'grant_type' ) === 'authorization_code' ) {
		const pending = codes.get( form.get( 'code' ) );
		codes.delete( form.get( 'code' ) );
		if (
			! pending ||
			pending.clientId !== form.get( 'client_id' ) ||
			pending.redirectUri !== form.get( 'redirect_uri' ) ||
			pending.challenge !== s256( form.get( 'code_verifier' ) || '' )
		) {
			return oauthError(
				res,
				400,
				'invalid_grant',
				'bad code, client, redirect or verifier'
			);
		}
		return json( res, 200, issue( pending.clientId ) );
	}
	if ( form.get( 'grant_type' ) === 'refresh_token' ) {
		const clientId = refreshTokens.get( form.get( 'refresh_token' ) );
		refreshTokens.delete( form.get( 'refresh_token' ) ); // rotation: spend once
		if ( ! clientId || clientId !== form.get( 'client_id' ) ) {
			return oauthError(
				res,
				400,
				'invalid_grant',
				'refresh token spent or unknown'
			);
		}
		return json( res, 200, issue( clientId ) );
	}
	return oauthError(
		res,
		400,
		'unsupported_grant_type',
		form.get( 'grant_type' )
	);
}

function entryFor( groupId ) {
	const post = posts.get( groupId );
	const published = post.status === 'published';
	const now = new Date().toISOString();
	return {
		id: groupId,
		postId: `${ groupId }_row`,
		title: post.title,
		text: post.text,
		status: post.status,
		approvalStatus: 'not_required',
		approvalGateStatus: 'not_required',
		bucket: published ? 'posted' : 'scheduled',
		scheduledAt: post.scheduledAt,
		publishedAt: published ? now : null,
		createdAt: post.createdAt,
		updatedAt: now,
		boardPosition: null,
		hasThread: false,
		previewAccountId: post.accountIds[ 0 ],
		mediaCount: post.mediaCount,
		media: [],
		poll: null,
		quoteUrl: null,
		platformUrl: null,
		author: null,
		lastError: null,
		issues: [],
		campaign: null,
		tags: [],
		accounts: post.accountIds.map( ( id ) => {
			const account = ACCOUNTS.find( ( item ) => item.id === id );
			return {
				id,
				platform: account.platform,
				handle: account.handle,
				displayName: account.displayName,
				avatarUrl: null,
				platformUrl: published
					? `https://social.example/${ account.platform }/${ groupId }`
					: null,
				status: post.status,
				lastError: null,
				isEmpty: false,
				charCount: post.text.length,
				charLimit: 300,
			};
		} ),
		score: null,
		scoreGrade: null,
	};
}

async function api( req, res, url ) {
	const path = url.pathname;
	const body = [ 'POST', 'PUT', 'PATCH' ].includes( req.method )
		? await readBody( req )
		: null;
	let parsed;
	if ( body && body.length ) {
		try {
			parsed = JSON.parse( body.toString() );
		} catch {
			return json( res, 400, { error: 'body is not JSON' } );
		}
	}
	log.push( {
		method: req.method,
		path: path.replace( /^\/api\/v1/, '' ),
		query: url.search,
		userAgent: req.headers[ 'user-agent' ],
		body: parsed ?? null,
	} );

	// Every answer goes through the spec too.
	const reply = ( status, payload ) => {
		const problems = responseProblems( req.method, path, status, payload );
		if ( problems.length ) {
			violations.push( {
				side: 'response',
				method: req.method,
				path,
				problems,
			} );
		}
		return json( res, status, payload );
	};

	const auth = req.headers.authorization || '';
	if (
		! accessTokens.has(
			auth.startsWith( 'Bearer ' ) ? auth.slice( 7 ) : ''
		)
	) {
		return reply( 401, { error: 'Unauthorized' } );
	}

	const problems = requestProblems(
		req.method,
		path,
		url.searchParams,
		parsed
	);
	if ( problems.length ) {
		violations.push( {
			side: 'request',
			method: req.method,
			path,
			problems,
		} );
		return reply( 400, { error: `Contract: ${ problems.join( '; ' ) }` } );
	}

	const route = `${ req.method } ${ path }`;
	if ( route === 'GET /api/v1/me' ) {
		return reply( 200, ME );
	}
	if ( route === 'GET /api/v1/connected-accounts' ) {
		return reply( 200, { accounts: ACCOUNTS, primaryAccountId: 'acc_x' } );
	}
	if ( route === 'GET /api/v1/platforms' ) {
		return reply( 200, { platforms: PLATFORMS } );
	}
	if ( route === 'GET /api/v1/scheduling/suggestions' ) {
		const ids = url.searchParams.getAll( 'accountIds' );
		const chosen = ids.length
			? ids
			: ACCOUNTS.map( ( account ) => account.id );
		return reply( 200, {
			suggestions: chosen.map( ( id, index ) => ( {
				accountId: id,
				platform:
					ACCOUNTS.find( ( account ) => account.id === id )
						?.platform || 'unknown',
				timezone: TIMEZONE,
				times: [ { at: nextSlot( 20 + index ), source: 'slot' } ],
				reason: null,
				researched: false,
			} ) ),
		} );
	}
	if ( route === 'POST /api/v1/media/create-upload-url' ) {
		const id = `med_${ media.size + 1 }`;
		const now = new Date().toISOString();
		media.set( id, {
			mime: parsed.mime_type,
			size: parsed.size_bytes,
			uploaded: false,
			request: parsed,
		} );
		return reply( 200, {
			media_id: id,
			upload_url: `${ ORIGIN }/__upload/${ id }`,
			name: parsed.name,
			expires_at: new Date( Date.now() + 900_000 ).toISOString(),
			media: {
				id,
				name: parsed.name,
				mime_type: parsed.mime_type,
				size_bytes: parsed.size_bytes,
				rendition_bytes: null,
				status: 'pending',
				type: 'image',
				url: `${ ORIGIN }/__media/${ id }`,
				alt_text: parsed.alt_text ?? null,
				title: null,
				width: parsed.width ?? null,
				height: parsed.height ?? null,
				duration_sec: null,
				page_count: null,
				created_at: now,
				uploaded_at: null,
			},
		} );
	}
	if ( route === 'POST /api/v1/posts' ) {
		const problem = checkCreate( parsed );
		if ( problem ) {
			return reply( 400, { error: problem } );
		}
		// As Orbitwrite does it: synced channels share one post (composer
		// group), each unsynced channel is a post of its own, and `groupIds`
		// lists them in the order the channels were sent.
		let syncedGroup = null;
		const groupIds = [];
		for ( const account of parsed.accounts ) {
			let groupId = account.isSynced ? syncedGroup : null;
			if ( ! groupId ) {
				groupId = `grp_${ ++groupCounter }`;
				groupIds.push( groupId );
				posts.set( groupId, {
					status: parsed.publishNow ? 'publishing' : 'scheduled',
					scheduledAt: parsed.scheduledAt,
					title: parsed.info?.title ?? null,
					text: account.items[ 0 ].content,
					mediaCount: ( account.items[ 0 ].mediaIds || [] ).length,
					createdAt: new Date().toISOString(),
					accountIds: [],
				} );
				if ( account.isSynced ) {
					syncedGroup = groupId;
				}
			}
			posts.get( groupId ).accountIds.push( account.accountId );
		}
		if ( parsed.publishNow ) {
			setTimeout( () => {
				for ( const groupId of groupIds ) {
					if ( posts.has( groupId ) ) {
						posts.get( groupId ).status = 'published';
					}
				}
			}, 2000 );
			return reply( 200, {
				ok: true,
				publishing: true,
				count: parsed.accounts.length,
				groupIds,
			} );
		}
		return reply( 200, {
			ok: true,
			count: parsed.accounts.length,
			scheduledAt: parsed.scheduledAt,
			groupIds,
		} );
	}
	if ( route === 'GET /api/v1/posts' ) {
		const ids = url.searchParams.getAll( 'groupId' );
		return reply( 200, {
			entries: ids.filter( ( id ) => posts.has( id ) ).map( entryFor ),
			nextCursor: null,
		} );
	}
	if ( route === 'POST /api/v1/posts/discard' ) {
		const post = posts.get( parsed.groupId );
		if ( ! post ) {
			return reply( 404, { error: 'Post not found' } );
		}
		if ( post.status === 'published' ) {
			return reply( 409, {
				error: 'This post has already been published',
			} );
		}
		posts.delete( parsed.groupId );
		return reply( 200, {
			ok: true,
			groupId: parsed.groupId,
			count: post.accountIds.length,
		} );
	}
	if ( route === 'GET /api/v1/analytics/overview' ) {
		return reply( 200, OVERVIEW );
	}
	if ( route === 'GET /api/v1/analytics/posts' ) {
		const named = url.searchParams.getAll( 'groupIds' );
		if ( ! named.length ) {
			return reply( 200, TOP_POSTS );
		}
		// Named posts: only this workspace's, only once they're out (numbers
		// exist only then), and one with nothing reported is left out, as
		// Orbitwrite leaves out a post that has no reading of the ranked metric.
		const entries = [ ...new Set( named ) ]
			.filter( ( id ) => posts.get( id )?.status === 'published' )
			.map( ( id ) =>
				topPostFor(
					id,
					posts.get( id ).accountIds,
					posts.get( id ).text
				)
			)
			.filter( ( entry ) => entry.metrics.engagements !== null )
			.sort( ( a, b ) => b.value - a.value );
		return reply( 200, { ...TOP_POSTS, entries, nextCursor: null } );
	}
	return json( res, 404, { error: `No mock for ${ route }` } );
}

/**
 * What the spec can't say: the semantic checks the real server makes on a
 * create. Shape is the spec's job, above.
 *
 * @param {Object} body The create request.
 * @return {string|null} The refusal, or null.
 */
function checkCreate( body ) {
	if ( ! ISO_Z.test( body.scheduledAt ) ) {
		return 'scheduledAt must be an ISO instant ending in Z';
	}
	for ( const account of body.accounts ) {
		const known = ACCOUNTS.find(
			( item ) => item.id === account.accountId
		);
		if ( ! known || known.disconnected ) {
			return `Account ${ account.accountId } not found`;
		}
		for ( const item of account.items ) {
			for ( const id of item.mediaIds || [] ) {
				if ( ! media.get( id )?.uploaded ) {
					return `Unknown media ${ id }`;
				}
			}
		}
	}
	return null;
}

const server = createServer( async ( req, res ) => {
	const url = new URL( req.url, ORIGIN );
	try {
		if (
			url.pathname === '/.well-known/oauth-authorization-server/api/auth'
		) {
			return json( res, 200, {
				issuer: ISSUER,
				authorization_endpoint: `${ ISSUER }/oauth2/authorize`,
				token_endpoint: `${ ISSUER }/oauth2/token`,
				revocation_endpoint: `${ ISSUER }/oauth2/revoke`,
				code_challenge_methods_supported: [ 'S256' ],
			} );
		}
		if ( url.pathname === '/api/auth/oauth2/authorize' ) {
			return authorize( url, res );
		}
		if (
			url.pathname === '/api/auth/oauth2/token' &&
			req.method === 'POST'
		) {
			return tokenEndpoint( req, res );
		}
		if (
			url.pathname === '/api/auth/oauth2/revoke' &&
			req.method === 'POST'
		) {
			const form = new URLSearchParams(
				( await readBody( req ) ).toString()
			);
			refreshTokens.delete( form.get( 'token' ) );
			accessTokens.delete( form.get( 'token' ) );
			log.push( {
				method: 'POST',
				path: '/oauth2/revoke',
				body: Object.fromEntries( form ),
			} );
			return json( res, 200, {} );
		}
		if ( url.pathname.startsWith( '/__upload/' ) && req.method === 'PUT' ) {
			const id = url.pathname.split( '/' ).pop();
			const record = media.get( id );
			const bytes = await readBody( req );
			if (
				! record ||
				req.headers[ 'content-type' ] !== record.mime ||
				bytes.length !== record.size
			) {
				return json( res, 403, { error: 'signature mismatch' } );
			}
			record.uploaded = true;
			return json( res, 200, {} );
		}
		if ( url.pathname === '/__log' ) {
			return json( res, 200, log );
		}
		if ( url.pathname === '/__contract' ) {
			return json( res, 200, violations );
		}
		if ( url.pathname === '/__media' ) {
			return json(
				res,
				200,
				[ ...media.values() ].map( ( item ) => item.request )
			);
		}
		if ( url.pathname === '/__publish-all' && req.method === 'POST' ) {
			for ( const post of posts.values() ) {
				post.status = 'published';
			}
			return json( res, 200, { published: posts.size } );
		}
		if ( url.pathname === '/__expire' && req.method === 'POST' ) {
			accessTokens.clear();
			return json( res, 200, { expired: true } );
		}
		if ( url.pathname.startsWith( '/api/v1/' ) ) {
			return api( req, res, url );
		}
		json( res, 404, { error: 'not found' } );
	} catch ( err ) {
		json( res, 500, { error: err.message } );
	}
} );

server.listen( PORT, '127.0.0.1', () => {
	// eslint-disable-next-line no-console
	console.log( `Mock Orbitwrite on ${ ORIGIN }` );
} );
