/**
 * What the mock Orbitwrite answers with. Shapes follow
 * openapi/orbitwrite.json (the contract test validates them); values follow
 * Orbitwrite's real rules for each network.
 */

const account = ( fields ) => ( {
	avatarUrl: null,
	profileUrl: null,
	needsReconnect: false,
	inboxReconnectNeeded: false,
	defaultSelected: false,
	disconnected: false,
	isPremium: false,
	canShareToInstagram: null,
	autoEngagementDefaults: null,
	...fields,
} );

export const ACCOUNTS = [
	account( {
		id: 'acc_x',
		platform: 'twitter',
		handle: 'acme',
		displayName: 'Acme on X',
		defaultSelected: true,
	} ),
	account( {
		id: 'acc_bsky',
		platform: 'bluesky',
		handle: 'acme.bsky.social',
		displayName: 'Acme',
		defaultSelected: true,
	} ),
	account( {
		id: 'acc_ig',
		platform: 'instagram',
		handle: 'acme.ig',
		displayName: 'Acme Studio',
	} ),
	account( {
		id: 'acc_tiktok',
		platform: 'tiktok',
		handle: 'acme.tt',
		displayName: 'Acme Clips',
	} ),
	account( {
		id: 'acc_li',
		platform: 'linkedin_personal',
		handle: 'acme',
		displayName: 'Acme Ltd',
		needsReconnect: true,
	} ),
	account( {
		id: 'acc_old',
		platform: 'mastodon',
		handle: 'acme@mastodon.social',
		displayName: 'Old',
		disconnected: true,
	} ),
];

const media = ( fields ) => ( {
	maxItems: 4,
	required: false,
	mimeTypes: [ 'image/jpeg', 'image/png', 'image/gif', 'image/webp' ],
	image: { maxBytes: 5_000_000, maxGifBytes: null },
	video: null,
	externalGifs: false,
	gifExclusive: null,
	aspectRatio: null,
	document: null,
	...fields,
} );

const platform = ( fields ) => ( {
	threads: false,
	formats: [],
	polls: {
		minOptions: 2,
		maxOptions: 4,
		optionMaxChars: 25,
		minDurationMinutes: 5,
		maxDurationMinutes: 10080,
	},
	quotes: false,
	replies: false,
	linkPreviews: true,
	replySettings: [],
	options: null,
	aiLabel: null,
	...fields,
} );

const text = ( maxChars, unit = 'chars', extra = {} ) => ( {
	maxChars,
	unit,
	premiumMaxChars: null,
	premiumLabel: null,
	withMediaMaxChars: null,
	commentMaxChars: null,
	...extra,
} );

export const PLATFORMS = [
	platform( {
		platform: 'twitter',
		name: 'X',
		text: text( 280, 'chars', {
			premiumMaxChars: 25000,
			premiumLabel: 'X Premium',
		} ),
		threads: true,
		media: media( {
			image: { maxBytes: 5_000_000, maxGifBytes: 15_000_000 },
		} ),
	} ),
	platform( {
		platform: 'bluesky',
		name: 'Bluesky',
		text: text( 300, 'graphemes' ),
		threads: true,
		media: media( { image: { maxBytes: 2_000_000, maxGifBytes: null } } ),
	} ),
	platform( {
		platform: 'instagram',
		name: 'Instagram',
		text: text( 2200 ),
		media: media( {
			maxItems: 10,
			required: true,
			image: { maxBytes: 8_000_000, maxGifBytes: null },
			aspectRatio: { min: 0.8, max: 1.91, preferred: 1 },
		} ),
	} ),
	platform( {
		platform: 'tiktok',
		name: 'TikTok',
		text: text( 2200 ),
		media: media( {
			maxItems: 1,
			required: true,
			mimeTypes: [ 'video/mp4' ],
			image: null,
			video: {
				maxBytes: 4_000_000_000,
				maxDurationSec: 600,
				minDurationSec: 3,
				minFrameRate: 23,
				exclusive: true,
			},
		} ),
	} ),
	platform( {
		platform: 'linkedin_personal',
		name: 'LinkedIn',
		text: text( 3000 ),
		media: media( {
			maxItems: 9,
			image: { maxBytes: 36_152_320, maxGifBytes: null },
		} ),
	} ),
];

export const ME = { organization: { id: 'org_1', name: 'Acme', slug: 'acme' } };

/** `AnalyticsMetricValues`: every metric a ranked post carries. */
const METRIC_KEYS = [
	'engagements',
	'impressions',
	'reactions',
	'comments',
	'reposts',
	'quotes',
	'saves',
	'clicks',
	'profileClicks',
	'videoViews',
];

/** What Orbitwrite counts as an engagement. */
const ENGAGEMENT_KEYS = [
	'reactions',
	'comments',
	'reposts',
	'quotes',
	'saves',
];

/**
 * What each network reports on a post, as Orbitwrite stores it. Bluesky
 * reports no impressions, so a post there has none (null, not 0).
 */
const NUMBERS = {
	twitter: {
		impressions: 1180,
		reactions: 31,
		comments: 4,
		reposts: 6,
		clicks: 17,
	},
	bluesky: { reactions: 9, comments: 2, reposts: 3 },
	linkedin_personal: {
		impressions: 420,
		reactions: 12,
		comments: 1,
		clicks: 5,
	},
};

/**
 * One named post as `GET /analytics/posts?groupIds=…` gives it: each
 * channel's latest numbers summed, a metric no channel reported left null,
 * and `engagements` the sum of its parts (null when none was reported).
 *
 * @param {string}   groupId
 * @param {string[]} accountIds
 * @param {string}   postText
 * @return {Object} A top-posts entry.
 */
export function topPostFor( groupId, accountIds, postText = '' ) {
	const sum = ( key ) => {
		const reported = accountIds
			.map(
				( id ) =>
					NUMBERS[
						ACCOUNTS.find( ( item ) => item.id === id )?.platform
					]?.[ key ]
			)
			.filter( ( value ) => typeof value === 'number' );
		return reported.length
			? reported.reduce( ( total, value ) => total + value, 0 )
			: null;
	};
	const totals = Object.fromEntries(
		METRIC_KEYS.filter( ( key ) => key !== 'engagements' ).map( ( key ) => [
			key,
			sum( key ),
		] )
	);
	const parts = ENGAGEMENT_KEYS.map( ( key ) => totals[ key ] ).filter(
		( value ) => value !== null
	);
	const engagements = parts.length
		? parts.reduce( ( total, value ) => total + value, 0 )
		: null;
	return {
		groupId,
		postIds: accountIds.map( ( id ) => `${ groupId }_${ id }` ),
		text: postText,
		publishedAt: '2026-10-14T09:00:00.000Z',
		channels: accountIds.map( ( id ) => {
			const owner = ACCOUNTS.find( ( item ) => item.id === id );
			return {
				accountId: id,
				platform: owner?.platform || 'unknown',
				channel: owner?.displayName ?? null,
				platformUrl: `https://social.example/${ owner?.platform }/${ groupId }`,
			};
		} ),
		media: null,
		tags: [],
		value: engagements ?? 0,
		metrics: { engagements, ...totals },
	};
}

/** `GET /analytics/overview?days=28`. */
export const OVERVIEW = {
	from: '2026-09-16T00:00:00.000Z',
	to: '2026-10-14T00:00:00.000Z',
	historyDays: null,
	timezone: 'Europe/London',
	previous: {
		from: '2026-08-19T00:00:00.000Z',
		to: '2026-09-16T00:00:00.000Z',
	},
	posts: { current: 14, previous: 11 },
	metrics: [
		{
			metric: 'engagements',
			label: 'Engagements',
			value: 412,
			previous: 380,
			changePercent: 8.42,
		},
		{
			metric: 'impressions',
			label: 'Impressions',
			value: 18240,
			previous: 21003,
			changePercent: -13.16,
		},
		{
			metric: 'reactions',
			label: 'Reactions',
			value: 301,
			previous: 290,
			changePercent: 3.79,
		},
		{
			metric: 'comments',
			label: 'Comments',
			value: 44,
			previous: 40,
			changePercent: 10,
		},
		{
			metric: 'reposts',
			label: 'Reposts',
			value: 51,
			previous: 43,
			changePercent: 18.6,
		},
		{
			metric: 'quotes',
			label: 'Quotes',
			value: 4,
			previous: 3,
			changePercent: 33.33,
		},
		{
			metric: 'saves',
			label: 'Saves',
			value: 12,
			previous: 4,
			changePercent: 200,
		},
		{
			metric: 'clicks',
			label: 'Link clicks',
			value: 233,
			previous: 233,
			changePercent: 0,
		},
		{
			metric: 'profileClicks',
			label: 'Profile clicks',
			value: null,
			previous: null,
			changePercent: null,
		},
		{
			metric: 'videoViews',
			label: 'Video views',
			value: null,
			previous: null,
			changePercent: null,
		},
	],
};

/** `GET /analytics/posts?days=28&metric=engagements&limit=3`. */
export const TOP_POSTS = {
	from: OVERVIEW.from,
	to: OVERVIEW.to,
	historyDays: null,
	metric: 'engagements',
	entries: [
		{
			groupId: 'grp_top_1',
			postIds: [ 'post_top_1' ],
			text: 'Our autumn roadmap is out: three things shipping before December.',
			publishedAt: '2026-10-02T09:00:00.000Z',
			channels: [
				{
					accountId: 'acc_x',
					platform: 'twitter',
					channel: 'Acme on X',
					platformUrl: 'https://social.example/twitter/grp_top_1',
				},
			],
			media: null,
			tags: [],
			value: 96,
			metrics: {
				engagements: 96,
				impressions: 4210,
				reactions: 70,
				comments: 9,
				reposts: 14,
				quotes: 1,
				saves: 2,
				clicks: 58,
				profileClicks: null,
				videoViews: null,
			},
		},
	],
	nextCursor: null,
};
