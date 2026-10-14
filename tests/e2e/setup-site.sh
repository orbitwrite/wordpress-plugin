#!/usr/bin/env bash
# A throwaway WordPress for testing the plugin against the mock Orbitwrite,
# with no Docker or MySQL: SQLite and PHP's built-in server.
#
#   tests/e2e/setup-site.sh <dir> [site port] [mock port]
#   php -S 127.0.0.1:8080 -t <dir>/wordpress <dir>/router.php
#   node tests/e2e/mock-orbitwrite.mjs 4010
#
# Then sign in at http://127.0.0.1:8080/wp-admin as admin / password.
# Needs php (with pdo_sqlite and gd), curl and unzip. Run `npm run build` first.
# Writes the test article's id to <dir>/post-id.
set -euo pipefail

DIR="${1:?usage: setup-site.sh <dir> [site port] [mock port]}"
SITE_PORT="${2:-8080}"
MOCK_PORT="${3:-4010}"
PLUGIN_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
SITE_URL="http://127.0.0.1:${SITE_PORT}"

mkdir -p "$DIR"
cd "$DIR"

[ -f wp-cli.phar ] || curl -sSL -o wp-cli.phar https://raw.githubusercontent.com/wp-cli/builds/gh-pages/phar/wp-cli.phar
[ -f wordpress.tar.gz ] || curl -sSL -o wordpress.tar.gz https://wordpress.org/latest.tar.gz
[ -f sqlite.zip ] || curl -sSL -o sqlite.zip https://downloads.wordpress.org/plugin/sqlite-database-integration.latest-stable.zip
[ -f classic-editor.zip ] || curl -sSL -o classic-editor.zip https://downloads.wordpress.org/plugin/classic-editor.latest-stable.zip

rm -rf wordpress
tar -xzf wordpress.tar.gz
unzip -q sqlite.zip -d wordpress/wp-content/plugins
unzip -q classic-editor.zip -d wordpress/wp-content/plugins
sed -e "s#{SQLITE_IMPLEMENTATION_FOLDER_PATH}#${DIR}/wordpress/wp-content/plugins/sqlite-database-integration#" \
    -e "s#{SQLITE_PLUGIN}#sqlite-database-integration/load.php#" \
    wordpress/wp-content/plugins/sqlite-database-integration/db.copy > wordpress/wp-content/db.php
ln -s "$PLUGIN_DIR" wordpress/wp-content/plugins/orbitwrite

# Deprecation notices (wp-cli on PHP 8.5) would land in captured output.
WP="php -d error_reporting=E_ALL&~E_DEPRECATED wp-cli.phar --allow-root --path=wordpress"
$WP config create --dbname=wp --dbuser=wp --dbpass=wp --skip-check --extra-php <<PHP
define( 'ORBITWRITE_BASE_URL', 'http://127.0.0.1:${MOCK_PORT}' );
define( 'WP_HOME', '${SITE_URL}' );
define( 'WP_SITEURL', '${SITE_URL}' );
define( 'WP_DEBUG', true );
define( 'WP_DEBUG_LOG', true );
define( 'WP_DEBUG_DISPLAY', false );
PHP
$WP core install --url="$SITE_URL" --title="Example Blog" --admin_user=admin \
  --admin_password=password --admin_email=admin@example.com --skip-email
$WP rewrite structure '/%postname%/'
$WP plugin activate orbitwrite classic-editor
# Classic Editor, with the block editor kept as the default and people allowed
# to switch, so one site covers both: `&classic-editor` on an edit link opens
# the classic screen.
$WP option update classic-editor-replace block
$WP option update classic-editor-allow-users allow

# The mock lives on 127.0.0.1 over plain HTTP, which the plugin refuses to
# connect from (Orbitwrite couldn't fetch such a site). Lift that here only.
mkdir -p wordpress/wp-content/mu-plugins
cat > wordpress/wp-content/mu-plugins/orbitwrite-e2e.php <<'PHP'
<?php
add_filter( 'orbitwrite_connect_problems', '__return_empty_array' );
PHP

# An article with a featured image for the composer to pick up. Random
# pixels so the PNG stays big (about 4 MB): over Bluesky's 2 MB, so sending
# to Bluesky has to pick one of WordPress's smaller sizes.
php -r '$w = 1600; $h = 840; $im = imagecreatetruecolor( $w, $h ); mt_srand( 7 ); for ( $y = 0; $y < $h; $y++ ) { for ( $x = 0; $x < $w; $x++ ) { imagesetpixel( $im, $x, $y, mt_rand( 0, 0xFFFFFF ) ); } } imagepng( $im, "hero.png", 0 );'
POST_ID=$($WP post create --post_title="Hello from WordPress" --post_status=publish --porcelain)
$WP media import hero.png --post_id="$POST_ID" --featured_image --alt="A purple banner" --porcelain >/dev/null
echo "$POST_ID" > post-id

cat > router.php <<'PHP'
<?php
// Pretty permalinks for PHP's built-in server.
$path = parse_url( $_SERVER['REQUEST_URI'], PHP_URL_PATH );
if ( $path !== '/' && file_exists( __DIR__ . '/wordpress' . $path ) && ! is_dir( __DIR__ . '/wordpress' . $path ) ) {
	return false;
}
if ( is_dir( __DIR__ . '/wordpress' . $path ) && file_exists( __DIR__ . '/wordpress' . rtrim( $path, '/' ) . '/index.php' ) ) {
	$_SERVER['SCRIPT_NAME'] = rtrim( $path, '/' ) . '/index.php';
	require __DIR__ . '/wordpress' . rtrim( $path, '/' ) . '/index.php';
	return;
}
$_SERVER['SCRIPT_NAME'] = '/index.php';
require __DIR__ . '/wordpress/index.php';
PHP

echo "Ready: php -S 127.0.0.1:${SITE_PORT} -t ${DIR}/wordpress ${DIR}/router.php"
