<?php
/**
 * The body of `POST /api/v1/posts`.
 *
 * @package Orbitwrite
 */

namespace Orbitwrite\WordPress;

defined( 'ABSPATH' ) || exit;

/**
 * Builds the create-post request, and reads its answer. Pure.
 *
 * A channel using the main post is `isSynced: true`, and every such channel
 * together is **one post** in Orbitwrite (a composer group). A channel with
 * its own version is `isSynced: false`, and Orbitwrite makes it **a post of
 * its own**. That isn't the plugin's choice: the app copies the main channel's
 * text onto every channel it believes is synced, so a group claiming to be
 * synced while holding different copy would lose that copy the first time
 * someone opened it in Orbitwrite.
 *
 * The request is pinned to openapi/orbitwrite.json by the contract test.
 */
final class Post_Builder {

	/**
	 * The request body.
	 *
	 * @param array[]  $entries      One per channel, in order:
	 *                               `{ account_id, synced, text, media_id }`.
	 * @param array    $schedule     `{ scheduled_at, publish_now }`.
	 * @param string   $title        The post's name inside Orbitwrite.
	 * @param callable $uuid         Returns a fresh UUID.
	 */
	public static function build( array $entries, array $schedule, string $title, callable $uuid ): array {
		$accounts = array();
		foreach ( $entries as $entry ) {
			$item = array(
				'id'      => $uuid(),
				'content' => (string) $entry['text'],
			);
			if ( ! empty( $entry['media_id'] ) ) {
				$item['mediaIds'] = array( (string) $entry['media_id'] );
			}
			$accounts[] = array(
				'accountId' => (string) $entry['account_id'],
				'isSynced'  => (bool) $entry['synced'],
				'items'     => array( $item ),
			);
		}

		$body = array(
			'scheduledAt' => (string) $schedule['scheduled_at'],
			'accounts'    => $accounts,
		);
		if ( ! empty( $schedule['publish_now'] ) ) {
			$body['publishNow'] = true;
		}
		$title = trim( $title );
		if ( '' !== $title ) {
			$body['info'] = array( 'title' => function_exists( 'mb_substr' ) ? mb_substr( $title, 0, 200 ) : substr( $title, 0, 200 ) );
		}
		return $body;
	}

	/**
	 * The body of `POST /posts/discard`.
	 *
	 * @param string $group_id Orbitwrite post id.
	 */
	public static function discard_body( string $group_id ): array {
		return array( 'groupId' => $group_id );
	}

	/**
	 * Which of the returned posts carries which channels.
	 *
	 * Orbitwrite answers with `groupIds` in the order the channels were sent:
	 * the synced channels share the group of the first of them, and each
	 * channel with its own version has its own. This is the plugin's first
	 * guess; reading the posts back corrects it if Orbitwrite ever groups
	 * differently. When the count doesn't add up, everything is one record
	 * holding every post, which the read-back then sorts out.
	 *
	 * @param array[]  $entries   As passed to `build`.
	 * @param string[] $group_ids The create result's `groupIds`.
	 * @return array[] `[{ group_ids, account_ids, synced, text }]`.
	 */
	public static function groups_for( array $entries, array $group_ids ): array {
		$group_ids = array_values( array_map( 'strval', $group_ids ) );
		$groups    = array();
		$synced_at = null;
		foreach ( $entries as $entry ) {
			if ( ! empty( $entry['synced'] ) && null !== $synced_at ) {
				$groups[ $synced_at ]['account_ids'][] = (string) $entry['account_id'];
				continue;
			}
			if ( ! empty( $entry['synced'] ) ) {
				$synced_at = count( $groups );
			}
			$groups[] = array(
				'group_ids'   => isset( $group_ids[ count( $groups ) ] ) ? array( $group_ids[ count( $groups ) ] ) : array(),
				'account_ids' => array( (string) $entry['account_id'] ),
				'synced'      => ! empty( $entry['synced'] ),
				'text'        => (string) $entry['text'],
			);
		}

		if ( count( $groups ) === count( $group_ids ) ) {
			return $groups;
		}
		$first = $entries[0] ?? array( 'text' => '' );
		return array(
			array(
				'group_ids'   => $group_ids,
				'account_ids' => array_values( array_map( 'strval', array_column( $entries, 'account_id' ) ) ),
				'synced'      => true,
				'text'        => (string) $first['text'],
			),
		);
	}
}
