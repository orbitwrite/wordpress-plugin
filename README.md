# Orbitwrite for WordPress

Write a social post inside WordPress and publish or schedule it to X,
LinkedIn, Bluesky, Mastodon, Threads, Instagram and more with
[Orbitwrite](https://orbitwrite.com).

- **One main post, or a version per channel.** Every channel uses the main
  post (text and image) until its *Same as main post* box is unticked, which
  gives it its own. Each channel shows its character count and anything its
  network won't take (needs an image, no images, wrong shape) as you type.
- **Images sized to fit.** An image goes at the largest of its WordPress
  sizes (same shape, an accepted type) that every network sending it
  takes, so a 4 MB featured image still reaches Bluesky's 2 MB limit. Give a
  channel its own version and its image is sized for that network alone.
- **Next free slot, a date and time, or now**, in the workspace's timezone.
- **Where you write**: a sidebar in the block editor, a box on the classic
  editor screen, and an *Orbitwrite* page for posts not tied to an article.
  In the block editor it also has a panel in the Post tab, a place in the
  pre-publish checks (auto-share) and in the panel after publishing, and
  confirms with the editor's snackbars. The unsent draft survives closing
  the sidebar or reloading.
- **What you've sent** from each article: status, links to the live posts,
  how each published post did (impressions, reactions, comments, reposts,
  link clicks), open in Orbitwrite, delete if it hasn't gone out.
- **The last four weeks** at the top of the *Orbitwrite* page: posts
  published, impressions, engagements and link clicks against the four weeks
  before, and the top posts.
- **In wp-admin**: a dashboard widget with the last four weeks, and a
  *Social* column and *Share* row action in the Posts list.
- **Auto-share**, per person: share each of your articles to chosen channels,
  from a text template (`{title}`, `{url}`, `{excerpt}`, `{author}`,
  `{hashtags}`), the first time it's published. Any article can opt out from
  its *Share on Orbitwrite* box.
- **Connect with OAuth**, per WordPress user. No API keys.


## Requirements

- WordPress 6.6+, PHP 7.4+.
- The site must be public, on HTTPS, with pretty permalinks: Orbitwrite
  fetches the site's OAuth client description to connect. The plugin says
  which is missing.
- An Orbitwrite account with at least one connected channel.

**No runtime dependencies.** The plugin ships as plain PHP plus a built
script; everything in `composer.json` and `package.json` is for development.

## Developing

Needs Node 20+ (`.nvmrc` says 22), PHP 7.4+ with Composer, and for the
end-to-end run `pdo_sqlite`, `gd`, `curl` and `unzip`.

```sh
npm install
composer install
npm run build        # or `npm start` to watch
```

| Check | Command | What |
|---|---|---|
| JS lint | `npm run lint:js` | ESLint (WordPress config) over `src` and `tests` |
| Types | `npm run typecheck` | `tsc` in strict mode over `src` and `tests/js` (the build strips types without checking them) |
| CSS lint | `npm run lint:css` | stylelint |
| PHP lint | `composer lint` | PHPCS: WordPress-Extra, PHP 7.4 compatibility |
| PHP unit | `composer test` | Draft, request bodies, image sizing and shape, media rules, times, PKCE, parsing, records, numbers, auto-share settings and when it queues, templates |
| JS unit | `npm run test:js` | versions, per-channel rules, counting, times, numbers, when to stop polling, the template preview |
| Contract | `npm run test:contract` | PHP's requests and the mock's answers against the API spec |
| End to end | `npm run test:e2e` | the whole flow in Chromium, see below |

`npm test` runs the typecheck, the JS unit tests and the contract tests.

### End to end, without an Orbitwrite account

`npm run test:e2e` builds the plugin, creates a throwaway WordPress in
`.e2e-site/` (SQLite and PHP's built-in server: no Docker, no MySQL, and the
Classic Editor plugin installed), starts `tests/e2e/mock-orbitwrite.mjs`, and
drives Chromium through: connect over OAuth, compose in the block editor,
schedule, give Bluesky its own version, close and reopen the sidebar, check a
network that needs an image, publish now and its numbers, delete, compose on
the classic screen, a refused token being refreshed (including five requests
at once), a past time being refused, the last four weeks, auto-share (set it
up, publish an article, run cron with WP-CLI, check what was sent; then an
article published twice and one opted out, neither shared), the dashboard
widget, the Posts list's column and row action, several posts' numbers read
together, and disconnect.
Screenshots land in `tests/e2e/shots/`. `E2E_SITE_PORT` and `E2E_MOCK_PORT`
move it off 8080 and 4010.

The mock is strict where Orbitwrite is (it fetches and checks the site's CIMD
document, verifies PKCE, rotates refresh tokens, checks upload signatures,
refuses offset timestamps), and validates every request and answer against
`openapi/orbitwrite.json`. Set `CHROMIUM_PATH` to use an installed Chrome;
otherwise run `npx playwright-core install chromium` once.

To click around by hand:

```sh
tests/e2e/setup-site.sh /tmp/orbitwrite-site
PHP_CLI_SERVER_WORKERS=4 php -S 127.0.0.1:8080 -t /tmp/orbitwrite-site/wordpress /tmp/orbitwrite-site/router.php &
node tests/e2e/mock-orbitwrite.mjs &
# http://127.0.0.1:8080/wp-admin  (admin / password)
```

## The API contract

The plugin talks to Orbitwrite through a small hand-written client
(`includes/class-api.php`), kept honest by `openapi/orbitwrite.json`: the
slice of Orbitwrite's OpenAPI spec covering the eleven operations it calls.

```sh
npm run openapi:sync            # re-cut it from https://orbitwrite.com/api/v1/openapi.json
npm run openapi:sync -- <file>  # or from a local copy / staging URL
npm run openapi:check           # fail if the live spec moved (CI runs this weekly)
```

Calling a new operation means adding it to `OPERATIONS` in
`scripts/sync-openapi.mjs`, re-syncing, and adding the request to
`tests/contract/requests.php`.

## Filters and constants

| Hook | For |
|---|---|
| `ORBITWRITE_BASE_URL` (constant) / `orbitwrite_base_url` | The Orbitwrite origin |
| `orbitwrite_connect_problems` | The reasons shown instead of the Connect button |
| `orbitwrite_post_types` | Post types the composer appears on |
| `orbitwrite_max_image_bytes` | The largest image ever uploaded (default 8 MB) |
| `orbitwrite_auto_share_article` | Whether an article may be auto-shared as it's published (its author's settings still apply) |

## Layout

```
orbitwrite.php          plugin header, autoloader, boot
uninstall.php           removes everything the plugin stored
includes/               PHP, one class per file (class-foo-bar.php → Foo_Bar)
src/                    the UI in TypeScript (built to build/ by wp-scripts)
  editor.tsx classic.tsx admin.tsx   entry points: where the composer mounts
  auto-share.tsx dashboard.tsx       entry points: auto-share settings, dashboard widget
  lib/                               pure logic, no React (unit tested in tests/js)
  lib/api.ts lib/types.ts            the plugin's REST routes and what they answer
  hooks/                             React hooks shared across screens, one per file
  components/                        small shared UI pieces
  composer/                          the composer: sections, channel list, its hooks
  block-editor/ classic-editor/      each editor's integration around the composer
  auto-share-settings/ summary/      the settings form, the last-four-weeks summary
  styles/                            composer.scss
openapi/orbitwrite.json the API contract (generated)
scripts/                sync-openapi.mjs
tests/php tests/js      unit tests
tests/contract          contract test
tests/e2e               mock Orbitwrite, test-site setup, browser run
dev/                    local-only helpers mapped into wp-env
```

## Releasing

`npm run plugin-zip` builds and zips what `files` in `package.json` lists.
Run [Plugin Check](https://wordpress.org/plugins/plugin-check/) on it before
submitting to WordPress.org.
