<?php
/**
 * Plugin Name:       Orbitwrite
 * Description:       Write a social post in WordPress and publish or schedule it with Orbitwrite.
 * Version:           0.1.0
 * Requires at least: 6.6
 * Requires PHP:      7.4
 * Author:            Orbitwrite
 * Author URI:        https://orbitwrite.com
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       orbitwrite
 *
 * @package Orbitwrite
 */

defined( 'ABSPATH' ) || exit;

define( 'ORBITWRITE_PLUGIN_VERSION', '0.1.0' );
define( 'ORBITWRITE_PLUGIN_FILE', __FILE__ );
define( 'ORBITWRITE_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );

require ORBITWRITE_PLUGIN_DIR . 'includes/autoload.php';

Orbitwrite\WordPress\Plugin::boot();
