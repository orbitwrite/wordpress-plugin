<?php
/**
 * Plugin Name: Orbitwrite dev tunnel
 * Description: Tells WordPress it's being served over HTTPS when a tunnel says so. For local development only; mapped in by .wp-env.override.json, never shipped.
 *
 * @package Orbitwrite
 */

// A tunnel ends HTTPS and forwards plain HTTP, so without this WordPress
// thinks it's on HTTP while its address is HTTPS, and redirects in a loop.
if ( isset( $_SERVER['HTTP_X_FORWARDED_PROTO'] ) && 'https' === $_SERVER['HTTP_X_FORWARDED_PROTO'] ) {
	$_SERVER['HTTPS'] = 'on';
}
