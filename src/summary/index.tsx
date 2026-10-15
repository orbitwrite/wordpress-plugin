/**
 * The workspace's last four weeks, for the Orbitwrite page: totals against
 * the four weeks before, and the best posts.
 *
 * Every number is Orbitwrite's. A metric nothing reported shows as a dash,
 * never 0.
 */
import { ExternalLink, Spinner } from '@wordpress/components';
import { useEffect, useState } from '@wordpress/element';
import { __, _n, sprintf } from '@wordpress/i18n';

import * as api from '../lib/api';
import { formatCount } from '../lib/numbers';
import type { AnalyticsAnswer } from '../lib/types';
import Frame from './frame';
import Tile from './tile';
import TopPosts from './top-posts';

/** The totals shown after the post count, in order. */
const TILES: Array< [ string, () => string ] > = [
	[ 'impressions', () => __( 'Impressions', 'orbitwrite' ) ],
	[ 'engagements', () => __( 'Engagements', 'orbitwrite' ) ],
	[ 'clicks', () => __( 'Link clicks', 'orbitwrite' ) ],
];

type State =
	| { loading: true; summary?: never; error?: never }
	| { summary: AnalyticsAnswer; loading?: never; error?: never }
	| { error: unknown; loading?: never; summary?: never };

/**
 * The analytics route's answer, read once.
 *
 * @return `{ loading }`, `{ summary }` or `{ error }`.
 */
function useAnalytics(): State {
	const [ state, setState ] = useState< State >( { loading: true } );
	useEffect( () => {
		api.getAnalytics()
			.then( ( summary ) => setState( { summary } ) )
			.catch( ( error ) => setState( { error } ) );
	}, [] );
	return state;
}

/**
 * The totals and notes about what they cover.
 *
 * @param props
 * @param props.overview
 */
function Totals( { overview }: { overview: AnalyticsAnswer[ 'overview' ] } ) {
	const posts = overview.posts;
	return (
		<>
			<div className="orbitwrite-summary__tiles">
				<Tile
					label={ __( 'Posts published', 'orbitwrite' ) }
					value={ posts.value }
					note={
						overview.hasPrevious &&
						typeof posts.previous === 'number'
							? sprintf(
									/* translators: %s: number of posts. */
									__( '%s the 4 weeks before', 'orbitwrite' ),
									formatCount( posts.previous )
							  )
							: null
					}
				/>
				{ TILES.map( ( [ key, label ] ) => {
					const metric = overview.metrics[ key ];
					return (
						<Tile
							key={ key }
							label={ label() }
							value={ metric?.value }
							percent={ metric?.changePercent }
						/>
					);
				} ) }
			</div>
			{ overview.hasPrevious && (
				<p className="orbitwrite-summary__muted">
					{ __(
						'Changes compare with the 4 weeks before.',
						'orbitwrite'
					) }
				</p>
			) }
			{ typeof overview.historyDays === 'number' && (
				<p className="orbitwrite-summary__muted">
					{ sprintf(
						/* translators: %d: number of days. */
						_n(
							"Your plan's analytics reach back %d day.",
							"Your plan's analytics reach back %d days.",
							overview.historyDays,
							'orbitwrite'
						),
						overview.historyDays
					) }
				</p>
			) }
		</>
	);
}

/**
 * @param props
 * @param props.widget Laid out for a dashboard widget.
 */
export default function Summary( { widget = false }: { widget?: boolean } ) {
	const state = useAnalytics();

	if ( state.loading ) {
		return (
			<Frame widget={ widget }>
				<Spinner />
			</Frame>
		);
	}
	// Not connected: the composer below offers to connect.
	if ( ! state.summary ) {
		return api.isNotConnected( state.error ) ? null : (
			<Frame widget={ widget }>
				<p className="orbitwrite-summary__muted">
					{ sprintf(
						/* translators: %s: why. */
						__(
							"Couldn't load the last four weeks: %s",
							'orbitwrite'
						),
						api.messageOf( state.error )
					) }
				</p>
			</Frame>
		);
	}

	const { overview, topPosts, analyticsUrl } = state.summary;

	return (
		<Frame widget={ widget } analyticsUrl={ analyticsUrl }>
			<Totals overview={ overview } />
			<TopPosts posts={ topPosts } timezone={ overview.timezone } />
			{ widget && analyticsUrl && (
				<p className="orbitwrite-summary__more">
					<ExternalLink href={ analyticsUrl }>
						{ __( 'Open analytics in Orbitwrite', 'orbitwrite' ) }
					</ExternalLink>
				</p>
			) }
		</Frame>
	);
}
