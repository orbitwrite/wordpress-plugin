<?php
/**
 * The admin page, the editor sidebar's assets and notices.
 *
 * @package Orbitwrite
 */

namespace Orbitwrite\WordPress;

defined( 'ABSPATH' ) || exit;

/**
 * Wires the composer into wp-admin: an "Orbitwrite" page for posts not tied
 * to an article, a sidebar in the block editor, and a "Share on Orbitwrite"
 * box on the classic editor's screen (the Classic Editor plugin, or any post
 * type without the block editor).
 */
final class Admin {

	const PAGE_SLUG = 'orbitwrite';

	/** The auto-share settings page. */
	const AUTO_SHARE_SLUG = 'orbitwrite-auto-share';

	/**
	 * The settings page's hook suffix, once the menu is built.
	 *
	 * @var string
	 */
	private static $auto_share_hook = '';

	/**
	 * Register hooks.
	 */
	public static function register(): void {
		add_action( 'admin_menu', array( self::class, 'menu' ) );
		add_action( 'admin_enqueue_scripts', array( self::class, 'enqueue_page' ) );
		add_action( 'enqueue_block_editor_assets', array( self::class, 'enqueue_editor' ) );
		add_action( 'add_meta_boxes', array( self::class, 'meta_box' ), 10, 2 );
		add_action( 'admin_notices', array( self::class, 'notices' ) );
		add_action( 'wp_dashboard_setup', array( self::class, 'dashboard_widget' ) );
		add_action( 'admin_init', array( self::class, 'list_table' ) );
		add_filter( 'plugin_action_links_' . plugin_basename( ORBITWRITE_PLUGIN_FILE ), array( self::class, 'action_links' ) );
	}

	/**
	 * The admin page's URL.
	 */
	public static function page_url(): string {
		return admin_url( 'admin.php?page=' . self::PAGE_SLUG );
	}

	/**
	 * The auto-share settings page's URL.
	 */
	public static function auto_share_url(): string {
		return admin_url( 'admin.php?page=' . self::AUTO_SHARE_SLUG );
	}

	/**
	 * Add the menu entries: the page, and auto-share under it.
	 */
	public static function menu(): void {
		add_menu_page(
			__( 'Orbitwrite', 'orbitwrite' ),
			__( 'Orbitwrite', 'orbitwrite' ),
			'edit_posts',
			self::PAGE_SLUG,
			array( self::class, 'render_page' ),
			'dashicons-share',
			26
		);
		// Names the first entry, which otherwise repeats "Orbitwrite".
		add_submenu_page(
			self::PAGE_SLUG,
			__( 'Orbitwrite', 'orbitwrite' ),
			__( 'Overview', 'orbitwrite' ),
			'edit_posts',
			self::PAGE_SLUG,
			array( self::class, 'render_page' )
		);
		self::$auto_share_hook = (string) add_submenu_page(
			self::PAGE_SLUG,
			__( 'Auto-share', 'orbitwrite' ),
			__( 'Auto-share', 'orbitwrite' ),
			'edit_posts',
			self::AUTO_SHARE_SLUG,
			array( self::class, 'render_auto_share' )
		);
	}

	/**
	 * The admin page: a mount point for the last four weeks and the composer.
	 */
	public static function render_page(): void {
		?>
		<div class="wrap orbitwrite-page">
			<h1><?php esc_html_e( 'Orbitwrite', 'orbitwrite' ); ?></h1>
			<div id="orbitwrite-app"></div>
			<noscript><p><?php esc_html_e( 'The Orbitwrite composer needs JavaScript.', 'orbitwrite' ); ?></p></noscript>
		</div>
		<?php
	}

	/**
	 * The auto-share settings page: a mount point for the form.
	 */
	public static function render_auto_share(): void {
		?>
		<div class="wrap orbitwrite-page">
			<h1><?php esc_html_e( 'Auto-share', 'orbitwrite' ); ?></h1>
			<p class="orbitwrite-page__intro"><?php esc_html_e( 'Share each article you write to your channels when it\'s published, without opening the composer. These settings are yours: other people on this site set up their own.', 'orbitwrite' ); ?></p>
			<div id="orbitwrite-auto-share"></div>
			<noscript><p><?php esc_html_e( 'These settings need JavaScript.', 'orbitwrite' ); ?></p></noscript>
		</div>
		<?php
	}

	/**
	 * Load the composer on the admin page.
	 *
	 * @param string $hook_suffix Current admin page.
	 */
	public static function enqueue_page( string $hook_suffix ): void {
		if ( 'toplevel_page_' . self::PAGE_SLUG === $hook_suffix ) {
			wp_enqueue_media();
			self::enqueue_build( 'admin' );
			return;
		}
		if ( '' !== self::$auto_share_hook && self::$auto_share_hook === $hook_suffix ) {
			self::enqueue_build( 'auto-share' );
			return;
		}
		if ( 'edit.php' === $hook_suffix ) {
			// The Social column; the list doesn't load the composer's styles.
			wp_register_style( 'orbitwrite-list', false, array(), ORBITWRITE_PLUGIN_VERSION );
			wp_enqueue_style( 'orbitwrite-list' );
			wp_add_inline_style(
				'orbitwrite-list',
				'.column-orbitwrite{width:11em}.orbitwrite-column__numbers{color:#646970}.orbitwrite-column__failed{color:#b32d2e}'
			);
			return;
		}
		if ( 'index.php' === $hook_suffix && current_user_can( 'edit_posts' ) && Token_Store::get( get_current_user_id() ) ) {
			self::enqueue_build( 'dashboard' );
			return;
		}
		if ( in_array( $hook_suffix, array( 'post.php', 'post-new.php' ), true ) ) {
			$post = get_post();
			if ( $post && self::is_classic_screen( $post ) ) {
				wp_enqueue_media();
				self::enqueue_build( 'classic' );
			}
		}
	}

	/**
	 * Whether a post is edited on the classic screen, where the composer is a
	 * box rather than a block editor sidebar.
	 *
	 * @param \WP_Post $post Post.
	 */
	private static function is_classic_screen( \WP_Post $post ): bool {
		return in_array( $post->post_type, self::post_types(), true )
			&& current_user_can( 'edit_posts' )
			&& ! use_block_editor_for_post( $post );
	}

	/**
	 * Add the composer box to the classic editor's side column.
	 *
	 * @param string $post_type Post type.
	 * @param mixed  $post      Post being edited.
	 */
	public static function meta_box( string $post_type, $post ): void {
		if ( ! $post instanceof \WP_Post || ! self::is_classic_screen( $post ) ) {
			return;
		}
		add_meta_box(
			'orbitwrite-share',
			__( 'Share on Orbitwrite', 'orbitwrite' ),
			array( self::class, 'render_meta_box' ),
			$post_type,
			'side',
			// After core's own boxes (`core`), so under Publish, never above
			// it: `high` would push the Publish button down the screen.
			'default',
			// The block editor has its own sidebar; never show both.
			array( '__back_compat_meta_box' => true )
		);
	}

	/**
	 * The box: a mount point carrying what the page can't tell the script.
	 * Title, permalink and featured image are read live from the form.
	 *
	 * @param \WP_Post $post Post.
	 */
	public static function render_meta_box( \WP_Post $post ): void {
		printf(
			'<div id="orbitwrite-classic" class="orbitwrite-classic" data-post-id="%1$d" data-status="%2$s" data-permalink="%3$s"></div><noscript>%4$s</noscript>',
			(int) $post->ID,
			esc_attr( $post->post_status ),
			esc_url( self::permalink_for( $post ) ),
			esc_html__( 'The Orbitwrite composer needs JavaScript.', 'orbitwrite' )
		);
	}

	/**
	 * The address a post has, or will have once published. A draft's
	 * get_permalink() is `?p=123`, which is not what a social post should
	 * link to, so drafts use the sample permalink with their slug filled in.
	 *
	 * @param \WP_Post $post Post.
	 */
	private static function permalink_for( \WP_Post $post ): string {
		if ( 'publish' === $post->post_status || ! function_exists( 'get_sample_permalink' ) ) {
			return (string) get_permalink( $post );
		}
		list( $template, $name ) = get_sample_permalink( $post->ID );
		return str_replace( array( '%postname%', '%pagename%' ), (string) $name, (string) $template );
	}

	/**
	 * Load the sidebar in the block editor, for post types that have a
	 * public page to share.
	 */
	public static function enqueue_editor(): void {
		$screen = function_exists( 'get_current_screen' ) ? get_current_screen() : null;
		if ( ! $screen || ! in_array( $screen->post_type, self::post_types(), true ) ) {
			return;
		}
		self::enqueue_build( 'editor' );
	}

	/**
	 * Post types the sidebar appears on.
	 */
	public static function post_types(): array {
		$types = get_post_types(
			array(
				'public'       => true,
				'show_in_rest' => true,
			)
		);
		unset( $types['attachment'] );
		/**
		 * Filters the post types the Orbitwrite sidebar appears on.
		 *
		 * @param string[] $types Post type names.
		 */
		return array_values( (array) apply_filters( 'orbitwrite_post_types', array_values( $types ) ) );
	}

	/**
	 * Enqueue one built entry point and its stylesheet.
	 *
	 * @param string $entry `admin`, `auto-share`, `dashboard`, `editor` or `classic`.
	 */
	private static function enqueue_build( string $entry ): void {
		$asset_file = ORBITWRITE_PLUGIN_DIR . 'build/' . $entry . '.asset.php';
		if ( ! file_exists( $asset_file ) ) {
			return;
		}
		$asset  = require $asset_file;
		$handle = 'orbitwrite-' . $entry;
		wp_enqueue_script(
			$handle,
			plugins_url( 'build/' . $entry . '.js', ORBITWRITE_PLUGIN_FILE ),
			$asset['dependencies'],
			$asset['version'],
			true
		);
		wp_set_script_translations( $handle, 'orbitwrite' );
		if ( in_array( $entry, array( 'admin', 'editor', 'classic' ), true ) ) {
			// The composer's first question, answered in the page: no
			// request and no spinner before it can show anything.
			wp_add_inline_script(
				$handle,
				'window.orbitwriteBoot = ' . wp_json_encode(
					array( 'status' => Rest::status_payload( get_current_user_id(), self::current_url() ) )
				) . ';',
				'before'
			);
		}
		if ( file_exists( ORBITWRITE_PLUGIN_DIR . 'build/' . $entry . '.css' ) ) {
			wp_enqueue_style(
				$handle,
				plugins_url( 'build/' . $entry . '.css', ORBITWRITE_PLUGIN_FILE ),
				array( 'wp-components' ),
				$asset['version']
			);
		}
	}

	/**
	 * The address of the admin screen being drawn, for connecting to come
	 * back to.
	 */
	private static function current_url(): string {
		$uri = isset( $_SERVER['REQUEST_URI'] ) ? esc_url_raw( wp_unslash( $_SERVER['REQUEST_URI'] ) ) : '';
		// The admin's own origin (scheme, host and any port), then the path.
		return '' === $uri ? self::page_url() : preg_replace( '#^(https?://[^/]+).*$#', '$1', admin_url() ) . $uri;
	}

	/**
	 * The dashboard widget: the last four weeks, for anyone who can write.
	 */
	public static function dashboard_widget(): void {
		if ( ! current_user_can( 'edit_posts' ) ) {
			return;
		}
		wp_add_dashboard_widget(
			'orbitwrite_summary',
			__( 'Orbitwrite: last 4 weeks', 'orbitwrite' ),
			array( self::class, 'render_dashboard_widget' )
		);
	}

	/**
	 * The widget's body: a mount point, or the way to connect.
	 */
	public static function render_dashboard_widget(): void {
		if ( ! Token_Store::get( get_current_user_id() ) ) {
			printf(
				'<p>%1$s</p><p><a class="button" href="%2$s">%3$s</a></p>',
				esc_html__( 'Connect Orbitwrite to see how your social posts are doing.', 'orbitwrite' ),
				esc_url( self::page_url() ),
				esc_html__( 'Connect Orbitwrite', 'orbitwrite' )
			);
			return;
		}
		echo '<div id="orbitwrite-dashboard"></div>';
	}

	/**
	 * The Posts list: a Social column, and a "Share on Orbitwrite" row action.
	 */
	public static function list_table(): void {
		foreach ( self::post_types() as $type ) {
			add_filter( "manage_{$type}_posts_columns", array( self::class, 'add_column' ) );
			add_action( "manage_{$type}_posts_custom_column", array( self::class, 'render_column' ), 10, 2 );
		}
		add_filter( 'post_row_actions', array( self::class, 'row_action' ), 10, 2 );
		add_filter( 'page_row_actions', array( self::class, 'row_action' ), 10, 2 );
	}

	/**
	 * Add the Social column, before Date.
	 *
	 * @param array $columns Columns.
	 */
	public static function add_column( array $columns ): array {
		$added = array();
		foreach ( $columns as $key => $label ) {
			if ( 'date' === $key ) {
				$added['orbitwrite'] = __( 'Social', 'orbitwrite' );
			}
			$added[ $key ] = $label;
		}
		if ( ! isset( $added['orbitwrite'] ) ) {
			$added['orbitwrite'] = __( 'Social', 'orbitwrite' );
		}
		return $added;
	}

	/**
	 * The Social column: what was sent and how it did, from what's stored on
	 * the article (the list's own query already loaded it), never a request
	 * to Orbitwrite while the list draws.
	 *
	 * @param string $column  Column.
	 * @param int    $post_id Article.
	 */
	public static function render_column( $column, $post_id ): void {
		if ( 'orbitwrite' !== $column ) {
			return;
		}
		$summary = Shares::column( Shares::all( (int) $post_id ) );
		$parts   = array();
		if ( $summary['published'] ) {
			/* translators: %s: number of posts. */
			$parts[] = sprintf( _n( '%s published', '%s published', $summary['published'], 'orbitwrite' ), number_format_i18n( $summary['published'] ) );
		}
		if ( $summary['scheduled'] ) {
			/* translators: %s: number of posts. */
			$parts[] = sprintf( _n( '%s scheduled', '%s scheduled', $summary['scheduled'], 'orbitwrite' ), number_format_i18n( $summary['scheduled'] ) );
		}
		if ( $summary['waiting'] ) {
			/* translators: %s: number of posts. */
			$parts[] = sprintf( _n( '%s awaiting approval', '%s awaiting approval', $summary['waiting'], 'orbitwrite' ), number_format_i18n( $summary['waiting'] ) );
		}
		if ( ! $parts && ! $summary['failed'] ) {
			echo '<span aria-hidden="true">—</span><span class="screen-reader-text">' . esc_html__( 'Not shared', 'orbitwrite' ) . '</span>';
			return;
		}
		echo '<span class="orbitwrite-column">' . esc_html( implode( ' · ', $parts ) );
		if ( $summary['failed'] ) {
			/* translators: %s: number of posts. */
			echo ( $parts ? ' · ' : '' ) . '<span class="orbitwrite-column__failed">' . esc_html( sprintf( _n( '%s failed', '%s failed', $summary['failed'], 'orbitwrite' ), number_format_i18n( $summary['failed'] ) ) ) . '</span>';
		}
		$numbers = array();
		if ( null !== $summary['impressions'] ) {
			/* translators: %s: number. */
			$numbers[] = sprintf( _n( '%s impression', '%s impressions', (int) $summary['impressions'], 'orbitwrite' ), number_format_i18n( $summary['impressions'] ) );
		}
		if ( null !== $summary['clicks'] ) {
			/* translators: %s: number. */
			$numbers[] = sprintf( _n( '%s link click', '%s link clicks', (int) $summary['clicks'], 'orbitwrite' ), number_format_i18n( $summary['clicks'] ) );
		}
		if ( $numbers ) {
			echo '<br><span class="orbitwrite-column__numbers">' . esc_html( implode( ' · ', $numbers ) ) . '</span>';
		}
		echo '</span>';
	}

	/**
	 * "Share on Orbitwrite" under an article in the Posts list: its editor,
	 * with the composer open.
	 *
	 * @param array    $actions Row actions.
	 * @param \WP_Post $post    Article.
	 */
	public static function row_action( $actions, $post ): array {
		$actions = (array) $actions;
		if ( ! $post instanceof \WP_Post || 'trash' === $post->post_status
			|| ! in_array( $post->post_type, self::post_types(), true )
			|| ! current_user_can( 'edit_post', $post->ID ) ) {
			return $actions;
		}
		$link = get_edit_post_link( $post->ID, 'raw' );
		if ( ! $link ) {
			return $actions;
		}
		// The block editor opens the sidebar on `orbitwrite=share`; the
		// classic screen scrolls to the box.
		$link                  = add_query_arg( 'orbitwrite', 'share', $link ) . ( use_block_editor_for_post( $post ) ? '' : '#orbitwrite-share' );
		$actions['orbitwrite'] = sprintf(
			'<a href="%1$s" aria-label="%2$s">%3$s</a>',
			esc_url( $link ),
			/* translators: %s: article title. */
			esc_attr( sprintf( __( 'Share “%s” on Orbitwrite', 'orbitwrite' ), get_the_title( $post ) ) ),
			// Short like core's own (Edit, Trash, View); the label above
			// says which article and where.
			esc_html__( 'Share', 'orbitwrite' )
		);
		return $actions;
	}

	/**
	 * Show a notice left by the OAuth flow. The block editor doesn't render
	 * these; there the composer picks the notice up instead.
	 */
	public static function notices(): void {
		$screen = function_exists( 'get_current_screen' ) ? get_current_screen() : null;
		if ( $screen && method_exists( $screen, 'is_block_editor' ) && $screen->is_block_editor() ) {
			return;
		}
		if ( $screen && 'toplevel_page_' . self::PAGE_SLUG === $screen->id ) {
			return; // The composer shows it.
		}
		$notice = Notices::pop( get_current_user_id() );
		if ( ! $notice ) {
			return;
		}
		$type = in_array( $notice['type'], array( 'success', 'error', 'warning', 'info' ), true ) ? $notice['type'] : 'info';
		printf(
			'<div class="notice notice-%1$s is-dismissible"><p>%2$s</p></div>',
			esc_attr( $type ),
			esc_html( (string) $notice['message'] )
		);
	}

	/**
	 * A link to the page from the plugins list.
	 *
	 * @param array $links Existing links.
	 */
	public static function action_links( array $links ): array {
		array_unshift(
			$links,
			sprintf( '<a href="%s">%s</a>', esc_url( self::page_url() ), esc_html__( 'Open', 'orbitwrite' ) )
		);
		return $links;
	}
}
