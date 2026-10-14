/**
 * What was sent to Orbitwrite from an article.
 */
import { useCallback, useEffect, useRef, useState } from '@wordpress/element';

import * as api from '../lib/api';
import { stillMoving } from '../lib/shares';
import type { ArticleAutoShare, Share, SharesAnswer } from '../lib/types';

export interface Sent {
	shares: Share[];
	autoShare: ArticleAutoShare | null;
	setAutoShare: ( autoShare: ArticleAutoShare | null ) => void;
	timezone: string | null;
	loaded: boolean;
	add: ( sent: Share[] ) => void;
	remove: ( groupId: string ) => void;
	reload: () => Promise< SharesAnswer | null >;
	watchPublishing: ( justPublished?: boolean, tries?: number ) => void;
}

/** How often, and how many times, to re-read a post that is publishing. */
const POLL_MS = 3000;
const POLL_TRIES = 20;

/**
 * What was sent from an article, re-read while anything is publishing, and
 * what auto-share will do with it. Only used while connected.
 *
 * @param postId 0 when there's no article.
 * @return `{ shares, autoShare, setAutoShare, timezone, loaded, add, remove, reload, watchPublishing }`.
 */
export function useShares( postId: number ): Sent {
	const [ shares, setShares ] = useState< Share[] >( [] );
	const [ autoShare, setAutoShare ] = useState< ArticleAutoShare | null >(
		null
	);
	const [ timezone, setTimezone ] = useState< string | null >( null );
	const [ loaded, setLoaded ] = useState( false );
	const timer = useRef< ReturnType< typeof setTimeout > >();

	const load = useCallback( (): Promise< SharesAnswer | null > => {
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

	const watchPublishing: Sent[ 'watchPublishing' ] = useCallback(
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
		( sent: Share[] ) =>
			setShares( ( current ) => [ ...sent, ...current ] ),
		[]
	);
	const remove = useCallback(
		( groupId: string ) =>
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
