<?php
/**
 * Bootstrap.
 *
 * @package Orbitwrite
 */

namespace Orbitwrite\WordPress;

defined( 'ABSPATH' ) || exit;

/**
 * Hooks everything up.
 */
final class Plugin {

	/**
	 * Register every hook. Called once from the main plugin file.
	 */
	public static function boot(): void {
		OAuth::register();
		Admin::register();
		Auto_Share::register();
		Analytics::register();
		add_action( 'rest_api_init', array( Rest::class, 'register' ) );
	}
}
