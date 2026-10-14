<?php
/**
 * @package Orbitwrite
 */

use Orbitwrite\WordPress\Template;
use PHPUnit\Framework\TestCase;

final class TemplateTest extends TestCase {

	private function values(): array {
		return array(
			'title'    => 'Hello world',
			'url'      => 'https://example.com/hello-world/',
			'excerpt'  => 'A short summary.',
			'author'   => 'Sam',
			'hashtags' => '#News #SocialMedia',
		);
	}

	public function test_the_default_is_the_title_then_the_link(): void {
		$this->assertSame(
			"Hello world\n\nhttps://example.com/hello-world/",
			Template::render( Template::DEFAULT, $this->values() )
		);
	}

	public function test_every_tag_is_filled_in(): void {
		$this->assertSame(
			"Hello world by Sam\nA short summary.\nhttps://example.com/hello-world/ #News #SocialMedia",
			Template::render( "{title} by {author}\n{excerpt}\n{url} {hashtags}", $this->values() )
		);
	}

	public function test_a_line_left_empty_by_its_tags_is_dropped_and_blank_lines_fold(): void {
		$values            = $this->values();
		$values['excerpt'] = '';
		$this->assertSame(
			"Hello world\n\nhttps://example.com/hello-world/",
			Template::render( "{title}\n\n{excerpt}\n\n{url}", $values )
		);
	}

	public function test_a_line_with_its_own_words_stays_when_a_tag_is_empty(): void {
		$values             = $this->values();
		$values['hashtags'] = '';
		$this->assertSame( 'Tagged:', Template::render( 'Tagged: {hashtags}', $values ) );
	}

	public function test_unknown_tags_are_named(): void {
		$this->assertSame( array( 'link', 'Title' ), Template::unknown_tags( '{link} {Title} {title} {url}' ) );
		$this->assertSame( array(), Template::unknown_tags( Template::DEFAULT ) );
		$this->assertSame( array(), Template::unknown_tags( 'Braces { like this } are just text' ) );
	}

	public function test_hashtags_join_words_and_drop_what_a_hashtag_cant_carry(): void {
		$this->assertSame( '#SocialMedia #Café #WordPress #2026', Template::hashtags( array( 'social media', 'café', 'WordPress', '2026', '—' ) ) );
		$this->assertSame( '#News', Template::hashtags( array( 'News', 'news' ) ) );
		$this->assertSame( '', Template::hashtags( array() ) );
	}
}
