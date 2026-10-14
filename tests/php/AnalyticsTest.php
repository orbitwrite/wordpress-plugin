<?php
/**
 * @package Orbitwrite
 */

use Orbitwrite\WordPress\Analytics;
use PHPUnit\Framework\TestCase;

final class AnalyticsTest extends TestCase {

	private function entry( string $group_id, array $metrics ): array {
		return array(
			'groupId' => $group_id,
			'postIds' => array( $group_id . '_row' ),
			'value'   => 0,
			'metrics' => array_merge(
				array_fill_keys( array( 'engagements', 'impressions', 'reactions', 'comments', 'reposts', 'quotes', 'saves', 'clicks', 'profileClicks', 'videoViews' ), null ),
				$metrics
			),
		);
	}

	public function test_each_named_posts_numbers_are_orbitwrites_own_totals(): void {
		$numbers = Analytics::numbers_by_group(
			array(
				'entries' => array(
					$this->entry( 'grp_1', array( 'engagements' => 14, 'impressions' => 1200, 'reactions' => 12, 'comments' => 2, 'clicks' => 10 ) ),
					$this->entry( 'grp_2', array( 'engagements' => 3, 'reactions' => 0, 'reposts' => 3 ) ),
				),
			)
		);
		$this->assertSame( array( 'grp_1', 'grp_2' ), array_keys( $numbers ) );
		$this->assertSame(
			array(
				'impressions' => 1200,
				'reactions'   => 12,
				'comments'    => 2,
				'reposts'     => null,
				'clicks'      => 10,
			),
			$numbers['grp_1']
		);
		$this->assertTrue( Analytics::has_any( $numbers['grp_1'] ) );
	}

	public function test_a_metric_nothing_reported_stays_null_rather_than_zero(): void {
		$numbers = Analytics::numbers_by_group(
			array( 'entries' => array( $this->entry( 'grp_1', array( 'reactions' => 0, 'reposts' => 3 ) ) ) )
		);
		$this->assertNull( $numbers['grp_1']['impressions'] );
		$this->assertSame( 0, $numbers['grp_1']['reactions'] );
		$this->assertSame( 3, $numbers['grp_1']['reposts'] );
	}

	public function test_a_post_left_out_of_the_page_has_no_numbers(): void {
		$numbers = Analytics::numbers_by_group(
			array(
				'entries' => array(
					'not an entry',
					array( 'groupId' => null, 'metrics' => array( 'reactions' => 5 ) ),
				),
			)
		);
		$this->assertSame( array(), $numbers );
		$this->assertFalse( Analytics::has_any( array_fill_keys( Analytics::POST_METRICS, null ) ) );
	}

	public function test_named_posts_are_asked_for_on_one_page(): void {
		$this->assertSame(
			array(
				'groupIds' => array( 'grp_1', 'grp_2' ),
				'metric'   => 'engagements',
				'limit'    => 2,
			),
			Analytics::numbers_query( array( 3 => 'grp_1', 7 => 'grp_2' ) )
		);
	}

	public function test_the_overview_keeps_nulls_and_the_comparison(): void {
		$overview = Analytics::present_overview(
			array(
				'from'        => '2026-09-16T00:00:00Z',
				'to'          => '2026-10-14T00:00:00Z',
				'historyDays' => null,
				'timezone'    => 'Europe/London',
				'previous'    => array(
					'from' => '2026-08-19T00:00:00Z',
					'to'   => '2026-09-16T00:00:00Z',
				),
				'posts'       => array(
					'current'  => 12,
					'previous' => 9,
				),
				'metrics'     => array(
					array(
						'metric'        => 'impressions',
						'label'         => 'Impressions',
						'value'         => null,
						'previous'      => null,
						'changePercent' => null,
					),
					array(
						'metric'        => 'clicks',
						'label'         => 'Link clicks',
						'value'         => 40,
						'previous'      => 32,
						'changePercent' => 25,
					),
				),
			)
		);
		$this->assertTrue( $overview['hasPrevious'] );
		$this->assertSame( 'Europe/London', $overview['timezone'] );
		$this->assertSame( 12, $overview['posts']['value'] );
		$this->assertNull( $overview['metrics']['impressions']['value'] );
		$this->assertSame( 25, $overview['metrics']['clicks']['changePercent'] );
	}

	public function test_queries_ask_for_four_weeks(): void {
		$this->assertSame( array( 'days' => 28 ), Analytics::overview_query() );
		$this->assertSame( 3, Analytics::top_posts_query()['limit'] );
	}
}
