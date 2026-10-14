<?php
/**
 * @package Orbitwrite
 */

use Orbitwrite\WordPress\Post_Builder;
use PHPUnit\Framework\TestCase;

final class PostBuilderTest extends TestCase {

	private function uuid(): callable {
		$n = 0;
		return static function () use ( &$n ) {
			return 'uuid-' . ( ++$n );
		};
	}

	private function entries(): array {
		return array(
			array(
				'account_id' => 'acc_x',
				'synced'     => true,
				'text'       => 'Main post https://example.com/hello',
				'media_id'   => 'med_1',
			),
			array(
				'account_id' => 'acc_bsky',
				'synced'     => false,
				'text'       => 'Bluesky words',
				'media_id'   => null,
			),
			array(
				'account_id' => 'acc_li',
				'synced'     => true,
				'text'       => 'Main post https://example.com/hello',
				'media_id'   => 'med_1',
			),
		);
	}

	public function test_synced_channels_share_the_main_post_and_own_versions_are_unsynced(): void {
		$body = Post_Builder::build(
			$this->entries(),
			array(
				'scheduled_at' => '2026-10-15T08:00:00Z',
				'publish_now'  => false,
			),
			'Hello world',
			$this->uuid()
		);

		$this->assertSame( '2026-10-15T08:00:00Z', $body['scheduledAt'] );
		$this->assertSame( array( 'title' => 'Hello world' ), $body['info'] );
		$this->assertArrayNotHasKey( 'publishNow', $body );
		$this->assertSame(
			array(
				'accountId' => 'acc_x',
				'isSynced'  => true,
				'items'     => array(
					array(
						'id'       => 'uuid-1',
						'content'  => 'Main post https://example.com/hello',
						'mediaIds' => array( 'med_1' ),
					),
				),
			),
			$body['accounts'][0]
		);
		$this->assertSame(
			array(
				'accountId' => 'acc_bsky',
				'isSynced'  => false,
				'items'     => array(
					array(
						'id'      => 'uuid-2',
						'content' => 'Bluesky words',
					),
				),
			),
			$body['accounts'][1]
		);
		$this->assertTrue( $body['accounts'][2]['isSynced'] );
	}

	public function test_publish_now_and_long_titles(): void {
		$body = Post_Builder::build(
			array_slice( $this->entries(), 0, 1 ),
			array(
				'scheduled_at' => '2026-10-13T12:00:00Z',
				'publish_now'  => true,
			),
			str_repeat( 'é', 250 ),
			$this->uuid()
		);
		$this->assertTrue( $body['publishNow'] );
		$this->assertSame( 200, mb_strlen( $body['info']['title'] ) );
	}

	public function test_groups_follow_the_order_orbitwrite_creates_them_in(): void {
		// Synced channels share the first synced slot; each own version is
		// the next one, in the order sent.
		$this->assertSame(
			array(
				array(
					'group_ids'   => array( 'grp_a' ),
					'account_ids' => array( 'acc_x', 'acc_li' ),
					'synced'      => true,
					'text'        => 'Main post https://example.com/hello',
				),
				array(
					'group_ids'   => array( 'grp_b' ),
					'account_ids' => array( 'acc_bsky' ),
					'synced'      => false,
					'text'        => 'Bluesky words',
				),
			),
			Post_Builder::groups_for( $this->entries(), array( 'grp_a', 'grp_b' ) )
		);
	}

	public function test_an_own_version_first_still_gets_its_own_group(): void {
		$entries = array_reverse( $this->entries() );
		$entries = array( $entries[1], $entries[0], $entries[2] ); // bsky, li, x
		$groups  = Post_Builder::groups_for( $entries, array( 'grp_own', 'grp_synced' ) );
		$this->assertSame( array( 'acc_bsky' ), $groups[0]['account_ids'] );
		$this->assertSame( array( 'grp_own' ), $groups[0]['group_ids'] );
		$this->assertSame( array( 'acc_li', 'acc_x' ), $groups[1]['account_ids'] );
	}

	public function test_an_unexpected_count_is_one_group_holding_every_post(): void {
		$groups = Post_Builder::groups_for( $this->entries(), array( 'a', 'b', 'c' ) );
		$this->assertCount( 1, $groups );
		$this->assertSame( array( 'a', 'b', 'c' ), $groups[0]['group_ids'] );
		$this->assertSame( array( 'acc_x', 'acc_bsky', 'acc_li' ), $groups[0]['account_ids'] );
	}
}
