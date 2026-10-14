<?php
/**
 * @package Orbitwrite
 */

use Orbitwrite\WordPress\Shares;
use PHPUnit\Framework\TestCase;

final class SharesTest extends TestCase {

	private function record(): array {
		return array(
			'group_ids'    => array( 'grp_1' ),
			'account_ids'  => array( 'acc_1', 'acc_2' ),
			'scheduled_at' => '2026-10-15T08:00:00Z',
			'status'       => 'scheduled',
			'bucket'       => null,
			'last_error'   => null,
			'links'        => array(),
		);
	}

	public function test_a_post_missing_from_the_listing_was_deleted(): void {
		$this->assertSame( 'deleted', Shares::apply( $this->record(), array() )['status'] );
	}

	public function test_status_bucket_error_and_links_come_from_the_listing(): void {
		$record = Shares::apply(
			$this->record(),
			array(
				'grp_1' => array(
					'id'          => 'grp_1',
					'status'      => 'published',
					'bucket'      => 'posted',
					'lastError'   => null,
					'scheduledAt' => '2026-10-15T08:00:00.000Z',
					'accounts'    => array(
						array(
							'platform'    => 'bluesky',
							'handle'      => 'me.bsky.social',
							'platformUrl' => 'https://bsky.app/profile/me/post/1',
						),
						array(
							'platform'    => 'twitter',
							'handle'      => 'me',
							'platformUrl' => null,
						),
					),
				),
			)
		);
		$this->assertSame( 'published', $record['status'] );
		$this->assertSame( 'posted', $record['bucket'] );
		$this->assertSame(
			array(
				array(
					'platform' => 'bluesky',
					'handle'   => 'me.bsky.social',
					'url'      => 'https://bsky.app/profile/me/post/1',
				),
			),
			$record['links']
		);
	}

	public function test_the_listing_corrects_which_channels_a_post_carries(): void {
		$record = Shares::apply(
			$this->record(),
			array(
				'grp_1' => array(
					'id'       => 'grp_1',
					'status'   => 'scheduled',
					'accounts' => array( array( 'id' => 'acc_2', 'platform' => 'bluesky' ) ),
				),
			)
		);
		$this->assertSame( array( 'acc_2' ), $record['account_ids'] );
	}

	public function test_one_record_per_post_a_send_made(): void {
		$records = Shares::records_for(
			array(
				'ok'          => true,
				'groupIds'    => array( 'grp_a', 'grp_b' ),
				'scheduledAt' => '2026-10-15T08:00:00Z',
			),
			array(
				array( 'account_id' => 'acc_x', 'synced' => true, 'text' => 'Main', 'media_id' => null ),
				array( 'account_id' => 'acc_bsky', 'synced' => false, 'text' => 'Own', 'media_id' => null ),
			),
			array( 'scheduled_at' => '2026-10-15T08:00:00Z', 'publish_now' => false ),
			3
		);
		$this->assertCount( 2, $records );
		$this->assertSame( array( 'grp_a' ), $records[0]['group_ids'] );
		$this->assertFalse( $records[0]['own_version'] );
		$this->assertSame( 'Main', $records[0]['excerpt'] );
		$this->assertSame( array( 'grp_b' ), $records[1]['group_ids'] );
		$this->assertSame( array( 'acc_bsky' ), $records[1]['account_ids'] );
		$this->assertTrue( $records[1]['own_version'] );
		$this->assertTrue( Shares::present( $records[1], null )['ownVersion'] );
	}

	public function test_unexpected_grouping_falls_back_to_one_record(): void {
		$records = Shares::records_for(
			array( 'groupIds' => array( 'grp_a', 'grp_b', 'grp_c' ), 'publishing' => true ),
			array( array( 'account_id' => 'acc_x', 'synced' => true, 'text' => 'Main', 'media_id' => null ) ),
			array( 'scheduled_at' => '2026-10-15T08:00:00Z', 'publish_now' => true ),
			3
		);
		$this->assertCount( 1, $records );
		$this->assertSame( array( 'grp_a', 'grp_b', 'grp_c' ), $records[0]['group_ids'] );
		$this->assertSame( 'publishing', $records[0]['status'] );
	}

	public function test_published_and_publishing_posts_cannot_be_deleted(): void {
		foreach ( array( 'published', 'publishing' ) as $status ) {
			$this->assertFalse( Shares::present( array_merge( $this->record(), array( 'status' => $status ) ), null )['canDelete'] );
		}
		$this->assertTrue( Shares::present( $this->record(), null )['canDelete'] );
	}

	public function test_open_url_needs_the_workspace_slug(): void {
		$this->assertNull( Shares::open_url( 'grp_1', null ) );
		$this->assertSame(
			'https://orbitwrite.com/acme/schedule?open=grp_1',
			Shares::open_url( 'grp_1', array( 'slug' => 'acme' ) )
		);
	}

	public function test_the_posts_list_column_counts_by_state_and_adds_up_numbers(): void {
		$summary = Shares::column(
			array(
				array(
					'status'  => 'published',
					'numbers' => array(
						'impressions' => 1180,
						'clicks'      => 17,
					),
				),
				array(
					'status'  => 'published',
					'numbers' => array(
						'impressions' => null,
						'clicks'      => 3,
					),
				),
				array( 'status' => 'published' ),
				array( 'status' => 'scheduled' ),
				array(
					'status'     => 'draft',
					'last_error' => 'X refused it',
				),
				array(
					'status' => 'scheduled',
					'bucket' => 'needs_approval',
				),
				array( 'status' => 'deleted' ),
			)
		);
		$this->assertSame( 3, $summary['published'] );
		$this->assertSame( 1, $summary['scheduled'] );
		$this->assertSame( 1, $summary['failed'] );
		$this->assertSame( 1, $summary['waiting'] );
		$this->assertSame( 1180, $summary['impressions'] );
		$this->assertSame( 20, $summary['clicks'] );
	}

	public function test_the_column_has_no_numbers_until_something_reported_them(): void {
		$summary = Shares::column( array( array( 'status' => 'published' ) ) );
		$this->assertNull( $summary['impressions'] );
		$this->assertNull( $summary['clicks'] );
	}
}
