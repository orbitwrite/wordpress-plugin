<?php
/**
 * @package Orbitwrite
 */

use Orbitwrite\WordPress\Aspect;
use Orbitwrite\WordPress\Media;
use PHPUnit\Framework\TestCase;

final class MediaTest extends TestCase {

	private function candidates(): array {
		return array(
			array( 'path' => 'small.jpg', 'size' => 9000, 'width' => 300, 'height' => 158, 'mime' => 'image/jpeg' ),
			array( 'path' => 'full.jpg', 'size' => 2400000, 'width' => 2400, 'height' => 1260, 'mime' => 'image/jpeg' ),
			array( 'path' => 'large.jpg', 'size' => 310000, 'width' => 1024, 'height' => 538, 'mime' => 'image/jpeg' ),
			array( 'path' => 'medium_large.jpg', 'size' => 120000, 'width' => 768, 'height' => 403, 'mime' => 'image/jpeg' ),
		);
	}

	public function test_picks_only_accepted_types(): void {
		$candidates   = $this->candidates();
		$candidates[] = array( 'path' => 'full.webp', 'size' => 200000, 'width' => 2400, 'height' => 1260, 'mime' => 'image/webp' );
		$this->assertSame( 'full.webp', Media::pick( $candidates, 1000000 )['path'], 'any type: the largest that fits' );
		$this->assertSame( 'large.jpg', Media::pick( $candidates, 1000000, array( 'image/jpeg', 'image/png' ) )['path'] );
		$this->assertNull( Media::pick( $candidates, 1000000, array( 'image/gif' ) ) );
	}

	public function test_only_same_shaped_sizes_count(): void {
		$this->assertTrue( Media::same_shape( 1600, 840, 1024, 538 ), 'rounded the way WordPress rounds' );
		$this->assertFalse( Media::same_shape( 1600, 840, 150, 150 ), 'a cropped thumbnail' );
		$this->assertFalse( Media::same_shape( 1600, 840, 0, 0 ) );
	}

	public function test_the_upload_cache_keeps_the_newest(): void {
		$cache = array();
		for ( $i = 1; $i <= 14; $i++ ) {
			$cache[ "k$i" ] = array( 'id' => "med_$i", 'at' => 1000 + $i );
		}
		$kept = Media::prune( $cache );
		$this->assertCount( Media::CACHE_SIZE, $kept );
		$this->assertArrayHasKey( 'k14', $kept );
		$this->assertArrayNotHasKey( 'k1', $kept );
	}

	public function test_picks_the_largest_file_under_the_limit(): void {
		$this->assertSame( 'full.jpg', Media::pick( $this->candidates(), 8000000 )['path'] );
		// A tighter limit than the original's size.
		$this->assertSame( 'large.jpg', Media::pick( $this->candidates(), 1000000 )['path'] );
		$this->assertSame( 'medium_large.jpg', Media::pick( $this->candidates(), 200000 )['path'] );
		$this->assertNull( Media::pick( $this->candidates(), 1000 ) );
	}

	public function test_upload_request(): void {
		$file = array(
			'name'   => 'hero.png',
			'mime'   => 'image/png',
			'size'   => 3653,
			'width'  => 1200,
			'height' => 630,
		);
		$this->assertSame(
			array(
				'name'       => 'hero.png',
				'mime_type'  => 'image/png',
				'size_bytes' => 3653,
				'alt_text'   => 'A purple banner',
				'width'      => 1200,
				'height'     => 630,
			),
			Media::upload_request( $file, 'A purple banner' )
		);
		$bare = Media::upload_request( array_merge( $file, array( 'width' => 0 ) ), '  ' );
		$this->assertArrayNotHasKey( 'alt_text', $bare );
		$this->assertArrayNotHasKey( 'width', $bare );
	}

	public function test_aspect_ratio_labels_and_problems(): void {
		$this->assertSame( '4:5', Aspect::label( 0.8 ) );
		$this->assertSame( '1.91:1', Aspect::label( 1.91 ) );
		$this->assertSame( '9:16', Aspect::label( 9 / 16 ) );
		$this->assertSame( '1:1', Aspect::label( 1.0 ) );

		$instagram = array( 'min' => 0.8, 'max' => 1.91 );
		$this->assertNull( Aspect::problem( 1080, 1350, $instagram ), '4:5 is the narrowest allowed' );
		$this->assertNull( Aspect::problem( 1200, 630, $instagram ), '1.9:1 fits' );
		$this->assertStringContainsString( '9:16', (string) Aspect::problem( 1080, 1920, $instagram ) );
		$this->assertStringContainsString( 'wider', (string) Aspect::problem( 3000, 1000, $instagram ) );
		$this->assertNull( Aspect::problem( 0, 0, $instagram ), 'unknown dimensions are not judged' );
	}
}
