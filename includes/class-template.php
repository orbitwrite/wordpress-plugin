<?php
/**
 * The text auto-share writes for an article.
 *
 * @package Orbitwrite
 */

namespace Orbitwrite\WordPress;

defined( 'ABSPATH' ) || exit;

/**
 * A template like `{title}\n\n{url}`, filled in from an article. Pure.
 *
 * Only the tags in TAGS exist. A template naming any other is refused when
 * it's saved, rather than sent with `{whatever}` left in it, because a post
 * that goes out on its own has nobody looking at it first.
 */
final class Template {

	/** The default: what the composer starts an article's post with. */
	const DEFAULT = "{title}\n\n{url}";

	/** The longest template accepted. */
	const MAX_LENGTH = 5000;

	/** The tags a template may use. */
	const TAGS = array( 'title', 'url', 'excerpt', 'author', 'hashtags' );

	/**
	 * Fill a template in.
	 *
	 * Lines a tag left empty (an article with no excerpt, say) are dropped,
	 * and runs of blank lines folded into one, so a missing excerpt doesn't
	 * leave a hole in the post.
	 *
	 * @param string $template Template.
	 * @param array  $values   Tag => value, for the tags in TAGS.
	 */
	public static function render( string $template, array $values ): string {
		$lines = array();
		foreach ( preg_split( '/\r\n|\r|\n/', $template ) as $line ) {
			$filled   = preg_replace_callback(
				'/\{([a-z_]+)\}/',
				static function ( $found ) use ( $values ) {
					return in_array( $found[1], self::TAGS, true ) ? trim( (string) ( $values[ $found[1] ] ?? '' ) ) : $found[0];
				},
				$line
			);
			$had_tags = (bool) preg_match( '/\{[a-z_]+\}/', $line );
			if ( $had_tags && '' === trim( $filled ) ) {
				continue;
			}
			$lines[] = rtrim( $filled );
		}
		$text = implode( "\n", $lines );
		return trim( (string) preg_replace( "/\n{3,}/", "\n\n", $text ) );
	}

	/**
	 * Tags the template names that don't exist.
	 *
	 * @param string $template Template.
	 * @return string[] Unknown tag names, as written.
	 */
	public static function unknown_tags( string $template ): array {
		preg_match_all( '/\{([^{}\s]+)\}/', $template, $matches );
		return array_values( array_unique( array_diff( $matches[1], self::TAGS ) ) );
	}

	/**
	 * Hashtags from tag names: `Social media` → `#SocialMedia`. Characters a
	 * hashtag can't carry are dropped; a name with nothing left is skipped.
	 *
	 * @param string[] $names Tag names.
	 */
	public static function hashtags( array $names ): string {
		$tags = array();
		foreach ( $names as $name ) {
			$words = preg_split( '/[^\p{L}\p{N}_]+/u', (string) $name, -1, PREG_SPLIT_NO_EMPTY );
			if ( ! $words ) {
				continue;
			}
			$tag = '';
			foreach ( $words as $word ) {
				$tag .= function_exists( 'mb_strtoupper' )
					? mb_strtoupper( mb_substr( $word, 0, 1 ) ) . mb_substr( $word, 1 )
					: ucfirst( $word );
			}
			$tags[ $tag ] = '#' . $tag;
		}
		return implode( ' ', $tags );
	}
}
