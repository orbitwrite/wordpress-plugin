/**
 * Whole objects for the tests, so each test only spells out what it's about.
 */
import type {
	ArticleAutoShare,
	Channel,
	Image,
	MediaRules,
	Share,
} from '../../src/shared/types';

export const media = ( fields: Partial< MediaRules > = {} ): MediaRules => ( {
	required: false,
	images: true,
	imageTypes: null,
	imageMaxBytes: 5000000,
	gifMaxBytes: null,
	aspectRatio: null,
	...fields,
} );

export const channel = ( fields: Partial< Channel > = {} ): Channel => ( {
	id: 'acc_1',
	platform: 'twitter',
	platformName: 'X',
	handle: null,
	displayName: null,
	avatarUrl: null,
	needsReconnect: false,
	defaultSelected: false,
	maxChars: null,
	withMediaMaxChars: null,
	unit: 'chars',
	media: media(),
	...fields,
} );

export const image = ( fields: Partial< Image > = {} ): Image => ( {
	id: 7,
	url: 'a.png',
	alt: '',
	mime: '',
	width: 0,
	height: 0,
	...fields,
} );

export const share = ( fields: Partial< Share > = {} ): Share => ( {
	groupId: 'grp_1',
	accountIds: [],
	ownVersion: false,
	scheduledAt: null,
	publishNow: false,
	status: 'scheduled',
	bucket: null,
	lastError: null,
	links: [],
	excerpt: '',
	openUrl: null,
	canDelete: true,
	...fields,
} );

export const autoShare = (
	fields: Partial< ArticleAutoShare > = {}
): ArticleAutoShare => ( {
	pending: false,
	enabled: false,
	isAuthor: true,
	authorName: '',
	when: 'next',
	channels: 0,
	state: null,
	error: null,
	...fields,
} );
