<?php
/**
 * @package Orbitwrite
 */

use Orbitwrite\WordPress\Draft;
use PHPUnit\Framework\TestCase;

final class DraftTest extends TestCase {

	private function draft( array $channels, string $main_text = 'Main post' ): Draft {
		return Draft::from_input(
			array(
				'text'         => $main_text,
				'attachmentId' => 7,
				'altText'      => 'Banner',
			),
			$channels
		);
	}

	public function test_synced_channels_send_the_main_post_and_drop_their_own_fields(): void {
		$draft = $this->draft(
			array(
				array(
					'accountId'    => 'acc_x',
					'synced'       => true,
					'text'         => 'stale version',
					'attachmentId' => 9,
				),
			)
		);
		$this->assertSame(
			array(
				'text'          => 'Main post',
				'attachment_id' => 7,
				'alt_text'      => 'Banner',
			),
			$draft->content_for( $draft->channels[0] )
		);
		$this->assertSame( '', $draft->channels[0]['text'] );
	}

	public function test_own_versions_send_their_own_content(): void {
		$draft = $this->draft(
			array(
				array(
					'accountId' => 'acc_bsky',
					'synced'    => false,
					'text'      => 'Bluesky words',
				),
			)
		);
		$this->assertSame(
			array(
				'text'          => 'Bluesky words',
				'attachment_id' => 0,
				'alt_text'      => '',
			),
			$draft->content_for( $draft->channels[0] )
		);
		$this->assertSame( array(), $draft->attachment_ids(), 'the main image is not sent by anyone' );
	}

	public function test_channels_are_unique_and_keep_their_order(): void {
		$draft = $this->draft(
			array(
				array( 'accountId' => 'b' ),
				array( 'accountId' => 'a' ),
				array( 'accountId' => 'b', 'synced' => false, 'text' => 'dupe' ),
				array( 'accountId' => '' ),
			)
		);
		$this->assertSame( array( 'b', 'a' ), $draft->account_ids() );
		$this->assertTrue( $draft->channels[0]['synced'], 'synced is the default' );
	}

	public function test_problems(): void {
		$own = array(
			'accountId' => 'b',
			'synced'    => false,
			'text'      => 'Own words',
		);
		$this->assertNotNull( $this->draft( array() )->problem() );
		$this->assertNotNull( $this->draft( array( array( 'accountId' => 'a' ) ), " \n " )->problem(), 'a synced channel needs a main post' );
		$this->assertNull( $this->draft( array( $own ), '' )->problem(), 'no main post needed when every channel has its own' );
		$this->assertNotNull( $this->draft( array( array_merge( $own, array( 'text' => ' ' ) ) ) )->problem(), 'an own version needs text' );
		$this->assertNotNull( $this->draft( array_map( static function ( $i ) { return array( 'accountId' => "a$i" ); }, range( 1, 51 ) ) )->problem() );
		$this->assertNull( $this->draft( array( array( 'accountId' => 'a' ), $own ) )->problem() );
	}
}
