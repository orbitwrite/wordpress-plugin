<?php
/**
 * Sharing an article on its own when it's published.
 *
 * @package Orbitwrite
 */

namespace Orbitwrite\WordPress;

use DateTimeImmutable;
use DateTimeZone;
use WP_Error;
use WP_Post;

defined( 'ABSPATH' ) || exit;

/**
 * Auto-share: a person's setting that shares each of their articles to
 * chosen channels, from a text template, when the article is first
 * published.
 *
 * - **It's the author's setting, and the author's connection.** Connections
 *   are per person, and an article published by an editor, or by WP-Cron at
 *   its scheduled time, is still the author's. So the author's settings say
 *   whether and where it goes, and the post is theirs in Orbitwrite.
 * - **Once per article.** Only the first move to Published counts. An article
 *   unpublished and published again isn't shared again, nor is one someone
 *   already shared by hand from the composer.
 * - **Sent from WP-Cron, not the save.** The share uploads an image and
 *   creates a post, which would hold up the editor's save; and when the block
 *   editor publishes, the featured image and tags are saved after the status
 *   changes, so they aren't there yet when it does.
 * - **Claimed before sending.** The article's state goes `queued` →
 *   `sending` with a conditional UPDATE, so two cron runs at once can't both
 *   send: the second finds nothing queued.
 * - **A failure is recorded, not retried.** A create that failed late may
 *   have gone through, and sending it again would post twice. The composer
 *   shows the reason on the article, and the author gets a notice.
 */
final class Auto_Share {

	/** The person's settings (user meta). */
	const SETTINGS_KEY = '_orbitwrite_auto_share';

	/** An article opted out of auto-share (post meta). */
	const OFF_KEY = '_orbitwrite_auto_share_off';

	/** Where an article's auto-share got to (post meta). */
	const STATE_KEY = '_orbitwrite_auto_share_state';

	/** Why an article's auto-share failed (post meta). */
	const ERROR_KEY = '_orbitwrite_auto_share_error';

	/** The WP-Cron hook that sends one article. */
	const CRON_HOOK = 'orbitwrite_auto_share';

	/**
	 * Register hooks.
	 */
	public static function register(): void {
		add_action( 'transition_post_status', array( self::class, 'on_transition' ), 10, 3 );
		add_action( self::CRON_HOOK, array( self::class, 'run' ) );
	}

	/**
	 * A person's settings, with defaults for anything never saved.
	 *
	 * @param int $user_id WordPress user id.
	 */
	public static function get( int $user_id ): array {
		$stored = get_user_meta( $user_id, self::SETTINGS_KEY, true );
		return array_merge( self::defaults(), is_array( $stored ) ? $stored : array() );
	}

	/**
	 * Settings never saved: off, with the composer's own default text.
	 */
	public static function defaults(): array {
		return array(
			'enabled'         => false,
			'organization_id' => '',
			'account_ids'     => array(),
			'template'        => Template::DEFAULT,
			'image'           => true,
			'when'            => Schedule_Time::NEXT,
			'post_types'      => array( 'post' ),
		);
	}

	/**
	 * Settings from the form, checked. Pure.
	 *
	 * @param array    $input      `{ enabled, accountIds, template, image, when, postTypes }`.
	 * @param string[] $post_types The post types that may be picked.
	 * @return array|WP_Error Settings, without the workspace.
	 */
	public static function validate( array $input, array $post_types ) {
		$account_ids = array_values( array_unique( array_filter( array_map( 'strval', (array) ( $input['accountIds'] ?? array() ) ) ) ) );
		$template    = str_replace( "\r\n", "\n", (string) ( $input['template'] ?? '' ) );
		$when        = (string) ( $input['when'] ?? Schedule_Time::NEXT );
		$picked      = array_values( array_unique( array_map( 'strval', (array) ( $input['postTypes'] ?? array() ) ) ) );
		$enabled     = ! empty( $input['enabled'] );

		$invalid = static function ( string $message ) {
			return new WP_Error( 'orbitwrite_invalid', $message, array( 'status' => 400 ) );
		};
		if ( ! in_array( $when, array( Schedule_Time::NEXT, Schedule_Time::NOW ), true ) ) {
			return $invalid( __( 'Choose when auto-shared posts go out.', 'orbitwrite' ) );
		}
		if ( count( $account_ids ) > Draft::MAX_CHANNELS ) {
			return $invalid( __( 'That is too many channels for one post.', 'orbitwrite' ) );
		}
		$unknown = Template::unknown_tags( $template );
		if ( $unknown ) {
			return $invalid(
				sprintf(
					/* translators: 1: the unknown tags, 2: the tags that exist. */
					__( 'The text uses %1$s, which isn\'t a tag. Use %2$s.', 'orbitwrite' ),
					'{' . implode( '}, {', $unknown ) . '}',
					'{' . implode( '}, {', Template::TAGS ) . '}'
				)
			);
		}
		if ( strlen( $template ) > Template::MAX_LENGTH ) {
			return $invalid( __( 'That text is too long.', 'orbitwrite' ) );
		}
		if ( array_diff( $picked, $post_types ) ) {
			return $invalid( __( 'One of those content types can\'t be shared.', 'orbitwrite' ) );
		}
		if ( $enabled && ! $account_ids ) {
			return $invalid( __( 'Pick at least one channel to share to.', 'orbitwrite' ) );
		}
		if ( $enabled && '' === trim( $template ) ) {
			return $invalid( __( 'Write the text auto-shared posts start from.', 'orbitwrite' ) );
		}
		if ( $enabled && ! $picked ) {
			return $invalid( __( 'Pick at least one content type to share.', 'orbitwrite' ) );
		}

		return array(
			'enabled'     => $enabled,
			'account_ids' => $account_ids,
			'template'    => $template,
			'image'       => ! empty( $input['image'] ),
			'when'        => $when,
			'post_types'  => $picked,
		);
	}

	/**
	 * Store a person's settings, bound to the workspace their channels are in.
	 *
	 * @param int    $user_id         WordPress user id.
	 * @param array  $settings        From validate().
	 * @param string $organization_id The connected workspace.
	 */
	public static function save( int $user_id, array $settings, string $organization_id ): void {
		$settings['organization_id'] = $organization_id;
		update_user_meta( $user_id, self::SETTINGS_KEY, $settings );
	}

	/**
	 * Settings as the settings page sees them.
	 *
	 * @param array $settings From get().
	 */
	public static function present( array $settings ): array {
		return array(
			'enabled'    => (bool) $settings['enabled'],
			'accountIds' => array_values( (array) $settings['account_ids'] ),
			'template'   => (string) $settings['template'],
			'image'      => (bool) $settings['image'],
			'when'       => (string) $settings['when'],
			'postTypes'  => array_values( (array) $settings['post_types'] ),
		);
	}

	/**
	 * Whether an article moving to Published should be queued. Pure.
	 *
	 * @param array  $settings       The author's settings.
	 * @param string $connected_org  The author's connected workspace, '' if none.
	 * @param string $post_type      The article's post type.
	 * @param bool   $opted_out      Whether the article was opted out.
	 * @param bool   $has_shares     Whether anything was sent from it already.
	 * @param string $state          Its auto-share state, '' if never queued.
	 */
	public static function should_queue( array $settings, string $connected_org, string $post_type, bool $opted_out, bool $has_shares, string $state ): bool {
		return self::applies( $settings, $connected_org, $post_type )
			&& ! $opted_out
			&& ! $has_shares
			&& '' === $state;
	}

	/**
	 * Whether a person's settings cover a post type, in the workspace they're
	 * connected to now. Pure. Channel ids belong to a workspace, so settings
	 * saved against another one cover nothing.
	 *
	 * @param array  $settings      The person's settings.
	 * @param string $connected_org Their connected workspace, '' if none.
	 * @param string $post_type     Post type.
	 */
	public static function applies( array $settings, string $connected_org, string $post_type ): bool {
		return ! empty( $settings['enabled'] )
			&& ! empty( $settings['account_ids'] )
			&& '' !== $connected_org
			&& ( $settings['organization_id'] ?? '' ) === $connected_org
			&& in_array( $post_type, (array) $settings['post_types'], true );
	}

	/**
	 * The workspace a person is connected to, or ''.
	 *
	 * @param int $user_id WordPress user id.
	 */
	private static function connected_org( int $user_id ): string {
		$connection = Token_Store::get( $user_id );
		return $connection ? (string) ( $connection['organization']['id'] ?? '' ) : '';
	}

	/**
	 * `transition_post_status`: queue an article the first time it's
	 * published, when its author shares automatically.
	 *
	 * @param string  $new_status New status.
	 * @param string  $old_status Old status.
	 * @param WP_Post $post       Post.
	 */
	public static function on_transition( $new_status, $old_status, $post ): void {
		if ( 'publish' !== $new_status || 'publish' === $old_status || ! $post instanceof WP_Post ) {
			return;
		}
		if ( wp_is_post_revision( $post ) || wp_is_post_autosave( $post ) ) {
			return;
		}
		// An import publishes every post it brings in; none of them is news.
		if ( defined( 'WP_IMPORTING' ) && WP_IMPORTING ) {
			return;
		}
		/**
		 * Filters whether an article may be auto-shared as it's published.
		 * (Not `orbitwrite_auto_share`: that's the cron action, and actions
		 * and filters share one registry.)
		 *
		 * @param bool    $share Whether to share it. Its author's settings still apply.
		 * @param WP_Post $post  The article.
		 */
		if ( ! apply_filters( 'orbitwrite_auto_share_article', true, $post ) ) {
			return;
		}
		$author = (int) $post->post_author;
		if ( ! $author || ! self::should_queue(
			self::get( $author ),
			self::connected_org( $author ),
			$post->post_type,
			(bool) get_post_meta( $post->ID, self::OFF_KEY, true ),
			(bool) Shares::all( $post->ID ),
			(string) get_post_meta( $post->ID, self::STATE_KEY, true )
		) ) {
			return;
		}
		if ( ! add_post_meta( $post->ID, self::STATE_KEY, 'queued', true ) ) {
			return;
		}
		wp_schedule_single_event( time(), self::CRON_HOOK, array( (int) $post->ID ) );
	}

	/**
	 * The cron run: share one article.
	 *
	 * @param int $post_id Article.
	 */
	public static function run( $post_id ): void {
		$post_id = (int) $post_id;
		$post    = get_post( $post_id );
		if ( ! $post instanceof WP_Post ) {
			return;
		}
		if ( 'publish' !== $post->post_status ) {
			// Unpublished before its turn came: let the next publish queue it.
			delete_post_meta( $post_id, self::STATE_KEY, 'queued' );
			return;
		}
		// The claim: an UPDATE … WHERE meta_value = 'queued', so only one run
		// gets past it. Checked first because update_post_meta() adds the
		// row when there is none, which would claim an article never queued.
		if ( 'queued' !== get_post_meta( $post_id, self::STATE_KEY, true )
			|| ! update_post_meta( $post_id, self::STATE_KEY, 'sending', 'queued' ) ) {
			return;
		}

		$author   = (int) $post->post_author;
		$settings = self::get( $author );
		$org_id   = self::connected_org( $author );
		if ( ! $org_id ) {
			self::fail( $post, __( 'Its author isn\'t connected to Orbitwrite. Connect, then share it from the article.', 'orbitwrite' ) );
			return;
		}
		if ( ! self::applies( $settings, $org_id, $post->post_type ) ) {
			self::fail( $post, __( 'Auto-share was set up for another workspace or turned off. Check the auto-share settings, then share it from the article.', 'orbitwrite' ) );
			return;
		}
		if ( get_post_meta( $post_id, self::OFF_KEY, true ) || Shares::all( $post_id ) ) {
			// Opted out, or shared by hand, since it was queued.
			update_post_meta( $post_id, self::STATE_KEY, 'skipped' );
			return;
		}

		$result = self::send( $post, $author, $settings, $org_id );
		if ( is_wp_error( $result ) ) {
			self::fail( $post, $result->get_error_message() );
			return;
		}
		update_post_meta( $post_id, self::STATE_KEY, 'sent' );
		delete_post_meta( $post_id, self::ERROR_KEY );
	}

	/**
	 * Build the post from the template and send it as the author.
	 *
	 * @param WP_Post $post     Article.
	 * @param int     $author   Its author.
	 * @param array   $settings The author's settings.
	 * @param string  $org_id   The author's workspace.
	 * @return true|WP_Error
	 */
	private static function send( WP_Post $post, int $author, array $settings, string $org_id ) {
		$attachment = $settings['image'] ? (int) get_post_thumbnail_id( $post ) : 0;
		$draft      = Draft::from_input(
			array(
				'text'         => Template::render( (string) $settings['template'], self::values( $post ) ),
				'attachmentId' => $attachment,
				'altText'      => $attachment ? (string) get_post_meta( $attachment, '_wp_attachment_image_alt', true ) : '',
			),
			array_map(
				static function ( $id ) {
					return array( 'accountId' => (string) $id );
				},
				(array) $settings['account_ids']
			)
		);
		$problem    = $draft->problem();
		if ( null !== $problem ) {
			return new WP_Error( 'orbitwrite_invalid', $problem );
		}

		$api      = new Api( $author );
		$schedule = Schedule_Time::resolve(
			(string) $settings['when'],
			'',
			Workspace::timezone( $api, $org_id ),
			new DateTimeImmutable( 'now', new DateTimeZone( 'UTC' ) ),
			static function () use ( $api, $draft ) {
				return Workspace::next_slot( $api, $draft->account_ids() );
			}
		);
		if ( is_wp_error( $schedule ) ) {
			return $schedule;
		}

		$title = wp_specialchars_decode( get_the_title( $post ), ENT_QUOTES );
		$sent  = ( new Sender( $api, $org_id ) )->send( $draft, $schedule, $title );
		if ( is_wp_error( $sent ) ) {
			return $sent;
		}
		Shares::add( $post->ID, Shares::records_for( $sent['result'], $sent['entries'], $schedule, $author ) );
		return true;
	}

	/**
	 * Record a failed share on the article and tell its author.
	 *
	 * @param WP_Post $post    Article.
	 * @param string  $message Why.
	 */
	private static function fail( WP_Post $post, string $message ): void {
		update_post_meta( $post->ID, self::STATE_KEY, 'failed' );
		update_post_meta( $post->ID, self::ERROR_KEY, $message );
		Notices::push(
			(int) $post->post_author,
			'error',
			sprintf(
				/* translators: 1: article title, 2: why. */
				__( 'Auto-share didn\'t send "%1$s": %2$s', 'orbitwrite' ),
				wp_specialchars_decode( get_the_title( $post ), ENT_QUOTES ),
				$message
			)
		);
	}

	/**
	 * The template's values for an article.
	 *
	 * @param WP_Post $post Article.
	 */
	public static function values( WP_Post $post ): array {
		$excerpt = has_excerpt( $post )
			? $post->post_excerpt
			: wp_trim_words( strip_shortcodes( $post->post_content ), 40, '…' );
		$terms   = is_object_in_taxonomy( $post->post_type, 'post_tag' ) ? get_the_terms( $post, 'post_tag' ) : array();
		return array(
			'title'    => wp_specialchars_decode( get_the_title( $post ), ENT_QUOTES ),
			'url'      => (string) get_permalink( $post ),
			'excerpt'  => html_entity_decode( wp_strip_all_tags( $excerpt ), ENT_QUOTES, 'UTF-8' ),
			'author'   => (string) get_the_author_meta( 'display_name', (int) $post->post_author ),
			'hashtags' => Template::hashtags( is_array( $terms ) ? wp_list_pluck( $terms, 'name' ) : array() ),
		);
	}

	/**
	 * The values of the person's latest article, for the settings page's
	 * preview: of the types their auto-share covers, theirs first, then
	 * anyone's. Null on a site with none.
	 *
	 * @param int $user_id WordPress user id.
	 */
	public static function sample( int $user_id ): ?array {
		$types = array_values( array_intersect( (array) self::get( $user_id )['post_types'], Admin::post_types() ) );
		$query = array(
			'post_type'   => $types ? $types : array( 'post' ),
			'post_status' => 'publish',
			'numberposts' => 1,
			'orderby'     => 'date',
			'order'       => 'DESC',
		);
		$posts = get_posts( array_merge( $query, array( 'author' => $user_id ) ) );
		if ( ! $posts ) {
			$posts = get_posts( $query );
		}
		if ( ! $posts ) {
			return null;
		}
		return array(
			'title'  => wp_specialchars_decode( get_the_title( $posts[0] ), ENT_QUOTES ),
			'values' => self::values( $posts[0] ),
		);
	}

	/**
	 * What the composer says about auto-share on an article.
	 *
	 * @param int $post_id Article.
	 * @param int $viewer  The person looking.
	 */
	public static function article_state( int $post_id, int $viewer ): array {
		$post     = get_post( $post_id );
		$author   = $post ? (int) $post->post_author : 0;
		$settings = self::get( $author );
		$state    = (string) get_post_meta( $post_id, self::STATE_KEY, true );
		$error    = (string) get_post_meta( $post_id, self::ERROR_KEY, true );
		$applies  = $post && self::applies( $settings, self::connected_org( $author ), $post->post_type );

		return array(
			// Offered while the article is waiting to be published.
			'pending'    => $applies && 'publish' !== $post->post_status && '' === $state && ! Shares::all( $post_id ),
			'enabled'    => ! get_post_meta( $post_id, self::OFF_KEY, true ),
			'isAuthor'   => $author === $viewer,
			'authorName' => $author ? (string) get_the_author_meta( 'display_name', $author ) : '',
			'when'       => (string) $settings['when'],
			'channels'   => count( (array) $settings['account_ids'] ),
			'state'      => '' === $state ? null : $state,
			'error'      => 'failed' === $state && '' !== $error ? $error : null,
		);
	}

	/**
	 * Opt an article out of auto-share, or back in.
	 *
	 * @param int  $post_id Article.
	 * @param bool $enabled Whether it shares automatically.
	 */
	public static function set_enabled( int $post_id, bool $enabled ): void {
		if ( $enabled ) {
			delete_post_meta( $post_id, self::OFF_KEY );
		} else {
			update_post_meta( $post_id, self::OFF_KEY, '1' );
		}
	}
}
