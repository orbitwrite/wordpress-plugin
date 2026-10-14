<?php
/**
 * Prints, as JSON, the requests the plugin builds for Orbitwrite, made by the
 * same functions its real call sites use, for contract.test.mjs to check
 * against the spec. Only the inputs are made up here.
 *
 * @package Orbitwrite
 */

require __DIR__ . '/../php/bootstrap.php';

use Orbitwrite\WordPress\Analytics;
use Orbitwrite\WordPress\Api;
use Orbitwrite\WordPress\Draft;
use Orbitwrite\WordPress\Media;
use Orbitwrite\WordPress\Post_Builder;
use Orbitwrite\WordPress\Sender;
use Orbitwrite\WordPress\Shares;
use Orbitwrite\WordPress\Workspace;

$uuid  = static function () {
	return '6f1c2a9e-1a2b-4c3d-8e9f-0a1b2c3d4e5f';
};
$draft = Draft::from_input(
	array(
		'text'         => 'Main post https://example.com/hello',
		'attachmentId' => 7,
		'altText'      => 'A purple banner',
	),
	array(
		array( 'accountId' => 'acc_x' ),
		array(
			'accountId' => 'acc_bsky',
			'synced'    => false,
			'text'      => 'Bluesky words',
		),
		array(
			'accountId'    => 'acc_ig',
			'synced'       => false,
			'text'         => 'Instagram words',
			'attachmentId' => 7,
		),
	)
);
$groups = Sender::content_groups( $draft, array() );
// One uploaded media id per group that carries an image, keyed however the
// Sender keys its groups.
$media_ids = array();
foreach ( $groups as $key => $group ) {
	if ( $group['content']['attachment_id'] ) {
		$media_ids[ $key ] = 'med_' . ( count( $media_ids ) + 1 );
	}
}
$entries = Sender::entries( $draft, $groups, $media_ids );
if ( 2 !== count( array_filter( array_column( $entries, 'media_id' ) ) ) ) {
	fwrite( STDERR, "Expected two channels to carry media; the contract test would check nothing.\n" );
	exit( 1 );
}
$quick   = Draft::from_input( array( 'text' => 'Now' ), array( array( 'accountId' => 'acc_x' ) ) );
$now     = Sender::entries( $quick, Sender::content_groups( $quick, array() ), array() );

$requests = array(
	array(
		'name'   => 'scheduled post, channels on the main post and on their own versions',
		'method' => 'POST',
		'path'   => '/api/v1/posts',
		'body'   => Post_Builder::build(
			$entries,
			array(
				'scheduled_at' => '2026-10-15T08:00:00Z',
				'publish_now'  => false,
			),
			'Hello world',
			$uuid
		),
	),
	array(
		'name'   => 'publish now, no image, no title',
		'method' => 'POST',
		'path'   => '/api/v1/posts',
		'body'   => Post_Builder::build(
			$now,
			array(
				'scheduled_at' => '2026-10-13T12:00:00Z',
				'publish_now'  => true,
			),
			'',
			$uuid
		),
	),
	array(
		'name'   => 'image upload',
		'method' => 'POST',
		'path'   => '/api/v1/media/create-upload-url',
		'body'   => Media::upload_request(
			array(
				'name'   => 'hero-1024x538.png',
				'mime'   => 'image/png',
				'size'   => 1761900,
				'width'  => 1024,
				'height' => 538,
			),
			'A purple banner'
		),
	),
	array(
		'name'   => 'delete',
		'method' => 'POST',
		'path'   => '/api/v1/posts/discard',
		'body'   => Post_Builder::discard_body( 'grp_1' ),
	),
	array(
		'name'   => 'next free slot',
		'method' => 'GET',
		'path'   => '/api/v1/scheduling/suggestions',
		'query'  => Api::query_string( Workspace::next_slot_query( $draft->account_ids() ) ),
	),
	array(
		'name'   => 'workspace timezone',
		'method' => 'GET',
		'path'   => '/api/v1/scheduling/suggestions',
		'query'  => Api::query_string( Workspace::timezone_query() ),
	),
	array(
		'name'   => 'status of sent posts',
		'method' => 'GET',
		'path'   => '/api/v1/posts',
		'query'  => Api::query_string( Shares::status_query( array( 'grp_1', 'grp_2', 'grp_1' ) ) ),
	),
	array(
		'name'   => 'published posts\' numbers',
		'method' => 'GET',
		'path'   => '/api/v1/analytics/posts',
		'query'  => Api::query_string( Analytics::numbers_query( array( 'grp_1', 'grp_2' ) ) ),
	),
	array(
		'name'   => 'the last four weeks',
		'method' => 'GET',
		'path'   => '/api/v1/analytics/overview',
		'query'  => Api::query_string( Analytics::overview_query() ),
	),
	array(
		'name'   => 'the last four weeks\' top posts',
		'method' => 'GET',
		'path'   => '/api/v1/analytics/posts',
		'query'  => Api::query_string( Analytics::top_posts_query() ),
	),
);

echo json_encode( $requests, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES ), "\n";
