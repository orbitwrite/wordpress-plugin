<?php
/**
 * What was sent to Orbitwrite from each article.
 *
 * @package Orbitwrite
 */

namespace Orbitwrite\WordPress;

use WP_Error;

defined( 'ABSPATH' ) || exit;

/**
 * A record per post sent from an article, in post meta, so the editor can
 * show "Scheduled for Thu 09:00 on X, LinkedIn" and offer to delete it.
 *
 * One send can make several posts: the channels using the main post are one,
 * and each channel with its own version is another. Each gets its own record,
 * because each is scheduled, approved, published and deleted on its own.
 *
 * Status is read back from `GET /posts?groupId=…`, which has no side effects.
 * (`GET /posts/draft` also reports status, but opening a failed post there
 * turns it back into an editable draft, which a status check must not do.)
 */
final class Shares {

	const META_KEY = '_orbitwrite_shares';

	/** States that can't change any more, so aren't re-read. */
	const SETTLED = array( 'published', 'deleted' );

	/**
	 * The article's records.
	 *
	 * @param int $post_id Article.
	 */
	public static function all( int $post_id ): array {
		$records = get_post_meta( $post_id, self::META_KEY, true );
		return is_array( $records ) ? array_values( $records ) : array();
	}

	/**
	 * Add records.
	 *
	 * @param int   $post_id Article.
	 * @param array $records Records.
	 */
	public static function add( int $post_id, array $records ): void {
		update_post_meta( $post_id, self::META_KEY, array_merge( self::all( $post_id ), array_values( $records ) ) );
	}

	/**
	 * Drop the record for a post.
	 *
	 * @param int    $post_id  Article.
	 * @param string $group_id Orbitwrite post id.
	 */
	public static function remove( int $post_id, string $group_id ): void {
		$records = array_filter(
			self::all( $post_id ),
			static function ( $record ) use ( $group_id ) {
				return ! in_array( $group_id, (array) ( $record['group_ids'] ?? array() ), true );
			}
		);
		update_post_meta( $post_id, self::META_KEY, array_values( $records ) );
	}

	/**
	 * New records for a successful create, one per post it made.
	 *
	 * @param array $result   The API's create result.
	 * @param array $entries  What was sent, per channel (see Post_Builder::build).
	 * @param array $schedule `{ scheduled_at, publish_now }`.
	 * @param int    $user_id         Who sent it.
	 * @param string $organization_id The workspace it went to.
	 */
	public static function records_for( array $result, array $entries, array $schedule, int $user_id, string $organization_id ): array {
		$records = array();
		foreach ( Post_Builder::groups_for( $entries, (array) ( $result['groupIds'] ?? array() ) ) as $group ) {
			$records[] = array(
				'group_ids'       => $group['group_ids'],
				'account_ids'     => $group['account_ids'],
				'own_version'     => ! $group['synced'],
				'scheduled_at'    => (string) ( $result['scheduledAt'] ?? $schedule['scheduled_at'] ),
				'publish_now'     => ! empty( $schedule['publish_now'] ),
				'status'          => ! empty( $result['publishing'] ) ? 'publishing' : 'scheduled',
				'bucket'          => null,
				'last_error'      => null,
				'links'           => array(),
				'excerpt'         => self::excerpt( $group['text'] ),
				'sent_by'         => $user_id,
				'sent_at'         => time(),
				'organization_id' => $organization_id,
			);
		}
		return $records;
	}

	/**
	 * Whether a post was sent from an article.
	 *
	 * @param int    $post_id  Article.
	 * @param string $group_id Orbitwrite post id.
	 */
	public static function has( int $post_id, string $group_id ): bool {
		foreach ( self::all( $post_id ) as $record ) {
			if ( in_array( $group_id, (array) ( $record['group_ids'] ?? array() ), true ) ) {
				return true;
			}
		}
		return false;
	}

	/**
	 * The start of a post's text, for the sent list.
	 *
	 * @param string $text Text.
	 */
	private static function excerpt( string $text ): string {
		return function_exists( 'mb_substr' ) ? mb_substr( $text, 0, 140 ) : substr( $text, 0, 140 );
	}

	/**
	 * Re-read the status of every record that can still change and that the
	 * viewer's workspace can see, and save it. A failed read leaves the stored
	 * status alone.
	 *
	 * @param Api    $api             Client.
	 * @param int    $post_id         Article.
	 * @param string $organization_id The viewer's workspace.
	 */
	public static function refresh( Api $api, int $post_id, string $organization_id ): array {
		$records = self::all( $post_id );
		$open    = array();
		foreach ( $records as $record ) {
			if ( self::refreshable( $record, $organization_id, $api->user_id() ) ) {
				foreach ( (array) ( $record['group_ids'] ?? array() ) as $group_id ) {
					$open[] = (string) $group_id;
				}
			}
		}
		if ( ! $open ) {
			return $records;
		}

		$answer = $api->get( '/posts', self::status_query( $open ) );
		if ( is_wp_error( $answer ) ) {
			return $records;
		}
		$entries = array();
		foreach ( (array) ( $answer['entries'] ?? array() ) as $entry ) {
			if ( is_array( $entry ) && isset( $entry['id'] ) ) {
				$entries[ (string) $entry['id'] ] = $entry;
			}
		}

		foreach ( $records as $index => $record ) {
			if ( self::refreshable( $record, $organization_id, $api->user_id() ) ) {
				$records[ $index ] = self::apply( $record, $entries );
			}
		}
		update_post_meta( $post_id, self::META_KEY, $records );
		return $records;
	}

	/**
	 * Whether a viewer can re-read a record's status. Pure.
	 *
	 * Only from the workspace it was sent to: anywhere else the listing
	 * doesn't have it, which apply() reads as deleted, and deleted is never
	 * re-read. A record from before the workspace was kept is re-read only by
	 * whoever sent it.
	 *
	 * @param array  $record          Record.
	 * @param string $organization_id The viewer's workspace.
	 * @param int    $user_id         The viewer.
	 */
	public static function refreshable( array $record, string $organization_id, int $user_id ): bool {
		if ( in_array( $record['status'] ?? '', self::SETTLED, true ) ) {
			return false;
		}
		if ( isset( $record['organization_id'] ) ) {
			return '' !== $organization_id && $record['organization_id'] === $organization_id;
		}
		return (int) ( $record['sent_by'] ?? 0 ) === $user_id;
	}

	/**
	 * The listing query for some posts' current state: by id, as many as one
	 * page holds.
	 *
	 * @param string[] $group_ids Orbitwrite post ids.
	 */
	public static function status_query( array $group_ids ): array {
		return array(
			'groupId' => array_slice( array_values( array_unique( $group_ids ) ), 0, 100 ),
			'limit'   => 100,
		);
	}

	/**
	 * Fold the listing's entries for a record's posts into it.
	 *
	 * @param array $record  Record.
	 * @param array $entries Listing entries by id.
	 */
	public static function apply( array $record, array $entries ): array {
		$found = array();
		foreach ( (array) $record['group_ids'] as $group_id ) {
			if ( isset( $entries[ $group_id ] ) ) {
				$found[] = $entries[ $group_id ];
			}
		}
		if ( ! $found ) {
			// Not in the workspace any more: deleted in Orbitwrite.
			$record['status'] = 'deleted';
			return $record;
		}

		$entry                  = $found[0];
		$record['status']       = (string) ( $entry['status'] ?? $record['status'] );
		$record['bucket']       = isset( $entry['bucket'] ) ? (string) $entry['bucket'] : null;
		$record['last_error']   = isset( $entry['lastError'] ) ? (string) $entry['lastError'] : null;
		$record['scheduled_at'] = isset( $entry['scheduledAt'] ) ? (string) $entry['scheduledAt'] : $record['scheduled_at'];

		// Orbitwrite's word on which channels this post carries.
		$account_ids = array();
		foreach ( $found as $post ) {
			foreach ( (array) ( $post['accounts'] ?? array() ) as $account ) {
				if ( ! empty( $account['id'] ) ) {
					$account_ids[] = (string) $account['id'];
				}
			}
		}
		if ( $account_ids ) {
			$record['account_ids'] = array_values( array_unique( $account_ids ) );
		}

		$links = array();
		foreach ( $found as $post ) {
			foreach ( (array) ( $post['accounts'] ?? array() ) as $account ) {
				if ( ! empty( $account['platformUrl'] ) ) {
					$links[] = array(
						'platform' => (string) ( $account['platform'] ?? '' ),
						'handle'   => isset( $account['handle'] ) ? (string) $account['handle'] : null,
						'url'      => (string) $account['platformUrl'],
					);
				}
			}
		}
		$record['links'] = $links;
		return $record;
	}

	/**
	 * Keep each post's latest numbers on its record, so the Posts list can
	 * show them without asking Orbitwrite while it draws.
	 *
	 * @param int   $post_id Article.
	 * @param array $numbers Numbers by Orbitwrite post id (Analytics::post_numbers).
	 */
	public static function store_numbers( int $post_id, array $numbers ): void {
		if ( ! $numbers ) {
			return;
		}
		$records = self::all( $post_id );
		$changed = false;
		foreach ( $records as $index => $record ) {
			$group_id = (string) ( $record['group_ids'][0] ?? '' );
			if ( isset( $numbers[ $group_id ] ) && ( $record['numbers'] ?? null ) !== $numbers[ $group_id ] ) {
				$records[ $index ]['numbers']    = $numbers[ $group_id ];
				$records[ $index ]['numbers_at'] = time();
				$changed                         = true;
			}
		}
		if ( $changed ) {
			update_post_meta( $post_id, self::META_KEY, $records );
		}
	}

	/**
	 * An article's records summed up for the Posts list. Pure.
	 *
	 * @param array[] $records The article's records.
	 * @return array `{ published, scheduled, failed, waiting, impressions, clicks }`;
	 *               the two metrics are null when no published post reported them.
	 */
	public static function column( array $records ): array {
		$summary = array(
			'published'   => 0,
			'scheduled'   => 0,
			'failed'      => 0,
			'waiting'     => 0,
			'impressions' => null,
			'clicks'      => null,
		);
		foreach ( $records as $record ) {
			$status = (string) ( $record['status'] ?? '' );
			if ( 'deleted' === $status ) {
				continue;
			}
			if ( 'published' === $status ) {
				++$summary['published'];
				foreach ( array( 'impressions', 'clicks' ) as $metric ) {
					$value = $record['numbers'][ $metric ] ?? null;
					if ( is_int( $value ) || is_float( $value ) ) {
						$summary[ $metric ] = ( $summary[ $metric ] ?? 0 ) + $value;
					}
				}
			} elseif ( ! empty( $record['last_error'] ) ) {
				++$summary['failed'];
			} elseif ( 'pending_approval' === $status || in_array( $record['bucket'] ?? '', array( 'needs_approval', 'needs_revision' ), true ) ) {
				++$summary['waiting'];
			} else {
				++$summary['scheduled'];
			}
		}
		return $summary;
	}

	/**
	 * A record as the editor sees it.
	 *
	 * @param array      $record       Record.
	 * @param array|null $organization Connected workspace.
	 */
	public static function present( array $record, ?array $organization ): array {
		$group_id = (string) ( $record['group_ids'][0] ?? '' );
		return array(
			'groupId'     => $group_id,
			'accountIds'  => $record['account_ids'] ?? array(),
			'ownVersion'  => ! empty( $record['own_version'] ),
			'scheduledAt' => $record['scheduled_at'] ?? null,
			'publishNow'  => ! empty( $record['publish_now'] ),
			'status'      => $record['status'] ?? 'scheduled',
			'bucket'      => $record['bucket'] ?? null,
			'lastError'   => $record['last_error'] ?? null,
			'links'       => $record['links'] ?? array(),
			'excerpt'     => $record['excerpt'] ?? '',
			'openUrl'     => self::open_url( $group_id, $organization ),
			'canDelete'   => ! in_array( $record['status'] ?? '', array( 'published', 'publishing', 'deleted' ), true ),
		);
	}

	/**
	 * Where a post opens in the Orbitwrite app.
	 *
	 * @param string     $group_id     Orbitwrite post id.
	 * @param array|null $organization Connected workspace.
	 */
	public static function open_url( string $group_id, ?array $organization ): ?string {
		if ( '' === $group_id || empty( $organization['slug'] ) ) {
			return null;
		}
		return Config::base_url() . '/' . rawurlencode( (string) $organization['slug'] ) . '/schedule?open=' . rawurlencode( $group_id );
	}
}
