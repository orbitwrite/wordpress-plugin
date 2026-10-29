<?php
/**
 * The plugin's own REST routes, which the composer calls.
 *
 * @package Orbitwrite
 */

namespace Orbitwrite\WordPress;

use DateTimeImmutable;
use DateTimeZone;
use WP_Error;
use WP_REST_Request;
use WP_REST_Response;

defined( 'ABSPATH' ) || exit;

/**
 * `/wp-json/orbitwrite/v1/*`.
 *
 * The browser only ever talks to these. Each one checks the WordPress user,
 * loads that user's Orbitwrite token and calls Orbitwrite from PHP, so the
 * token never reaches the page.
 */
final class Rest {

	const ROUTE_NAMESPACE = 'orbitwrite/v1';

	/**
	 * Register the routes.
	 */
	public static function register(): void {
		register_rest_route(
			self::ROUTE_NAMESPACE,
			'/oauth-client',
			array(
				'methods'             => 'GET',
				'callback'            => array( self::class, 'oauth_client' ),
				// Orbitwrite fetches this anonymously; it holds nothing secret.
				'permission_callback' => '__return_true',
			)
		);

		$can_compose = array( self::class, 'can_compose' );

		register_rest_route(
			self::ROUTE_NAMESPACE,
			'/status',
			array(
				'methods'             => 'GET',
				'callback'            => array( self::class, 'status' ),
				'permission_callback' => $can_compose,
				'args'                => array(
					'returnTo' => array(
						'type'    => 'string',
						'default' => '',
					),
				),
			)
		);

		register_rest_route(
			self::ROUTE_NAMESPACE,
			'/channels',
			array(
				'methods'             => 'GET',
				'callback'            => array( self::class, 'channels' ),
				'permission_callback' => $can_compose,
			)
		);

		register_rest_route(
			self::ROUTE_NAMESPACE,
			'/next-slot',
			array(
				'methods'             => 'GET',
				'callback'            => array( self::class, 'next_slot' ),
				'permission_callback' => $can_compose,
				'args'                => array(
					'accountIds' => self::account_ids_arg(),
				),
			)
		);

		register_rest_route(
			self::ROUTE_NAMESPACE,
			'/send',
			array(
				'methods'             => 'POST',
				'callback'            => array( self::class, 'send' ),
				'permission_callback' => $can_compose,
				'args'                => array(
					'postId'       => array(
						'type'    => 'integer',
						'default' => 0,
						'minimum' => 0,
					),
					'text'         => array(
						'type'    => 'string',
						'default' => '',
					),
					'channels'     => self::channels_arg(),
					'attachmentId' => array(
						'type'    => 'integer',
						'default' => 0,
						'minimum' => 0,
					),
					'altText'      => array(
						'type'      => 'string',
						'default'   => '',
						'maxLength' => 2000,
					),
					'when'         => array(
						'type'     => 'string',
						'enum'     => array( Schedule_Time::NOW, Schedule_Time::NEXT, Schedule_Time::AT ),
						'required' => true,
					),
					'at'           => array(
						'type'    => 'string',
						'default' => '',
					),
				),
			)
		);

		register_rest_route(
			self::ROUTE_NAMESPACE,
			'/shares',
			array(
				'methods'             => 'GET',
				'callback'            => array( self::class, 'shares' ),
				'permission_callback' => $can_compose,
				'args'                => array(
					'postId' => array(
						'type'     => 'integer',
						'required' => true,
						'minimum'  => 1,
					),
				),
			)
		);

		register_rest_route(
			self::ROUTE_NAMESPACE,
			'/discard',
			array(
				'methods'             => 'POST',
				'callback'            => array( self::class, 'discard' ),
				'permission_callback' => $can_compose,
				'args'                => array(
					'postId'  => array(
						'type'    => 'integer',
						'default' => 0,
						'minimum' => 0,
					),
					'groupId' => array(
						'type'      => 'string',
						'required'  => true,
						'minLength' => 1,
					),
				),
			)
		);

		register_rest_route(
			self::ROUTE_NAMESPACE,
			'/share-numbers',
			array(
				'methods'             => 'GET',
				'callback'            => array( self::class, 'share_numbers' ),
				'permission_callback' => $can_compose,
				'args'                => array(
					'postId' => array(
						'type'     => 'integer',
						'required' => true,
						'minimum'  => 1,
					),
				),
			)
		);

		register_rest_route(
			self::ROUTE_NAMESPACE,
			'/analytics',
			array(
				'methods'             => 'GET',
				'callback'            => array( self::class, 'analytics' ),
				'permission_callback' => $can_compose,
			)
		);

		register_rest_route(
			self::ROUTE_NAMESPACE,
			'/auto-share',
			array(
				array(
					'methods'             => 'GET',
					'callback'            => array( self::class, 'auto_share' ),
					'permission_callback' => $can_compose,
				),
				array(
					'methods'             => 'POST',
					'callback'            => array( self::class, 'save_auto_share' ),
					'permission_callback' => $can_compose,
					'args'                => array(
						'enabled'    => array(
							'type'     => 'boolean',
							'required' => true,
						),
						'accountIds' => array(
							'type'     => 'array',
							'items'    => array(
								'type'      => 'string',
								'minLength' => 1,
							),
							'default'  => array(),
							'maxItems' => Draft::MAX_CHANNELS,
						),
						'template'   => array(
							'type'    => 'string',
							'default' => '',
						),
						'image'      => array(
							'type'    => 'boolean',
							'default' => true,
						),
						'when'       => array(
							'type'    => 'string',
							'enum'    => array( Schedule_Time::NEXT, Schedule_Time::NOW ),
							'default' => Schedule_Time::NEXT,
						),
						'postTypes'  => array(
							'type'    => 'array',
							'items'   => array( 'type' => 'string' ),
							'default' => array(),
						),
					),
				),
			)
		);

		register_rest_route(
			self::ROUTE_NAMESPACE,
			'/auto-share/article',
			array(
				'methods'             => 'POST',
				'callback'            => array( self::class, 'auto_share_article' ),
				'permission_callback' => $can_compose,
				'args'                => array(
					'postId'  => array(
						'type'     => 'integer',
						'required' => true,
						'minimum'  => 1,
					),
					'enabled' => array(
						'type'     => 'boolean',
						'required' => true,
					),
				),
			)
		);

		register_rest_route(
			self::ROUTE_NAMESPACE,
			'/disconnect',
			array(
				'methods'             => 'POST',
				'callback'            => array( self::class, 'disconnect' ),
				'permission_callback' => $can_compose,
			)
		);
	}

	/**
	 * Who may use the composer: anyone who can write posts.
	 */
	public static function can_compose(): bool {
		return current_user_can( 'edit_posts' );
	}

	/**
	 * Schema for a list of channel ids.
	 */
	private static function account_ids_arg(): array {
		return array(
			'type'     => 'array',
			'items'    => array(
				'type'      => 'string',
				'minLength' => 1,
			),
			'required' => true,
			'minItems' => 1,
			'maxItems' => Draft::MAX_CHANNELS,
		);
	}

	/**
	 * Schema for the channels a post goes to, each either using the main post
	 * (`synced`) or carrying its own text and image.
	 */
	private static function channels_arg(): array {
		return array(
			'type'     => 'array',
			'required' => true,
			'minItems' => 1,
			'maxItems' => Draft::MAX_CHANNELS,
			'items'    => array(
				'type'                 => 'object',
				'additionalProperties' => false,
				'properties'           => array(
					'accountId'    => array(
						'type'      => 'string',
						'minLength' => 1,
						'required'  => true,
					),
					'synced'       => array(
						'type'    => 'boolean',
						'default' => true,
					),
					'text'         => array(
						'type'    => 'string',
						'default' => '',
					),
					'attachmentId' => array(
						'type'    => 'integer',
						'minimum' => 0,
						'default' => 0,
					),
					'altText'      => array(
						'type'      => 'string',
						'maxLength' => 2000,
						'default'   => '',
					),
				),
			),
		);
	}

	/**
	 * `GET oauth-client`: this site's OAuth client metadata (CIMD).
	 */
	public static function oauth_client(): WP_REST_Response {
		$response = new WP_REST_Response( OAuth::client_document() );
		$response->header( 'Cache-Control', 'public, max-age=3600' );
		return $response;
	}

	/**
	 * `GET status`: whether the user is connected, and to which workspace.
	 *
	 * @param WP_REST_Request $request Request.
	 */
	public static function status( WP_REST_Request $request ): WP_REST_Response {
		return new WP_REST_Response( self::status_payload( get_current_user_id(), (string) $request['returnTo'] ) );
	}

	/**
	 * What `GET status` answers. Also embedded in the editor and admin pages,
	 * so the composer starts without asking (see Admin::enqueue_build).
	 *
	 * @param int    $user_id   WordPress user id.
	 * @param string $return_to Where connecting should come back to.
	 */
	public static function status_payload( int $user_id, string $return_to ): array {
		$connection = Token_Store::get( $user_id );
		$return_to  = wp_validate_redirect( esc_url_raw( $return_to ), Admin::page_url() );
		$problems   = $connection ? array() : OAuth::connect_problems();

		return array(
			'connected'    => (bool) $connection,
			'organization' => $connection ? ( $connection['organization'] ?? null ) : null,
			'appUrl'       => Config::base_url(),
			'autoShareUrl' => Admin::auto_share_url(),
			'connectUrl'   => $problems ? null : OAuth::start_url( $return_to ),
			'problems'     => array_values( $problems ),
			'notice'       => Notices::pop( $user_id ),
			// Unsent drafts are kept in the browser, which is shared by
			// every site on a domain (subdirectory multisite) and every
			// user of the machine; this keeps theirs apart.
			'draftScope'   => get_current_blog_id() . '-' . $user_id,
		);
	}

	/**
	 * `GET channels`: the channels to offer, and the workspace's timezone.
	 *
	 * @return WP_REST_Response|WP_Error
	 */
	public static function channels() {
		$connection = Token_Store::get( get_current_user_id() );
		if ( ! $connection ) {
			return OAuth::not_connected();
		}
		$api      = Api::for_current_user();
		$channels = Workspace::channels( $api );
		if ( is_wp_error( $channels ) ) {
			return $channels;
		}
		return new WP_REST_Response(
			array(
				'channels' => $channels,
				'timezone' => Workspace::timezone( $api, (string) ( $connection['organization']['id'] ?? '' ) ),
			)
		);
	}

	/**
	 * `GET next-slot`: the soonest free slot for these channels.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function next_slot( WP_REST_Request $request ) {
		if ( ! Token_Store::get( get_current_user_id() ) ) {
			return OAuth::not_connected();
		}
		$slot = Workspace::next_slot( Api::for_current_user(), self::account_ids( $request ) );
		if ( is_wp_error( $slot ) ) {
			return $slot;
		}
		return new WP_REST_Response( array( 'at' => $slot ) );
	}

	/**
	 * `POST send`: check the request, work out when, and hand it to the
	 * Sender; then remember what it made on the article.
	 *
	 * The "next free slot" is resolved here, at send time, rather than taken
	 * from what the panel showed, so it is still free when the post lands.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function send( WP_REST_Request $request ) {
		$user_id    = get_current_user_id();
		$connection = Token_Store::get( $user_id );
		if ( ! $connection ) {
			return OAuth::not_connected();
		}

		$draft   = Draft::from_input(
			array(
				'text'         => $request['text'],
				'attachmentId' => $request['attachmentId'],
				'altText'      => $request['altText'],
			),
			(array) $request['channels']
		);
		$problem = $draft->problem();
		if ( null !== $problem ) {
			return new WP_Error( 'orbitwrite_invalid', $problem, array( 'status' => 400 ) );
		}

		$post_id = (int) $request['postId'];
		if ( $post_id && ! current_user_can( 'edit_post', $post_id ) ) {
			return new WP_Error( 'orbitwrite_forbidden', __( 'You can\'t share this post.', 'orbitwrite' ), array( 'status' => 403 ) );
		}
		foreach ( $draft->attachment_ids() as $attachment_id ) {
			if ( ! self::may_attach( $attachment_id, $post_id ) ) {
				return new WP_Error( 'orbitwrite_forbidden', __( 'You can\'t attach that image.', 'orbitwrite' ), array( 'status' => 403 ) );
			}
		}

		$organization_id = (string) ( $connection['organization']['id'] ?? '' );
		$api             = new Api( $user_id );
		$timezone        = Workspace::timezone( $api, $organization_id );
		$schedule        = Schedule_Time::resolve(
			(string) $request['when'],
			(string) $request['at'],
			$timezone,
			new DateTimeImmutable( 'now', new DateTimeZone( 'UTC' ) ),
			static function () use ( $api, $draft ) {
				return Workspace::next_slot( $api, $draft->account_ids() );
			}
		);
		if ( is_wp_error( $schedule ) ) {
			return $schedule;
		}

		$title = $post_id ? wp_specialchars_decode( get_the_title( $post_id ), ENT_QUOTES ) : '';
		$sent  = ( new Sender( $api, $organization_id ) )->send( $draft, $schedule, $title );
		if ( is_wp_error( $sent ) ) {
			return $sent;
		}

		$records = Shares::records_for( $sent['result'], $sent['entries'], $schedule, $user_id, $organization_id );
		if ( $post_id ) {
			Shares::add( $post_id, $records );
		}
		return new WP_REST_Response(
			array( 'shares' => self::present( $records, $connection ) ),
			201
		);
	}

	/**
	 * Records as the composer sees them.
	 *
	 * @param array[]    $records    Records.
	 * @param array|null $connection The user's connection, if any.
	 */
	private static function present( array $records, ?array $connection ): array {
		$organization = $connection['organization'] ?? null;
		return array_values(
			array_map(
				static function ( $record ) use ( $organization ) {
					return Shares::present( $record, $organization );
				},
				$records
			)
		);
	}

	/**
	 * `GET shares`: what was sent from an article, with fresh statuses.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function shares( WP_REST_Request $request ) {
		$post_id = (int) $request['postId'];
		if ( ! current_user_can( 'edit_post', $post_id ) ) {
			return new WP_Error( 'orbitwrite_forbidden', __( 'You can\'t view this post.', 'orbitwrite' ), array( 'status' => 403 ) );
		}
		$connection = Token_Store::get( get_current_user_id() );
		$records    = $connection
			? Shares::refresh( Api::for_current_user(), $post_id, (string) ( $connection['organization']['id'] ?? '' ) )
			: Shares::all( $post_id );
		$records    = array_filter(
			$records,
			static function ( $record ) {
				return 'deleted' !== ( $record['status'] ?? '' );
			}
		);
		return new WP_REST_Response(
			array(
				'shares'    => self::present( array_reverse( $records ), $connection ),
				'autoShare' => Auto_Share::article_state( $post_id, get_current_user_id() ),
				// For the times shown outside the composer, which has its own.
				'timezone'  => $connection ? Workspace::timezone( Api::for_current_user(), (string) ( $connection['organization']['id'] ?? '' ) ) : null,
			)
		);
	}

	/**
	 * `GET share-numbers`: how an article's published posts did, newest
	 * first, at most ten of them.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function share_numbers( WP_REST_Request $request ) {
		$post_id = (int) $request['postId'];
		if ( ! current_user_can( 'edit_post', $post_id ) ) {
			return new WP_Error( 'orbitwrite_forbidden', __( 'You can\'t view this post.', 'orbitwrite' ), array( 'status' => 403 ) );
		}
		$connection = Token_Store::get( get_current_user_id() );
		if ( ! $connection ) {
			return OAuth::not_connected();
		}
		$group_ids = array();
		foreach ( array_reverse( Shares::all( $post_id ) ) as $record ) {
			if ( 'published' === ( $record['status'] ?? '' ) && ! empty( $record['group_ids'][0] ) ) {
				$group_ids[] = (string) $record['group_ids'][0];
			}
		}
		$numbers = Analytics::post_numbers(
			Api::for_current_user(),
			(string) ( $connection['organization']['id'] ?? '' ),
			array_slice( $group_ids, 0, 10 )
		);
		// Kept on the article too, for the Posts list's Social column.
		Shares::store_numbers( $post_id, $numbers );
		// An empty map must stay a JSON object.
		return new WP_REST_Response( array( 'numbers' => (object) $numbers ) );
	}

	/**
	 * `GET analytics`: the workspace's last four weeks.
	 *
	 * @return WP_REST_Response|WP_Error
	 */
	public static function analytics() {
		$connection = Token_Store::get( get_current_user_id() );
		if ( ! $connection ) {
			return OAuth::not_connected();
		}
		$summary = Analytics::summary( Api::for_current_user(), $connection['organization'] ?? null );
		if ( is_wp_error( $summary ) ) {
			return $summary;
		}
		return new WP_REST_Response( $summary );
	}

	/**
	 * `GET auto-share`: the person's auto-share settings, and what they can
	 * pick from besides channels.
	 */
	public static function auto_share(): WP_REST_Response {
		$user_id    = get_current_user_id();
		$connection = Token_Store::get( $user_id );
		$settings   = Auto_Share::get( $user_id );
		$org_id     = $connection ? (string) ( $connection['organization']['id'] ?? '' ) : '';
		$post_types = array();
		foreach ( Admin::post_types() as $name ) {
			$object       = get_post_type_object( $name );
			$post_types[] = array(
				'name'  => $name,
				'label' => $object ? (string) $object->labels->name : $name,
			);
		}
		return new WP_REST_Response(
			array(
				'settings'        => Auto_Share::present( $settings ),
				// Saved against another workspace: its channels aren't these.
				'otherWorkspace'  => '' !== $settings['organization_id'] && '' !== $org_id && $settings['organization_id'] !== $org_id,
				'postTypes'       => $post_types,
				'tags'            => Template::TAGS,
				'defaultTemplate' => Template::DEFAULT,
				// The preview's article, filled in the way a share would be.
				'sample'          => Auto_Share::sample( $user_id ),
			)
		);
	}

	/**
	 * `POST auto-share`: save the person's auto-share settings.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function save_auto_share( WP_REST_Request $request ) {
		$user_id    = get_current_user_id();
		$connection = Token_Store::get( $user_id );
		if ( ! $connection ) {
			return OAuth::not_connected();
		}
		$settings = Auto_Share::validate(
			array(
				'enabled'    => $request['enabled'],
				'accountIds' => $request['accountIds'],
				'template'   => $request['template'],
				'image'      => $request['image'],
				'when'       => $request['when'],
				'postTypes'  => $request['postTypes'],
			),
			Admin::post_types()
		);
		if ( is_wp_error( $settings ) ) {
			return $settings;
		}
		Auto_Share::save( $user_id, $settings, (string) ( $connection['organization']['id'] ?? '' ) );
		return new WP_REST_Response( array( 'settings' => Auto_Share::present( Auto_Share::get( $user_id ) ) ) );
	}

	/**
	 * `POST auto-share/article`: opt an article out of auto-share, or back in.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function auto_share_article( WP_REST_Request $request ) {
		$post_id = (int) $request['postId'];
		if ( ! current_user_can( 'edit_post', $post_id ) ) {
			return new WP_Error( 'orbitwrite_forbidden', __( 'You can\'t change this post.', 'orbitwrite' ), array( 'status' => 403 ) );
		}
		Auto_Share::set_enabled( $post_id, (bool) $request['enabled'] );
		return new WP_REST_Response( array( 'autoShare' => Auto_Share::article_state( $post_id, get_current_user_id() ) ) );
	}

	/**
	 * `POST discard`: delete a post that hasn't gone out. Orbitwrite refuses
	 * (409) once anything in it has published.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function discard( WP_REST_Request $request ) {
		$post_id  = (int) $request['postId'];
		$group_id = (string) $request['groupId'];
		if ( $post_id && ! current_user_can( 'edit_post', $post_id ) ) {
			return new WP_Error( 'orbitwrite_forbidden', __( 'You can\'t change this post.', 'orbitwrite' ), array( 'status' => 403 ) );
		}
		if ( $post_id && ! Shares::has( $post_id, $group_id ) ) {
			return new WP_Error( 'orbitwrite_not_found', __( 'That post wasn\'t sent from this article.', 'orbitwrite' ), array( 'status' => 404 ) );
		}
		if ( ! Token_Store::get( get_current_user_id() ) ) {
			return OAuth::not_connected();
		}
		$result = Api::for_current_user()->post( '/posts/discard', Post_Builder::discard_body( $group_id ) );
		if ( is_wp_error( $result ) ) {
			return $result;
		}
		if ( $post_id ) {
			Shares::remove( $post_id, $group_id );
		}
		return new WP_REST_Response( array( 'deleted' => true ) );
	}

	/**
	 * `POST disconnect`: revoke and forget the user's connection.
	 */
	public static function disconnect(): WP_REST_Response {
		OAuth::disconnect( get_current_user_id() );
		return new WP_REST_Response( array( 'connected' => false ) );
	}

	/**
	 * The request's channel ids, unique.
	 *
	 * @param WP_REST_Request $request Request.
	 */
	private static function account_ids( WP_REST_Request $request ): array {
		return array_values( array_unique( array_map( 'strval', (array) $request['accountIds'] ) ) );
	}

	/**
	 * Whether the user may send this attachment: one they can see, and then
	 * any Media Library image for someone who can upload (the library shows
	 * them all), or the article's own featured image. Seeing it matters for
	 * the featured image too, which anyone editing an article can point at
	 * any attachment id.
	 *
	 * @param int $attachment_id Attachment.
	 * @param int $post_id       Article, or 0.
	 */
	private static function may_attach( int $attachment_id, int $post_id ): bool {
		if ( 'attachment' !== get_post_type( $attachment_id ) || ! current_user_can( 'read_post', $attachment_id ) ) {
			return false;
		}
		if ( current_user_can( 'upload_files' ) ) {
			return true;
		}
		return $post_id && (int) get_post_thumbnail_id( $post_id ) === $attachment_id;
	}
}
