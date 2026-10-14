/**
 * What the composer reads from the plugin's REST routes: the connection, the
 * channels, the next free slot, and what was already sent from the article.
 */
import { useCallback, useEffect, useRef, useState } from '@wordpress/element';

import * as api from './api';
import { stillMoving } from './still-moving';

/** How often, and how many times, to re-read a post that is publishing. */
const POLL_MS = 3000;
const POLL_TRIES = 20;

/**
 * The user's connection, and a one-shot notice the OAuth flow left.
 *
 * @return {Object} `{ status, error, notice, setNotice, reload }`.
 */
export function useConnection() {
	// The page may carry the first answer (Admin::enqueue_build). It's used
	// once: a later mount, or a reload, asks again.
	const [ boot ] = useState( () => {
		const status = window.orbitwriteBoot?.status || null;
		if ( window.orbitwriteBoot ) {
			delete window.orbitwriteBoot.status;
		}
		return status;
	} );
	const [ status, setStatus ] = useState( boot );
	const [ error, setError ] = useState( null );
	const [ notice, setNotice ] = useState( boot?.notice || null );

	const reload = useCallback( () => {
		setError( null );
		return api
			.getStatus( window.location.href )
			.then( ( answer ) => {
				setStatus( answer );
				if ( answer.notice ) {
					setNotice( answer.notice );
				}
			} )
			.catch( ( err ) => setError( err.message ) );
	}, [] );

	useEffect( () => {
		if ( ! boot ) {
			reload();
		}
	}, [ boot, reload ] );

	return { status, error, notice, setNotice, reload };
}

/**
 * The workspace's channels and timezone. Only used while connected.
 *
 * @param {Function} onDisconnected Called with the error when the connection
 *                                  turns out to be gone.
 * @return {Object} `{ channels, timezone, error }`.
 */
export function useChannels( onDisconnected ) {
	const [ channels, setChannels ] = useState( null );
	const [ timezone, setTimezone ] = useState( 'UTC' );
	const [ error, setError ] = useState( null );

	useEffect( () => {
		setError( null );
		api.getChannels()
			.then( ( answer ) => {
				setChannels( answer.channels );
				setTimezone( answer.timezone || 'UTC' );
			} )
			.catch( ( err ) =>
				api.isNotConnected( err )
					? onDisconnected( err )
					: setError( err.message )
			);
	}, [ onDisconnected ] );

	return { channels, timezone, error };
}

/**
 * The soonest free slot for the picked channels, while "Next free slot" is
 * the choice. Debounced, since ticking several channels is several changes.
 *
 * @param {boolean}  active
 * @param {string[]} accountIds
 * @return {Object} `{ loading, at, error }`.
 */
export function useNextSlot( active, accountIds ) {
	const [ slot, setSlot ] = useState( { loading: false } );
	const key = accountIds.join( ',' );

	useEffect( () => {
		if ( ! active || ! accountIds.length ) {
			setSlot( { loading: false } );
			return;
		}
		let cancelled = false;
		setSlot( { loading: true } );
		const timer = setTimeout( () => {
			api.getNextSlot( accountIds )
				.then(
					( answer ) => ! cancelled && setSlot( { at: answer.at } )
				)
				.catch(
					( err ) => ! cancelled && setSlot( { error: err.message } )
				);
		}, 300 );
		return () => {
			cancelled = true;
			clearTimeout( timer );
		};
	}, [ active, key ] ); // eslint-disable-line react-hooks/exhaustive-deps

	return slot;
}

/**
 * What was sent from an article, re-read while anything is publishing, and
 * what auto-share will do with it. Only used while connected.
 *
 * @param {number} postId 0 when there's no article.
 * @return {Object} `{ shares, autoShare, setAutoShare, timezone, loaded, add, remove, reload, watchPublishing }`.
 */
export function useShares( postId ) {
	const [ shares, setShares ] = useState( [] );
	const [ autoShare, setAutoShare ] = useState( null );
	const [ timezone, setTimezone ] = useState( null );
	const [ loaded, setLoaded ] = useState( false );
	const timer = useRef( null );

	const load = useCallback( () => {
		if ( ! postId ) {
			return Promise.resolve( null );
		}
		return api
			.getShares( postId )
			.then( ( answer ) => {
				setShares( answer.shares );
				setAutoShare( answer.autoShare || null );
				setTimezone( answer.timezone || null );
				setLoaded( true );
				return answer;
			} )
			.catch( () => null );
	}, [ postId ] );

	useEffect( () => () => clearTimeout( timer.current ), [] );

	const watchPublishing = useCallback(
		( justPublished = false, tries = 0 ) => {
			clearTimeout( timer.current );
			if ( tries >= POLL_TRIES || ! postId ) {
				return;
			}
			timer.current = setTimeout( () => {
				load().then( ( answer ) => {
					if ( answer && stillMoving( answer, justPublished ) ) {
						watchPublishing( justPublished, tries + 1 );
					}
				} );
			}, POLL_MS );
		},
		[ load, postId ]
	);

	// The first read also catches an article auto-share is still sending,
	// as the classic editor shows it after publishing reloads the page.
	useEffect( () => {
		load().then(
			( answer ) => answer && stillMoving( answer ) && watchPublishing()
		);
	}, [ load, watchPublishing ] );

	const add = useCallback(
		( sent ) => setShares( ( current ) => [ ...sent, ...current ] ),
		[]
	);
	const remove = useCallback(
		( groupId ) =>
			setShares( ( current ) =>
				current.filter( ( share ) => share.groupId !== groupId )
			),
		[]
	);

	return {
		shares,
		autoShare,
		setAutoShare,
		timezone,
		loaded,
		add,
		remove,
		reload: load,
		watchPublishing,
	};
}

/**
 * Start watching an article's posts when the editor publishes it: the
 * editor doesn't reload, and says "published" before the save reaches the
 * server, so auto-share's queued post only shows up a moment later.
 *
 * @param {string|undefined} articleStatus   The article's status in the editor.
 * @param {Function}         watchPublishing From useShares().
 */
export function useWatchOnPublish( articleStatus, watchPublishing ) {
	const previous = useRef( articleStatus );
	useEffect( () => {
		const was = previous.current;
		previous.current = articleStatus;
		if ( articleStatus === 'publish' && was && was !== 'publish' ) {
			watchPublishing( true );
		}
	}, [ articleStatus, watchPublishing ] );
}

/**
 * How an article's published posts did, read once the list has any. Read
 * again only when another post finishes publishing.
 *
 * @param {number}   postId 0 to read nothing (no article, or not connected).
 * @param {Object[]} shares From useShares().
 * @return {Object} Numbers by Orbitwrite post id.
 */
export function useShareNumbers( postId, shares ) {
	const [ numbers, setNumbers ] = useState( {} );
	const published = shares
		.filter( ( share ) => share.status === 'published' )
		.map( ( share ) => share.groupId )
		.join( ',' );

	useEffect( () => {
		if ( ! postId || ! published ) {
			return;
		}
		let cancelled = false;
		api.getShareNumbers( postId )
			.then( ( answer ) => ! cancelled && setNumbers( answer.numbers ) )
			.catch( () => {} );
		return () => {
			cancelled = true;
		};
	}, [ postId, published ] );

	return numbers;
}
