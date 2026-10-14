=== Orbitwrite ===
Contributors: orbitwrite
Tags: social media, scheduling, bluesky, linkedin, mastodon
Requires at least: 6.6
Tested up to: 7.1
Requires PHP: 7.4
Stable tag: 0.1.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

The official Orbitwrite plugin: write social posts in WordPress and publish or schedule them to X, LinkedIn, Bluesky, Mastodon and more.

== Description ==

Orbitwrite for WordPress is the official plugin for [Orbitwrite](https://orbitwrite.com), the social media scheduling service. It adds a small composer to your site. When you finish an article, open **Share on Orbitwrite** in the editor sidebar: the text is filled in with the article's title and link, and its featured image is attached. Edit it, pick the networks, and choose when it goes out: now, at your workspace's next free posting slot, or at a date and time.

* Works in the block editor sidebar, as a box on the classic editor screen (with the Classic Editor plugin), and on its own **Orbitwrite** page for posts not tied to an article.
* Connect with your Orbitwrite account. No API keys to copy.
* Give any channel its own version: untick "Same as main post" and write different text or pick a different image for it.
* Each channel shows its character count and anything its network won't take, such as a missing image on Instagram, as you type.
* Images are sent at the largest size each network accepts, picked from the sizes WordPress already made.
* Your unsent draft is kept if you close the sidebar or reload.
* See what you've sent from each article, whether it's scheduled, waiting for approval or published, with links to the live posts.
* Delete a post that hasn't gone out yet.
* See how each published post did: impressions, reactions, comments, reposts and link clicks back to your article.
* The Orbitwrite page opens with your last four weeks: posts published, impressions, engagements and link clicks against the four weeks before, and your top posts.
* A dashboard widget with your last four weeks, and a Social column and Share link in your Posts list.
* Auto-share: share each article you write to the channels you choose, with text built from the article (title, link, excerpt, author, tags as hashtags), the first time it's published. Turn it off for any article from its Share on Orbitwrite box.

You need an [Orbitwrite](https://orbitwrite.com) account with at least one connected social channel. Orbitwrite plans are paid, and each starts with a 10-day free trial.

Each WordPress user connects their own Orbitwrite account, so posts are attributed to the right person and your team's roles and approval rules in Orbitwrite still apply.

== External services ==

This plugin connects to Orbitwrite (https://orbitwrite.com), a social media scheduling service, to publish and schedule the posts you write with it. Nothing is sent until a user connects their Orbitwrite account.

* **When you connect**, Orbitwrite reads this site's public client description at `/wp-json/orbitwrite/v1/oauth-client` (the site's name, address and icon) and you sign in on orbitwrite.com.
* **When you open the composer**, the plugin asks Orbitwrite for your workspace's channels, posting rules, timezone and next free posting slot, and the status of posts sent from the article you're editing.
* **When you send a post**, the plugin reads your channels' current rules, then sends its text (and each channel's own version), the channels you picked, the time, the article's title, and the images you attached (with their alt text) to Orbitwrite.
* **When you open an article or the Orbitwrite page**, the plugin reads how the posts you sent did, and your workspace's totals and top posts for the last four weeks.
* **Twice a day**, from WordPress's scheduled tasks, the plugin re-reads how the posts sent from your most recent articles are doing, using the connection of whoever sent each one, so the Posts list's Social column stays current.
* **When an article is published and its author has turned on auto-share**, the plugin sends the post auto-share builds (its text, the author's chosen channels, the article's title and, if chosen, its featured image with alt text) to Orbitwrite from WordPress's scheduled tasks, using the author's connection.
* **When you disconnect**, the plugin asks Orbitwrite to revoke its access.

Requests are made by your WordPress server, never your browser, and identify the plugin and WordPress versions in their User-Agent.

Orbitwrite's [terms of service](https://orbitwrite.com/terms) and [privacy policy](https://orbitwrite.com/privacy).

== Source code ==

The plugin's JavaScript and styles are built from the source in its `src` folder with [@wordpress/scripts](https://www.npmjs.com/package/@wordpress/scripts). To build it yourself, run `npm install` and then `npm run build` in the plugin's folder; `package.json` lists the build and its tools.

== Frequently Asked Questions ==

= Why can't I connect? =

Orbitwrite has to be able to reach your site over HTTPS to recognise it, so connecting needs a public address, HTTPS, and pretty permalinks (any setting other than "Plain" under Settings → Permalinks). The plugin tells you which one is missing. Local and private staging sites can't connect.

= Which timezone are times in? =

Your Orbitwrite workspace's, so 9:00 means the 9:00 on your Orbitwrite calendar. The composer labels every time with it.

= Whose channels does auto-share post to? =

The article author's. Each person sets up auto-share for their own articles under Orbitwrite → Auto-share, so an editor publishing someone else's article shares it to the author's channels, not their own.

= Will auto-share post an article twice? =

No. It shares an article only the first time it's published, and not at all if someone already shared it from its Share on Orbitwrite box.

= How do I remove the plugin's access? =

Click **Disconnect** in the composer, or remove it in Orbitwrite under Settings → MCP → Connected apps.

== Screenshots ==

1. The Share on Orbitwrite sidebar in the block editor.
2. The Orbitwrite page: your last four weeks, and a composer for posts not tied to an article.
3. Auto-share settings.

== Changelog ==

= 0.1.0 =
* First release.
