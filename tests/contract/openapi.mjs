/**
 * Validate requests and responses against openapi/orbitwrite.json, the
 * vendored slice of Orbitwrite's API (see scripts/sync-openapi.mjs).
 *
 * Used by the contract test (what the PHP builds) and by the mock Orbitwrite
 * (every request the plugin really sends in the end-to-end run, and every
 * answer the mock gives), so neither the plugin nor the mock can drift from
 * the API without a test failing.
 */
import { readFileSync } from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const SPEC_ID = 'orbitwrite.json';
const spec = JSON.parse(
	readFileSync(
		new URL( '../../openapi/orbitwrite.json', import.meta.url ),
		'utf8'
	)
);

// OpenAPI keywords that aren't JSON Schema (`example`, …) are allowed.
const ajv = new Ajv2020( { strict: false, allErrors: true } );
addFormats( ajv );
ajv.addSchema( spec, SPEC_ID );

const compiled = new Map();
function validatorAt( pointer ) {
	if ( ! compiled.has( pointer ) ) {
		compiled.set(
			pointer,
			ajv.compile( { $ref: `${ SPEC_ID }#${ pointer }` } )
		);
	}
	return compiled.get( pointer );
}

const escape = ( segment ) =>
	segment.replace( /~/g, '~0' ).replace( /\//g, '~1' );

/**
 * The spec's path for a request path: itself when the spec lists it,
 * otherwise the template it fills in (`/api/v1/posts/grp_1/metrics` is
 * `/api/v1/posts/{groupId}/metrics`). A listed path wins over a template, so
 * `/api/v1/posts/discard` is never read as a post id.
 *
 * @param {string} method
 * @param {string} path
 * @return {string} Spec path, or `path` when nothing matches.
 */
function specPath( method, path ) {
	if ( spec.paths[ path ]?.[ method.toLowerCase() ] ) {
		return path;
	}
	const segments = path.split( '/' );
	const template = Object.keys( spec.paths ).find( ( candidate ) => {
		const parts = candidate.split( '/' );
		return (
			spec.paths[ candidate ][ method.toLowerCase() ] &&
			parts.length === segments.length &&
			parts.every(
				( part, index ) =>
					/^\{[^}]+\}$/.test( part ) || part === segments[ index ]
			)
		);
	} );
	return template || path;
}

function operation( method, path ) {
	const op = spec.paths[ path ]?.[ method.toLowerCase() ];
	if ( ! op ) {
		throw new Error(
			`${ method } ${ path } isn't in openapi/orbitwrite.json. Add it to scripts/sync-openapi.mjs and re-sync.`
		);
	}
	return op;
}

function describe( errors ) {
	return ( errors || [] )
		.map( ( error ) => `${ error.instancePath || '/' } ${ error.message }` )
		.join( '; ' );
}

/**
 * Problems with a request, as sentences. Empty when it matches the spec.
 *
 * @param {string}          method
 * @param {string}          requested e.g. `/api/v1/posts`.
 * @param {URLSearchParams} query
 * @param {*}               body      Parsed JSON, or undefined.
 * @return {string[]} Problems.
 */
export function requestProblems( method, requested, query, body ) {
	const path = specPath( method, requested );
	const op = operation( method, path );
	const problems = [];

	const declared = new Map(
		( op.parameters || [] )
			.filter( ( parameter ) => parameter.in === 'query' )
			.map( ( parameter ) => [ parameter.name, parameter ] )
	);
	for ( const name of new Set( query.keys() ) ) {
		if ( ! declared.has( name ) ) {
			problems.push( `query parameter "${ name }" isn't in the spec` );
		}
	}
	for ( const [ name, parameter ] of declared ) {
		const values = query.getAll( name );
		if ( ! values.length ) {
			if ( parameter.required ) {
				problems.push( `query parameter "${ name }" is required` );
			}
			continue;
		}
		const schema = parameter.schema || {};
		// `type` may be a list (`["integer", "null"]`) as well as a name.
		const types = [ schema, ...( schema.anyOf || [] ) ].flatMap(
			( s ) => s.type ?? []
		);
		const coerce = ( value ) => {
			if ( types.includes( 'integer' ) || types.includes( 'number' ) ) {
				return Number( value );
			}
			if ( types.includes( 'boolean' ) ) {
				return value === 'true';
			}
			return value;
		};
		const value =
			values.length > 1 || types.includes( 'array' )
				? values.map( coerce )
				: coerce( values[ 0 ] );
		const index = op.parameters.indexOf( parameter );
		const validate = validatorAt(
			`/paths/${ escape(
				path
			) }/${ method.toLowerCase() }/parameters/${ index }/schema`
		);
		if ( ! validate( value ) ) {
			problems.push(
				`query "${ name }": ${ describe( validate.errors ) }`
			);
		}
	}

	const content = op.requestBody?.content?.[ 'application/json' ];
	if ( content ) {
		const validate = validatorAt(
			`/paths/${ escape(
				path
			) }/${ method.toLowerCase() }/requestBody/content/application~1json/schema`
		);
		if ( body === undefined ) {
			if ( op.requestBody.required ) {
				problems.push( 'body is required' );
			}
		} else if ( ! validate( body ) ) {
			problems.push( `body: ${ describe( validate.errors ) }` );
		}
	} else if ( body !== undefined ) {
		problems.push( 'the spec declares no body' );
	}
	return problems;
}

/**
 * Problems with a response, as sentences. Empty when it matches the spec.
 *
 * @param {string} method
 * @param {string} requested
 * @param {number} status
 * @param {*}      body
 * @return {string[]} Problems.
 */
export function responseProblems( method, requested, status, body ) {
	const path = specPath( method, requested );
	const op = operation( method, path );
	if ( ! op.responses?.[ String( status ) ] ) {
		return [ `status ${ status } isn't a declared response` ];
	}
	if ( ! op.responses[ String( status ) ].content?.[ 'application/json' ] ) {
		return [];
	}
	const validate = validatorAt(
		`/paths/${ escape(
			path
		) }/${ method.toLowerCase() }/responses/${ status }/content/application~1json/schema`
	);
	return validate( body )
		? []
		: [ `response ${ status }: ${ describe( validate.errors ) }` ];
}
