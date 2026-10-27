#!/usr/bin/env bash
# One command for the end-to-end test: build, a fresh test site, the mock
# Orbitwrite, the browser run, then tear down the servers.
#
#   npm run test:e2e            (CHROMIUM_PATH=/path/to/chrome to use your own)
#   npm run screenshots         the WordPress.org screenshots, the same way
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
PLUGIN_DIR="$(cd "$HERE/../.." && pwd)"
SITE_DIR="${E2E_SITE_DIR:-$PLUGIN_DIR/.e2e-site}"
SITE_PORT="${E2E_SITE_PORT:-8080}"
MOCK_PORT="${E2E_MOCK_PORT:-4010}"

cd "$PLUGIN_DIR"
npm run build --silent

"$HERE/setup-site.sh" "$SITE_DIR" "$SITE_PORT" "$MOCK_PORT"

PHP_CLI_SERVER_WORKERS=4 php -S "127.0.0.1:$SITE_PORT" -t "$SITE_DIR/wordpress" "$SITE_DIR/router.php" > "$SITE_DIR/php-server.log" 2>&1 &
SITE_PID=$!
node "$HERE/mock-orbitwrite.mjs" "$MOCK_PORT" > "$SITE_DIR/mock.log" 2>&1 &
MOCK_PID=$!
trap 'kill $SITE_PID $MOCK_PID 2>/dev/null || true' EXIT

for _ in $(seq 1 40); do
  if curl -s -o /dev/null "http://127.0.0.1:$SITE_PORT/" && curl -s -o /dev/null "http://127.0.0.1:$MOCK_PORT/__log"; then
    break
  fi
  sleep 0.25
done

SITE_URL="http://127.0.0.1:$SITE_PORT" MOCK_URL="http://127.0.0.1:$MOCK_PORT" SITE_DIR="$SITE_DIR" \
  POST_ID="$(cat "$SITE_DIR/post-id")" node "$HERE/${1:-browser.mjs}"
