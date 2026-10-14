<?php
/**
 * Remove everything the plugin stored.
 *
 * Connections are deleted without being revoked: uninstall makes no network
 * calls. Each token lapses on its own, and the app can be removed from
 * Orbitwrite under Settings → MCP → Connected apps.
 *
 * @package Orbitwrite
 */

defined( 'WP_UNINSTALL_PLUGIN' ) || exit;

delete_metadata( 'user', 0, '_orbitwrite_connection', '', true );
delete_metadata( 'post', 0, '_orbitwrite_shares', '', true );
delete_metadata( 'post', 0, '_orbitwrite_media', '', true );
delete_metadata( 'user', 0, '_orbitwrite_auto_share', '', true );
delete_metadata( 'post', 0, '_orbitwrite_auto_share_off', '', true );
delete_metadata( 'post', 0, '_orbitwrite_auto_share_state', '', true );
delete_metadata( 'post', 0, '_orbitwrite_auto_share_error', '', true );
wp_unschedule_hook( 'orbitwrite_auto_share' );
wp_unschedule_hook( 'orbitwrite_refresh_numbers' );

global $wpdb;
// Transients whose names carry a user, workspace or server hash.
// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
$wpdb->query(
	"DELETE FROM {$wpdb->options}
	 WHERE option_name LIKE '\\_transient\\_orbitwrite\\_%'
	    OR option_name LIKE '\\_transient\\_timeout\\_orbitwrite\\_%'
	    OR option_name LIKE 'orbitwrite\\_refresh\\_lock\\_%'"
);
