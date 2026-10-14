<?php
/**
 * Loads `Orbitwrite\WordPress\Foo_Bar` from includes/class-foo-bar.php.
 *
 * @package Orbitwrite
 */

defined( 'ABSPATH' ) || exit;

spl_autoload_register(
	static function ( string $class_name ): void {
		$prefix = 'Orbitwrite\\WordPress\\';
		if ( 0 !== strpos( $class_name, $prefix ) ) {
			return;
		}
		$name = strtolower( str_replace( '_', '-', substr( $class_name, strlen( $prefix ) ) ) );
		$file = __DIR__ . '/class-' . $name . '.php';
		if ( is_readable( $file ) ) {
			require $file;
		}
	}
);
