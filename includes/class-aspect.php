<?php
/**
 * Image shape against a network's accepted range.
 *
 * @package Orbitwrite
 */

namespace Orbitwrite\WordPress;

defined( 'ABSPATH' ) || exit;

/**
 * Width ÷ height checks, in the words people use for them ("4:5"). Pure, and
 * the same rule the composer applies in src/shared/rules.js.
 */
final class Aspect {

	/** Slack for rounding in stored dimensions. */
	const TOLERANCE = 0.01;

	/**
	 * What's wrong with an image's shape, or null when it fits (or isn't
	 * known).
	 *
	 * @param int   $width  Width in pixels.
	 * @param int   $height Height in pixels.
	 * @param array $range  `{ min, max }`, either null.
	 */
	public static function problem( int $width, int $height, array $range ): ?string {
		if ( $width <= 0 || $height <= 0 ) {
			return null;
		}
		$ratio = $width / $height;
		$min   = $range['min'] ?? null;
		$max   = $range['max'] ?? null;
		if ( null !== $min && $ratio < $min - self::TOLERANCE ) {
			/* translators: 1: narrowest accepted shape, 2: this image's shape. */
			return sprintf( __( 'images can be no narrower than %1$s, and this one is %2$s.', 'orbitwrite' ), self::label( $min ), self::label( $ratio ) );
		}
		if ( null !== $max && $ratio > $max + self::TOLERANCE ) {
			/* translators: 1: widest accepted shape, 2: this image's shape. */
			return sprintf( __( 'images can be no wider than %1$s, and this one is %2$s.', 'orbitwrite' ), self::label( $max ), self::label( $ratio ) );
		}
		return null;
	}

	/**
	 * A ratio as people write it: 0.8 → "4:5", 1.91 → "1.91:1".
	 *
	 * @param float $ratio Width ÷ height.
	 */
	public static function label( float $ratio ): string {
		foreach ( array( 1, 2, 3, 4, 5, 9, 16 ) as $height ) {
			$width = $ratio * $height;
			if ( abs( $width - round( $width ) ) < 0.02 && round( $width ) <= 21 ) {
				return (int) round( $width ) . ':' . $height;
			}
		}
		return rtrim( rtrim( number_format( $ratio, 2, '.', '' ), '0' ), '.' ) . ':1';
	}
}
