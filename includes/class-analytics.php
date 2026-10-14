<?php
/**
 * How sent posts did, read from Orbitwrite's analytics.
 *
 * @package Orbitwrite
 */

namespace Orbitwrite\WordPress;

use WP_Error;

defined( 'ABSPATH' ) || exit;

/**
 * Two reads, both cached for an hour: each published post's numbers (for the
 * list under the composer) and the workspace's last four weeks (for the
 * Orbitwrite page).
 *
 * Orbitwrite re-reads a post's numbers from the networks every few hours at
 * most, so an hour's cache loses nothing and keeps opening an article from
 * costing a request. Nothing here works a number out: the totals are
 * Orbitwrite's, and so is each post's, its channels' latest readings added
 * up. A metric no channel reported stays null, never 0, so "no impressions
 * reported" (Bluesky has none) can't read as "nobody saw it".
 */
final class Analytics {

	/** The metrics the sent list shows for a post, in order. */
	const POST_METRICS = array( 'impressions', 'reactions', 'comments', 'reposts', 'clicks' );

	/** The summary's window, in days. */
	const SUMMARY_DAYS = 28;

	/** How many top posts the summary lists. */
	const TOP_POSTS = 3;

	/** The most posts one read can name: Orbitwrite's cap on `groupIds`. */
	const NUMBERS_BATCH = 50;

	/**
	 * Each post's numbers, by Orbitwrite post id. What isn't cached is one
	 * `GET /analytics/posts?groupIds=…` per 50 posts, which answers each
	 * post's channels already added up. A read that fails leaves its posts
	 * out rather than failing the rest.
	 *
	 * @param Api      $api       Client.
	 * @param string   $org_id    Workspace, for the cache key.
	 * @param string[] $group_ids Orbitwrite post ids.
	 * @return array `[ group id => { impressions, reactions, … } ]`.
	 */
	public static function post_numbers( Api $api, string $org_id, array $group_ids ): array {
		$numbers = array();
		$missing = array();
		foreach ( array_unique( array_map( 'strval', $group_ids ) ) as $group_id ) {
			$cached = get_transient( self::numbers_key( $org_id, $group_id ) );
			if ( is_array( $cached ) ) {
				$numbers[ $group_id ] = $cached;
			} else {
				$missing[] = $group_id;
			}
		}
		foreach ( array_chunk( $missing, self::NUMBERS_BATCH ) as $batch ) {
			$page = $api->get( '/analytics/posts', self::numbers_query( $batch ) );
			if ( is_wp_error( $page ) ) {
				continue;
			}
			$found = self::numbers_by_group( $page );
			foreach ( $batch as $group_id ) {
				// A post Orbitwrite left out has nothing reported yet.
				$totals = $found[ $group_id ] ?? array_fill_keys( self::POST_METRICS, null );
				// Nothing read yet is worth asking about again sooner.
				set_transient( self::numbers_key( $org_id, $group_id ), $totals, self::has_any( $totals ) ? HOUR_IN_SECONDS : 15 * MINUTE_IN_SECONDS );
				$numbers[ $group_id ] = $totals;
			}
		}
		return $numbers;
	}

	/**
	 * The query for named posts' numbers. With no window of its own the read
	 * reaches back as far as the workspace's plan keeps analytics, so an old
	 * article's posts aren't missed, and every post named comes back on one
	 * page. Ranked by engagements, the metric every network reports some
	 * part of, since a post with no reading of the ranked metric is left out.
	 *
	 * @param string[] $group_ids Orbitwrite post ids, at most 50.
	 */
	public static function numbers_query( array $group_ids ): array {
		return array(
			'groupIds' => array_values( $group_ids ),
			'metric'   => 'engagements',
			'limit'    => max( 1, count( $group_ids ) ),
		);
	}

	/**
	 * The cache key for one post's numbers.
	 *
	 * @param string $org_id   Workspace.
	 * @param string $group_id Orbitwrite post id.
	 */
	private static function numbers_key( string $org_id, string $group_id ): string {
		return 'orbitwrite_numbers_' . md5( Config::base_url() . '|' . $org_id . '|' . $group_id );
	}

	/** The cron hook that keeps recent articles' numbers fresh. */
	const REFRESH_HOOK = 'orbitwrite_refresh_numbers';

	/** How far back the refresh looks: Orbitwrite reads a post for 90 days. */
	const REFRESH_DAYS = 90;

	/** The most articles one refresh looks at. */
	const REFRESH_LIMIT = 50;

	/**
	 * Register the twice-daily refresh.
	 */
	public static function register(): void {
		add_action( self::REFRESH_HOOK, array( self::class, 'refresh_recent' ) );
		add_action(
			'init',
			static function () {
				if ( ! wp_next_scheduled( self::REFRESH_HOOK ) ) {
					wp_schedule_event( time() + HOUR_IN_SECONDS, 'twicedaily', self::REFRESH_HOOK );
				}
			}
		);
	}

	/**
	 * The cron run: re-read the numbers of recent articles' published posts,
	 * so the Posts list's Social column isn't only as fresh as the last time
	 * someone opened each article. Each post is read with the connection of
	 * whoever sent it, since it's in their workspace, and each sender's posts
	 * across every article are read together.
	 */
	public static function refresh_recent(): void {
		$posts     = get_posts(
			array(
				'post_type'   => Admin::post_types(),
				'post_status' => 'any',
				'numberposts' => self::REFRESH_LIMIT,
				'orderby'     => 'date',
				'order'       => 'DESC',
				'meta_key'    => Shares::META_KEY, // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_key
				'date_query'  => array( array( 'after' => self::REFRESH_DAYS . ' days ago' ) ),
			)
		);
		$by_sender = array();
		foreach ( $posts as $post ) {
			foreach ( Shares::all( $post->ID ) as $record ) {
				if ( 'published' === ( $record['status'] ?? '' ) && ! empty( $record['group_ids'][0] ) ) {
					$by_sender[ (int) ( $record['sent_by'] ?? 0 ) ][ $post->ID ][] = (string) $record['group_ids'][0];
				}
			}
		}
		foreach ( $by_sender as $user_id => $articles ) {
			$connection = $user_id ? Token_Store::get( $user_id ) : null;
			if ( ! $connection ) {
				continue;
			}
			$numbers = self::post_numbers(
				new Api( $user_id ),
				(string) ( $connection['organization']['id'] ?? '' ),
				array_merge( ...array_values( $articles ) )
			);
			foreach ( $articles as $post_id => $group_ids ) {
				Shares::store_numbers( $post_id, array_intersect_key( $numbers, array_flip( $group_ids ) ) );
			}
		}
	}

	/**
	 * Each named post's numbers from a `GET /analytics/posts` page, by
	 * Orbitwrite post id. Orbitwrite has already added up each post's
	 * channels; a metric no channel reported stays null. Pure.
	 *
	 * @param array $page An `AnalyticsTopPosts`.
	 * @return array `[ group id => { impressions, reactions, comments, reposts, clicks } ]`.
	 */
	public static function numbers_by_group( array $page ): array {
		$numbers = array();
		foreach ( (array) ( $page['entries'] ?? array() ) as $entry ) {
			if ( ! is_array( $entry ) || empty( $entry['groupId'] ) ) {
				continue;
			}
			$totals = array();
			foreach ( self::POST_METRICS as $metric ) {
				$value             = $entry['metrics'][ $metric ] ?? null;
				$totals[ $metric ] = is_int( $value ) || is_float( $value ) ? $value : null;
			}
			$numbers[ (string) $entry['groupId'] ] = $totals;
		}
		return $numbers;
	}

	/**
	 * Whether any metric was reported.
	 *
	 * @param array $totals A post's numbers, from numbers_by_group().
	 */
	public static function has_any( array $totals ): bool {
		foreach ( $totals as $value ) {
			if ( null !== $value ) {
				return true;
			}
		}
		return false;
	}

	/**
	 * The workspace's last four weeks: totals against the four weeks before,
	 * and its best posts.
	 *
	 * @param Api         $api          Client.
	 * @param array|null  $organization Connected workspace.
	 * @return array|WP_Error `{ overview, topPosts, analyticsUrl }`.
	 */
	public static function summary( Api $api, ?array $organization ) {
		$org_id = (string) ( $organization['id'] ?? '' );
		$key    = 'orbitwrite_summary_' . md5( Config::base_url() . '|' . $org_id . '|' . $api->user_id() );
		$cached = get_transient( $key );
		if ( is_array( $cached ) ) {
			return $cached;
		}

		$overview = $api->get( '/analytics/overview', self::overview_query() );
		if ( is_wp_error( $overview ) ) {
			return $overview;
		}
		// The top posts are extra: without them the totals still stand.
		$top = $api->get( '/analytics/posts', self::top_posts_query() );

		$summary = array(
			'overview'     => self::present_overview( $overview ),
			'topPosts'     => is_wp_error( $top ) ? array() : self::present_top_posts( $top, $organization ),
			'analyticsUrl' => empty( $organization['slug'] ) ? null : Config::base_url() . '/' . rawurlencode( (string) $organization['slug'] ) . '/analytics',
		);
		set_transient( $key, $summary, HOUR_IN_SECONDS );
		return $summary;
	}

	/**
	 * The overview query: the last four weeks, against the four before.
	 */
	public static function overview_query(): array {
		return array( 'days' => self::SUMMARY_DAYS );
	}

	/**
	 * The top posts query: the same window, best first by engagements.
	 */
	public static function top_posts_query(): array {
		return array(
			'days'   => self::SUMMARY_DAYS,
			'metric' => 'engagements',
			'limit'  => self::TOP_POSTS,
		);
	}

	/**
	 * The overview as the page shows it. Pure.
	 *
	 * @param array $overview An `AnalyticsOverview`.
	 */
	public static function present_overview( array $overview ): array {
		$metrics = array();
		foreach ( (array) ( $overview['metrics'] ?? array() ) as $metric ) {
			if ( ! is_array( $metric ) || empty( $metric['metric'] ) ) {
				continue;
			}
			$metrics[ (string) $metric['metric'] ] = array(
				'value'         => $metric['value'] ?? null,
				'previous'      => $metric['previous'] ?? null,
				'changePercent' => $metric['changePercent'] ?? null,
			);
		}
		return array(
			'from'        => (string) ( $overview['from'] ?? '' ),
			'to'          => (string) ( $overview['to'] ?? '' ),
			'timezone'    => (string) ( $overview['timezone'] ?? 'UTC' ),
			'historyDays' => $overview['historyDays'] ?? null,
			'hasPrevious' => ! empty( $overview['previous'] ),
			'posts'       => array(
				'value'    => (int) ( $overview['posts']['current'] ?? 0 ),
				'previous' => $overview['posts']['previous'] ?? null,
			),
			'metrics'     => $metrics,
		);
	}

	/**
	 * The top posts as the page shows them. Pure.
	 *
	 * @param array      $top          An `AnalyticsTopPosts`.
	 * @param array|null $organization Connected workspace, for the links.
	 */
	public static function present_top_posts( array $top, ?array $organization ): array {
		$posts = array();
		foreach ( (array) ( $top['entries'] ?? array() ) as $entry ) {
			if ( ! is_array( $entry ) ) {
				continue;
			}
			$group_id = isset( $entry['groupId'] ) ? (string) $entry['groupId'] : '';
			$links    = array();
			foreach ( (array) ( $entry['channels'] ?? array() ) as $channel ) {
				if ( ! empty( $channel['platformUrl'] ) ) {
					$links[] = array(
						'platform' => (string) ( $channel['platform'] ?? '' ),
						'handle'   => isset( $channel['channel'] ) ? (string) $channel['channel'] : null,
						'url'      => (string) $channel['platformUrl'],
					);
				}
			}
			$text    = (string) ( $entry['text'] ?? '' );
			$posts[] = array(
				'groupId'     => $group_id,
				'excerpt'     => function_exists( 'mb_substr' ) ? mb_substr( $text, 0, 140 ) : substr( $text, 0, 140 ),
				'publishedAt' => (string) ( $entry['publishedAt'] ?? '' ),
				'metrics'     => array(
					'engagements' => $entry['metrics']['engagements'] ?? null,
					'impressions' => $entry['metrics']['impressions'] ?? null,
					'clicks'      => $entry['metrics']['clicks'] ?? null,
				),
				'links'       => $links,
				'openUrl'     => '' === $group_id ? null : Shares::open_url( $group_id, $organization ),
			);
		}
		return $posts;
	}
}
