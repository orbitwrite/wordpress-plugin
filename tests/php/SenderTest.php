<?php
/**
 * @package Orbitwrite
 */

use Orbitwrite\WordPress\Draft;
use Orbitwrite\WordPress\Sender;
use Orbitwrite\WordPress\Workspace;
use PHPUnit\Framework\TestCase;

final class SenderTest extends TestCase {

	private function channel( string $id, string $network, array $media ): array {
		return array(
			'id'           => $id,
			'platformName' => $network,
			'displayName'  => 'Acme',
			'media'        => Workspace::media_rules( $media ),
		);
	}

	private function channels(): array {
		return array_column(
			array(
				$this->channel( 'x', 'X', array( 'maxItems' => 4, 'image' => array( 'maxBytes' => 5000000 ) ) ),
				$this->channel( 'bsky', 'Bluesky', array( 'maxItems' => 4, 'image' => array( 'maxBytes' => 2000000 ) ) ),
				$this->channel( 'ig', 'Instagram', array( 'maxItems' => 10, 'required' => true, 'image' => array( 'maxBytes' => 8000000 ), 'aspectRatio' => array( 'min' => 0.8, 'max' => 1.91, 'preferred' => 1 ) ) ),
				$this->channel( 'tiktok', 'TikTok', array( 'maxItems' => 1, 'required' => true, 'image' => null ) ),
				$this->channel( 'text', 'Textonly', array( 'maxItems' => 0, 'image' => null ) ),
			),
			null,
			'id'
		);
	}

	private function draft( array $channels, int $image = 7 ): Draft {
		return Draft::from_input(
			array(
				'text'         => 'Main',
				'attachmentId' => $image,
			),
			$channels
		);
	}

	protected function setUp(): void {
		$GLOBALS['test_attachment_meta'] = array(
			7 => array( 'width' => 1200, 'height' => 630 ),
			8 => array( 'width' => 1080, 'height' => 1920 ),
		);
	}

	public function test_the_main_image_is_sized_for_the_strictest_synced_network(): void {
		$groups = Sender::content_groups(
			$this->draft(
				array(
					array( 'accountId' => 'x' ),
					array( 'accountId' => 'bsky' ),
					array( 'accountId' => 'ig', 'synced' => false, 'text' => 'Insta', 'attachmentId' => 7 ),
				)
			),
			$this->channels()
		);
		$this->assertSame( array( 'main', 'own:2' ), array_keys( $groups ) );
		$this->assertSame( 2000000, $groups['main']['limits']['max_bytes'] );
		$this->assertSame( 'Bluesky', $groups['main']['limits']['set_by'] );
		$this->assertSame( 8000000, $groups['own:2']['limits']['max_bytes'], 'an own version is sized for its own network' );
	}

	public function test_a_gif_uses_the_networks_gif_cap(): void {
		$GLOBALS['test_attachment_mime'] = array( 9 => 'image/gif' );
		$channels                        = array(
			'x' => $this->channel( 'x', 'X', array( 'image' => array( 'maxBytes' => 5000000, 'maxGifBytes' => 15000000 ) ) ),
		);
		$groups                          = Sender::content_groups( $this->draft( array( array( 'accountId' => 'x' ) ), 9 ), $channels );
		$this->assertSame( 15000000, $groups['main']['limits']['max_bytes'] );
		$GLOBALS['test_attachment_mime'] = array();
	}

	public function test_image_types_are_those_every_network_takes(): void {
		$channels = array(
			'a' => $this->channel( 'a', 'A', array( 'mimeTypes' => array( 'image/jpeg', 'image/png', 'image/webp', 'video/mp4' ) ) ),
			'b' => $this->channel( 'b', 'B', array( 'mimeTypes' => array( 'image/jpeg', 'image/png', 'video/mp4' ) ) ),
			'c' => $this->channel( 'c', 'C', array() ),
		);
		$groups   = Sender::content_groups( $this->draft( array( array( 'accountId' => 'a' ), array( 'accountId' => 'b' ), array( 'accountId' => 'c' ) ) ), $channels );
		$this->assertSame( array( 'image/jpeg', 'image/png' ), $groups['main']['limits']['types'] );
		$this->assertSame( 'A, B', $groups['main']['limits']['types_by'], 'blame the networks that restrict types, not the one with the strictest size' );
		$alone = Sender::content_groups( $this->draft( array( array( 'accountId' => 'c' ) ) ), $channels );
		$this->assertNull( $alone['main']['limits']['types'], 'a network that does not say takes any type' );
		$empty = Sender::content_groups(
			$this->draft( array( array( 'accountId' => 'e' ) ) ),
			array( 'e' => $this->channel( 'e', 'E', array( 'mimeTypes' => array() ) ) )
		);
		$this->assertNull( $empty['main']['limits']['types'], 'an empty list restricts nothing' );
	}

	public function test_entries_send_each_channel_its_content_and_upload(): void {
		$draft   = $this->draft(
			array(
				array( 'accountId' => 'x' ),
				array( 'accountId' => 'bsky', 'synced' => false, 'text' => 'Own', 'attachmentId' => 0 ),
			)
		);
		$entries = Sender::entries( $draft, Sender::content_groups( $draft, array() ), array( 'main' => 'med_1' ) );
		$this->assertSame(
			array(
				array( 'account_id' => 'x', 'synced' => true, 'text' => 'Main', 'media_id' => 'med_1' ),
				array( 'account_id' => 'bsky', 'synced' => false, 'text' => 'Own', 'media_id' => null ),
			),
			$entries
		);
	}

	public function test_media_rules(): void {
		$channels = $this->channels();
		$this->assertNull( Sender::media_problem( $this->draft( array( array( 'accountId' => 'x' ), array( 'accountId' => 'ig' ) ) ), $channels ) );
		$this->assertSame( 'Acme on Instagram needs an image.', Sender::media_problem( $this->draft( array( array( 'accountId' => 'ig' ) ), 0 ), $channels ) );
		$this->assertStringContainsString( 'only takes video', (string) Sender::media_problem( $this->draft( array( array( 'accountId' => 'tiktok' ) ) ), $channels ) );
		$this->assertStringContainsString( 'doesn\'t take images', (string) Sender::media_problem( $this->draft( array( array( 'accountId' => 'text' ) ) ), $channels ) );
		$this->assertNull(
			Sender::media_problem( $this->draft( array( array( 'accountId' => 'text', 'synced' => false, 'text' => 'Words only' ) ) ), $channels ),
			'an own version without the image is fine'
		);
		$this->assertStringContainsString( '9:16', (string) Sender::media_problem( $this->draft( array( array( 'accountId' => 'ig' ) ), 8 ), $channels ) );
		$this->assertNull( Sender::media_problem( $this->draft( array( array( 'accountId' => 'unknown' ) ), 0 ), $channels ), 'unknown channels are left to Orbitwrite' );
	}
}
