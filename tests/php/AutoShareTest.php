<?php
/**
 * @package Orbitwrite
 */

use Orbitwrite\WordPress\Auto_Share;
use PHPUnit\Framework\TestCase;

final class AutoShareTest extends TestCase {

	private function input( array $changes = array() ): array {
		return array_merge(
			array(
				'enabled'    => true,
				'accountIds' => array( 'acc_x', 'acc_bsky', 'acc_x' ),
				'template'   => "{title}\r\n\r\n{url}",
				'image'      => true,
				'when'       => 'next',
				'postTypes'  => array( 'post' ),
			),
			$changes
		);
	}

	private function settings( array $changes = array() ): array {
		return array_merge(
			Auto_Share::defaults(),
			array(
				'enabled'         => true,
				'organization_id' => 'org_1',
				'account_ids'     => array( 'acc_x' ),
			),
			$changes
		);
	}

	public function test_valid_settings_are_normalised(): void {
		$settings = Auto_Share::validate( $this->input(), array( 'post', 'page' ) );
		$this->assertSame( array( 'acc_x', 'acc_bsky' ), $settings['account_ids'] );
		$this->assertSame( "{title}\n\n{url}", $settings['template'] );
		$this->assertTrue( $settings['enabled'] );
	}

	public function test_an_unknown_tag_is_refused_naming_it(): void {
		$error = Auto_Share::validate( $this->input( array( 'template' => '{title} {link}' ) ), array( 'post' ) );
		$this->assertInstanceOf( WP_Error::class, $error );
		$this->assertStringContainsString( '{link}', $error->get_error_message() );
	}

	public function test_turning_it_on_needs_channels_text_and_a_type(): void {
		$this->assertInstanceOf( WP_Error::class, Auto_Share::validate( $this->input( array( 'accountIds' => array() ) ), array( 'post' ) ) );
		$this->assertInstanceOf( WP_Error::class, Auto_Share::validate( $this->input( array( 'template' => '  ' ) ), array( 'post' ) ) );
		$this->assertInstanceOf( WP_Error::class, Auto_Share::validate( $this->input( array( 'postTypes' => array() ) ), array( 'post' ) ) );
	}

	public function test_turned_off_it_saves_whatever_is_half_done(): void {
		$settings = Auto_Share::validate( $this->input( array( 'enabled' => false, 'accountIds' => array() ) ), array( 'post' ) );
		$this->assertFalse( $settings['enabled'] );
	}

	public function test_a_post_type_that_cant_be_shared_or_a_bad_time_is_refused(): void {
		$this->assertInstanceOf( WP_Error::class, Auto_Share::validate( $this->input( array( 'postTypes' => array( 'attachment' ) ) ), array( 'post' ) ) );
		$this->assertInstanceOf( WP_Error::class, Auto_Share::validate( $this->input( array( 'when' => 'at' ) ), array( 'post' ) ) );
	}

	public function test_an_article_is_queued_once_when_everything_lines_up(): void {
		$this->assertTrue( Auto_Share::should_queue( $this->settings(), 'org_1', 'post', false, false, '' ) );
	}

	public function test_an_article_is_not_queued_when_anything_says_no(): void {
		$this->assertFalse( Auto_Share::should_queue( $this->settings( array( 'enabled' => false ) ), 'org_1', 'post', false, false, '' ), 'turned off' );
		$this->assertFalse( Auto_Share::should_queue( $this->settings(), '', 'post', false, false, '' ), 'not connected' );
		$this->assertFalse( Auto_Share::should_queue( $this->settings(), 'org_2', 'post', false, false, '' ), 'saved for another workspace' );
		$this->assertFalse( Auto_Share::should_queue( $this->settings(), 'org_1', 'page', false, false, '' ), 'another post type' );
		$this->assertFalse( Auto_Share::should_queue( $this->settings(), 'org_1', 'post', true, false, '' ), 'opted out' );
		$this->assertFalse( Auto_Share::should_queue( $this->settings(), 'org_1', 'post', false, true, '' ), 'already shared by hand' );
		$this->assertFalse( Auto_Share::should_queue( $this->settings(), 'org_1', 'post', false, false, 'sent' ), 'already auto-shared' );
		$this->assertFalse( Auto_Share::should_queue( $this->settings( array( 'account_ids' => array() ) ), 'org_1', 'post', false, false, '' ), 'no channels' );
	}
}
