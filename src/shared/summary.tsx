/**
 * The workspace's last four weeks, for the Orbitwrite page: totals against
 * the four weeks before, and the best posts.
 *
 * Every number is Orbitwrite's. A metric nothing reported shows as a dash,
 * never 0.
 */
import {
	Card,
	CardBody,
	CardHeader,
	ExternalLink,
	Spinner,
	VisuallyHidden,
} from '@wordpress/components';
import { useEffect, useState } from '@wordpress/element';
import { __, _n, sprintf } from '@wordpress/i18n';
import type { ReactNode } from 'react';

import * as api from './api';
import { formatChange, formatCount } from './numbers';
import { formatInstant } from './time';
import type { AnalyticsAnswer } from './types';

/** The totals shown, in order. */
const TILES: Array< [ string, () => string ] > = [
	[ 'impressions', () => __( 'Impressions', 'orbitwrite' ) ],
	[ 'engagements', () => __( 'Engagements', 'orbitwrite' ) ],
	[ 'clicks', () => __( 'Link clicks', 'orbitwrite' ) ],
];

/**
 * Which way a change went, for its colour.
 *
 * @param percent
 * @return `up`, `down` or `flat`.
 */
function direction(
	percent: number | null | undefined
): 'up' | 'down' | 'flat' {
	const rounded = Math.round( percent || 0 );
	if ( rounded > 0 ) {
		return 'up';
	}
	return rounded < 0 ? 'down' : 'flat';
}

function Tile( {
	label,
	value,
	percent,
	note,
}: {
	label: string;
	value: number | null | undefined;
	percent?: number | null;
	note?: string | null;
} ) {
	const change = formatChange( percent );
	return (
		<div className="orbitwrite-summary__tile">
			<span className="orbitwrite-summary__tile-label">{ label }</span>
			<span className="orbitwrite-summary__tile-value">
				{ typeof value === 'number' ? formatCount( value ) : '—' }
			</span>
			{ change && (
				<span
					className={ `orbitwrite-summary__change is-${ direction(
						percent
					) }` }
				>
					{ /* Colour alone doesn't say which way it went. */ }
					<span aria-hidden="true">
						{
							{ up: '↑ ', down: '↓ ', flat: '' }[
								direction( percent )
							]
						}
					</span>
					{ change }
					<VisuallyHidden>
						{ ' ' }
						{ __( 'against the 4 weeks before', 'orbitwrite' ) }
					</VisuallyHidden>
				</span>
			) }
			{ note && (
				<span className="orbitwrite-summary__note">{ note }</span>
			) }
		</div>
	);
}

/**
 * The frame: a card on the Orbitwrite page, bare inside a dashboard widget,
 * which brings its own title and box.
 *
 * @param props
 * @param props.widget
 * @param props.heading  The card's header.
 * @param props.children
 */
function Frame( {
	widget,
	heading,
	children,
}: {
	widget: boolean;
	heading: ReactNode;
	children: ReactNode;
} ) {
	if ( widget ) {
		return <div className="orbitwrite-summary is-widget">{ children }</div>;
	}
	return (
		<Card className="orbitwrite-summary">
			{ heading }
			<CardBody>{ children }</CardBody>
		</Card>
	);
}

/**
 * @param props
 * @param props.widget Laid out for a dashboard widget.
 */
export default function Summary( { widget = false }: { widget?: boolean } ) {
	const [ state, setState ] = useState<
		| { loading: true; summary?: never; error?: never }
		| { summary: AnalyticsAnswer; loading?: never; error?: never }
		| { error: unknown; loading?: never; summary?: never }
	>( { loading: true } );

	useEffect( () => {
		api.getAnalytics()
			.then( ( summary ) => setState( { summary } ) )
			.catch( ( error ) => setState( { error } ) );
	}, [] );

	const heading = (
		<CardHeader>
			<h2>{ __( 'Last 4 weeks', 'orbitwrite' ) }</h2>
			{ state.summary?.analyticsUrl && (
				<ExternalLink href={ state.summary.analyticsUrl }>
					{ __( 'Open analytics in Orbitwrite', 'orbitwrite' ) }
				</ExternalLink>
			) }
		</CardHeader>
	);

	if ( state.loading ) {
		return (
			<Frame widget={ widget } heading={ heading }>
				<Spinner />
			</Frame>
		);
	}
	// Not connected: the composer below offers to connect.
	if ( ! state.summary ) {
		return api.isNotConnected( state.error ) ? null : (
			<Frame widget={ widget } heading={ heading }>
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

	const { overview, topPosts } = state.summary;
	const posts = overview.posts;

	return (
		<Frame widget={ widget } heading={ heading }>
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

			{ topPosts.length > 0 && (
				<>
					<h3>{ __( 'Top posts', 'orbitwrite' ) }</h3>
					<ol className="orbitwrite-summary__posts">
						{ topPosts.map( ( post ) => (
							<li key={ post.groupId || post.publishedAt }>
								<p className="orbitwrite-summary__excerpt">
									{ post.excerpt }
								</p>
								<p className="orbitwrite-summary__muted">
									{ [
										formatInstant(
											post.publishedAt,
											overview.timezone
										),
										typeof post.metrics.engagements ===
										'number'
											? sprintf(
													/* translators: %s: number. */
													_n(
														'%s engagement',
														'%s engagements',
														post.metrics
															.engagements,
														'orbitwrite'
													),
													formatCount(
														post.metrics.engagements
													)
											  )
											: null,
										typeof post.metrics.impressions ===
										'number'
											? sprintf(
													/* translators: %s: number. */
													_n(
														'%s impression',
														'%s impressions',
														post.metrics
															.impressions,
														'orbitwrite'
													),
													formatCount(
														post.metrics.impressions
													)
											  )
											: null,
									]
										.filter( Boolean )
										.join( ' · ' ) }
								</p>
								<p className="orbitwrite-composer__row">
									{ post.links.map( ( link ) => (
										<ExternalLink
											key={ link.url }
											href={ link.url }
										>
											{ link.handle || link.platform }
										</ExternalLink>
									) ) }
									{ post.openUrl && (
										<ExternalLink href={ post.openUrl }>
											{ __(
												'Open in Orbitwrite',
												'orbitwrite'
											) }
										</ExternalLink>
									) }
								</p>
							</li>
						) ) }
					</ol>
				</>
			) }
			{ widget && state.summary.analyticsUrl && (
				<p className="orbitwrite-summary__more">
					<ExternalLink href={ state.summary.analyticsUrl }>
						{ __( 'Open analytics in Orbitwrite', 'orbitwrite' ) }
					</ExternalLink>
				</p>
			) }
		</Frame>
	);
}
