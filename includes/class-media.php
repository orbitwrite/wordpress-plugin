<?php
/**
 * Sending a Media Library image to Orbitwrite.
 *
 * @package Orbitwrite
 */

namespace Orbitwrite\WordPress;

use WP_Error;

defined( 'ABSPATH' ) || exit;

/**
 * Uploads an attachment to the workspace's media and returns its id, which
 * the post then names in `mediaIds`.
 *
 * Three steps, the way any Orbitwrite integration uploads:
 *
 *   1. `POST /media/create-upload-url` with the name, type and exact size.
 *   2. `PUT` the bytes to the signed URL it returns. The type and the length
 *      are part of the signature, so both must match what was declared.
 *   3. Name the id in the post. Orbitwrite confirms the upload arrived when
 *      the post is created.
 *
 * **Which file.** Networks cap image size (Bluesky at 2 MB) and
 * Orbitwrite refuses rather than shrinks an image over the cap, so the
 * plugin picks the largest of the attachment's own sizes (the original, then
 * WordPress's generated ones) that fits the strictest network sending it.
 *
 * The file is read from disk, never fetched over HTTP, so this works on a
 * site whose uploads aren't publicly reachable. Each upload is remembered on
 * the attachment, so sending the same file again reuses it.
 */
final class Media {

	const ALLOWED_TYPES = array( 'image/jpeg', 'image/png', 'image/gif', 'image/webp' );

	const META_KEY = '_orbitwrite_media';

	/** Remembered uploads kept per attachment. */
	const CACHE_SIZE = 10;

	/** How far a generated size's shape may stray from the original's. */
	const SHAPE_TOLERANCE = 0.02;

	/**
	 * The largest file ever sent, whatever a network would take; networks
	 * resize anyway.
	 */
	public static function max_bytes(): int {
		/**
		 * Filters the largest image the plugin uploads to Orbitwrite.
		 *
		 * @param int $bytes Byte limit.
		 */
		return (int) apply_filters( 'orbitwrite_max_image_bytes', 8 * MB_IN_BYTES );
	}

	/**
	 * Upload the best file of an attachment for the networks sending it, or
	 * reuse an earlier upload of that file.
	 *
	 * @param Api    $api             Client.
	 * @param string $organization_id Workspace the media belongs to.
	 * @param int    $attachment_id   Attachment.
	 * @param string $alt_text        Alt text to send with it.
	 * @param array  $limits          `{ max_bytes, set_by, types, types_by }`:
	 *                                the strictest byte cap (null: none) and
	 *                                the networks setting it ("Bluesky"); the
	 *                                types every network takes (null: any) and
	 *                                the networks restricting them.
	 * @param int    $send_started    When this send began (unix seconds).
	 *                                Uploads from before it are "remembered".
	 * @param bool   $fresh           Ignore remembered uploads (one was refused).
	 * @return array|WP_Error `{ id, reused }`: the Orbitwrite media id, and
	 *                        whether it was remembered from an earlier send.
	 */
	public static function upload( Api $api, string $organization_id, int $attachment_id, string $alt_text, array $limits, int $send_started, bool $fresh = false ) {
		$candidates = self::candidates( $attachment_id );
		if ( is_wp_error( $candidates ) ) {
			return $candidates;
		}
		$set_by   = (string) ( $limits['set_by'] ?? '' );
		$types    = $limits['types'] ?? null;
		$types_by = (string) ( $limits['types_by'] ?? '' );
		if ( null !== $types && ! self::pick( $candidates, PHP_INT_MAX, $types ) ) {
			return new WP_Error(
				'orbitwrite_media_type',
				$types
					? sprintf(
						/* translators: 1: network names, 2: image types such as "JPEG, PNG". */
						__( '%1$s only take %2$s images, and WordPress has no copy of this one in those types. Use a different image.', 'orbitwrite' ),
						'' !== $types_by ? $types_by : __( 'These networks', 'orbitwrite' ),
						implode( ', ', array_map( array( self::class, 'type_label' ), $types ) )
					)
					: sprintf(
						/* translators: %s: network names. */
						__( '%s don\'t share an image type, so one image can\'t go to all of them. Give one its own version with a different image.', 'orbitwrite' ),
						'' !== $types_by ? $types_by : __( 'These networks', 'orbitwrite' )
					),
				array( 'status' => 400 )
			);
		}

		$cap  = isset( $limits['max_bytes'] ) ? min( (int) $limits['max_bytes'], self::max_bytes() ) : self::max_bytes();
		$file = self::pick( $candidates, $cap, $types );
		if ( null === $file ) {
			return new WP_Error(
				'orbitwrite_media_size',
				'' !== $set_by && $cap < self::max_bytes()
					/* translators: 1: network names, 2: a size such as 2 MB. */
					? sprintf( __( 'That image is too large for %1$s, which takes up to %2$s, and WordPress has no smaller copy of it in the same shape. Use a smaller image.', 'orbitwrite' ), $set_by, size_format( $cap ) )
					/* translators: %s: a size such as 8 MB. */
					: sprintf( __( 'That image is too large to send. Use one under %s.', 'orbitwrite' ), size_format( $cap ) ),
				array( 'status' => 400 )
			);
		}

		$cache     = self::cache( $attachment_id );
		$cache_key = md5( implode( '|', array( Config::base_url(), $organization_id, $file['path'], $file['size'], (string) filemtime( $file['path'] ), $alt_text ) ) );
		$entry     = $cache[ $cache_key ] ?? null;
		// A fresh attempt distrusts only what was remembered before this send;
		// an upload made earlier in it is still good.
		if ( $entry && ! ( $fresh && $entry['at'] < $send_started ) ) {
			$cache[ $cache_key ]['used'] = time();
			update_post_meta( $attachment_id, self::META_KEY, $cache );
			return array(
				'id'     => $entry['id'],
				'reused' => $entry['at'] < $send_started,
			);
		}

		$created = $api->post( '/media/create-upload-url', self::upload_request( $file, $alt_text ) );
		if ( is_wp_error( $created ) ) {
			return $created;
		}
		if ( empty( $created['media_id'] ) || empty( $created['upload_url'] ) ) {
			return new WP_Error( 'orbitwrite_upload', __( 'Orbitwrite didn\'t return an upload address for the image.', 'orbitwrite' ), array( 'status' => 502 ) );
		}

		// phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- a local file.
		$bytes = file_get_contents( $file['path'] );
		if ( false === $bytes || strlen( $bytes ) !== $file['size'] ) {
			return new WP_Error( 'orbitwrite_upload', __( 'Couldn\'t read the image file.', 'orbitwrite' ), array( 'status' => 500 ) );
		}

		$put        = wp_remote_request(
			(string) $created['upload_url'],
			array(
				'method'  => 'PUT',
				'timeout' => 60,
				'headers' => array( 'Content-Type' => $file['mime'] ),
				'body'    => $bytes,
			)
		);
		$put_status = is_wp_error( $put ) ? 0 : (int) wp_remote_retrieve_response_code( $put );
		if ( $put_status < 200 || $put_status >= 300 ) {
			$reason = is_wp_error( $put ) ? $put->get_error_message() : sprintf( 'HTTP %d', $put_status );
			return new WP_Error(
				'orbitwrite_upload',
				/* translators: %s: the storage error. */
				sprintf( __( 'Couldn\'t upload the image to Orbitwrite: %s', 'orbitwrite' ), $reason ),
				array( 'status' => 502 )
			);
		}

		$cache[ $cache_key ] = array(
			'id'   => (string) $created['media_id'],
			'at'   => time(),
			'used' => time(),
		);
		update_post_meta( $attachment_id, self::META_KEY, self::prune( $cache ) );
		return array(
			'id'     => (string) $created['media_id'],
			'reused' => false,
		);
	}

	/**
	 * Remembered uploads for an attachment. Entries in an older shape are
	 * dropped.
	 *
	 * @param int $attachment_id Attachment.
	 */
	private static function cache( int $attachment_id ): array {
		$cache = get_post_meta( $attachment_id, self::META_KEY, true );
		return is_array( $cache )
			? array_filter(
				$cache,
				static function ( $entry ) {
					return is_array( $entry ) && isset( $entry['id'], $entry['at'] );
				}
			)
			: array();
	}

	/**
	 * Keep the most recently used remembered uploads: a file per size, alt
	 * text and workspace adds up, and the least recently used are the least
	 * likely to be wanted again.
	 *
	 * @param array $cache Remembered uploads.
	 */
	public static function prune( array $cache ): array {
		uasort(
			$cache,
			static function ( $a, $b ) {
				return ( $b['used'] ?? $b['at'] ) <=> ( $a['used'] ?? $a['at'] );
			}
		);
		return array_slice( $cache, 0, self::CACHE_SIZE, true );
	}

	/**
	 * "image/jpeg" → "JPEG".
	 *
	 * @param string $type MIME type.
	 */
	public static function type_label( string $type ): string {
		return strtoupper( (string) preg_replace( '#^image/#', '', $type ) );
	}

	/**
	 * The body of `POST /media/create-upload-url` for a file. Pure.
	 *
	 * @param array  $file     `{ name, mime, size, width, height }`.
	 * @param string $alt_text Alt text.
	 */
	public static function upload_request( array $file, string $alt_text ): array {
		$request = array(
			'name'       => (string) $file['name'],
			'mime_type'  => (string) $file['mime'],
			'size_bytes' => (int) $file['size'],
		);
		if ( '' !== trim( $alt_text ) ) {
			$request['alt_text'] = function_exists( 'mb_substr' ) ? mb_substr( $alt_text, 0, 2000 ) : substr( $alt_text, 0, 2000 );
		}
		if ( $file['width'] > 0 && $file['height'] > 0 ) {
			$request['width']  = (int) $file['width'];
			$request['height'] = (int) $file['height'];
		}
		return $request;
	}

	/**
	 * The largest file under a byte limit in an accepted type, or null when
	 * none fits. Pure.
	 *
	 * @param array[]       $candidates `{ size, width, height, mime, … }`.
	 * @param int           $max_bytes  Limit.
	 * @param string[]|null $types      Accepted types; null for any.
	 */
	public static function pick( array $candidates, int $max_bytes, ?array $types = null ): ?array {
		usort(
			$candidates,
			static function ( $a, $b ) {
				$by_area = ( $b['width'] * $b['height'] ) <=> ( $a['width'] * $a['height'] );
				return 0 !== $by_area ? $by_area : $b['size'] <=> $a['size'];
			}
		);
		foreach ( $candidates as $candidate ) {
			if ( null !== $types && ! in_array( $candidate['mime'] ?? '', $types, true ) ) {
				continue;
			}
			if ( $candidate['size'] > 0 && $candidate['size'] <= $max_bytes ) {
				return $candidate;
			}
		}
		return null;
	}

	/**
	 * Every file of an attachment that could be sent: the original (or its
	 * `-scaled` copy) and each generated size in an allowed type and the same
	 * shape. Hard-cropped sizes (thumbnails, a theme's 16:9 crop) are left
	 * out: the shape the composer checked is the original's, and that's the
	 * picture the person chose.
	 *
	 * @param int $attachment_id Attachment.
	 * @return array[]|WP_Error `[{ path, name, mime, size, width, height }]`.
	 */
	public static function candidates( int $attachment_id ) {
		$mime = (string) get_post_mime_type( $attachment_id );
		if ( ! in_array( $mime, self::ALLOWED_TYPES, true ) ) {
			return new WP_Error( 'orbitwrite_media_type', __( 'Only JPEG, PNG, GIF and WebP images can be attached.', 'orbitwrite' ), array( 'status' => 400 ) );
		}
		$path = get_attached_file( $attachment_id );
		if ( ! $path || ! is_readable( $path ) ) {
			return new WP_Error( 'orbitwrite_media_missing', __( 'The image file is missing from the server.', 'orbitwrite' ), array( 'status' => 400 ) );
		}

		$meta       = wp_get_attachment_metadata( $attachment_id );
		$meta       = is_array( $meta ) ? $meta : array();
		$width      = (int) ( $meta['width'] ?? 0 );
		$height     = (int) ( $meta['height'] ?? 0 );
		$candidates = array( self::candidate( $path, $mime, $width, $height ) );
		// An animated GIF's generated sizes are single still frames.
		if ( 'image/gif' !== $mime ) {
			foreach ( (array) ( $meta['sizes'] ?? array() ) as $size ) {
				$size_mime = (string) ( $size['mime-type'] ?? $mime );
				$size_path = path_join( dirname( $path ), (string) ( $size['file'] ?? '' ) );
				if ( empty( $size['file'] ) || ! in_array( $size_mime, self::ALLOWED_TYPES, true ) || ! is_readable( $size_path ) ) {
					continue;
				}
				if ( ! self::same_shape( $width, $height, (int) ( $size['width'] ?? 0 ), (int) ( $size['height'] ?? 0 ) ) ) {
					continue;
				}
				$candidates[] = self::candidate( $size_path, $size_mime, (int) ( $size['width'] ?? 0 ), (int) ( $size['height'] ?? 0 ) );
			}
		}
		return $candidates;
	}

	/**
	 * Whether two sizes have the same shape (unknown dimensions never do).
	 *
	 * @param int $width         Original width.
	 * @param int $height        Original height.
	 * @param int $other_width   Other width.
	 * @param int $other_height  Other height.
	 */
	public static function same_shape( int $width, int $height, int $other_width, int $other_height ): bool {
		if ( $width <= 0 || $height <= 0 || $other_width <= 0 || $other_height <= 0 ) {
			return false;
		}
		$ratio = $width / $height;
		return abs( $ratio - $other_width / $other_height ) / $ratio <= self::SHAPE_TOLERANCE;
	}

	/**
	 * One file.
	 *
	 * @param string $path   Path.
	 * @param string $mime   Type.
	 * @param int    $width  Width.
	 * @param int    $height Height.
	 */
	private static function candidate( string $path, string $mime, int $width, int $height ): array {
		return array(
			'path'   => $path,
			'name'   => wp_basename( $path ),
			'mime'   => $mime,
			'size'   => (int) filesize( $path ),
			'width'  => $width,
			'height' => $height,
		);
	}
}
