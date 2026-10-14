/**
 * What the plugin's REST routes answer (includes/class-rest.php), and the
 * composer's own shapes built from them.
 */

/** A WP_Error as apiFetch rejects with it. */
export interface RestError {
	code: string;
	message: string;
	data?: { status: number };
}

export interface Organization {
	id: string;
	name: string;
	slug: string;
}

/** A notice to show: one the connect flow left, or a send's confirmation. */
export interface Notice {
	type: 'success' | 'error' | 'warning';
	message: string;
	openUrl?: string | null;
}

/** The status route, also handed over as `window.orbitwriteBoot.status`. */
export interface Status {
	connected: boolean;
	organization: Organization | null;
	appUrl: string;
	autoShareUrl: string;
	connectUrl: string | null;
	problems: string[];
	notice: Notice | null;
	draftScope: string;
}

export interface MediaRules {
	required: boolean;
	images: boolean;
	/** Null when any type goes. */
	imageTypes: string[] | null;
	imageMaxBytes: number | null;
	gifMaxBytes: number | null;
	aspectRatio: AspectRange | null;
}

export interface AspectRange {
	min: number | null;
	max: number | null;
}

export interface Channel {
	id: string;
	platform: string;
	platformName: string;
	handle: string | null;
	displayName: string | null;
	avatarUrl: string | null;
	needsReconnect: boolean;
	defaultSelected: boolean;
	maxChars: number | null;
	withMediaMaxChars: number | null;
	/** `chars` or `graphemes`. */
	unit: string;
	media: MediaRules;
}

export interface ChannelsAnswer {
	channels: Channel[];
	timezone: string;
}

export interface PlatformLink {
	platform: string;
	handle: string | null;
	url: string;
}

/** A post sent to Orbitwrite from an article. */
export interface Share {
	groupId: string;
	accountIds: string[];
	ownVersion: boolean;
	scheduledAt: string | null;
	publishNow: boolean;
	/** `scheduled`, `publishing`, `published`, `draft`, `planned`, `pending_approval`… */
	status: string;
	/** `needs_approval`, `needs_revision`, or another of Orbitwrite's. */
	bucket: string | null;
	lastError: string | null;
	links: PlatformLink[];
	excerpt: string;
	openUrl: string | null;
	canDelete: boolean;
}

/** What auto-share will do, or did, with one article. */
export interface ArticleAutoShare {
	pending: boolean;
	enabled: boolean;
	isAuthor: boolean;
	authorName: string;
	when: 'next' | 'now';
	channels: number;
	state: 'queued' | 'sending' | 'sent' | 'failed' | 'skipped' | null;
	error: string | null;
}

export interface SharesAnswer {
	shares: Share[];
	autoShare: ArticleAutoShare | null;
	timezone: string | null;
}

/** A published post's numbers. Null means nothing reported it. */
export interface Totals {
	impressions: number | null;
	reactions: number | null;
	comments: number | null;
	reposts: number | null;
	clicks: number | null;
}

/** Numbers by Orbitwrite post (group) id. */
export type Numbers = Record< string, Totals >;

export interface Metric {
	value: number | null;
	previous: number | null;
	changePercent: number | null;
}

export interface AnalyticsAnswer {
	overview: {
		from: string;
		to: string;
		timezone: string;
		historyDays: number | null;
		hasPrevious: boolean;
		posts: { value: number; previous: number | null };
		metrics: Partial< Record< string, Metric > >;
	};
	topPosts: Array< {
		groupId: string;
		excerpt: string;
		publishedAt: string;
		metrics: {
			engagements: number | null;
			impressions: number | null;
			clicks: number | null;
		};
		links: PlatformLink[];
		openUrl: string | null;
	} >;
	analyticsUrl: string | null;
}

export interface AutoShareSettings {
	enabled: boolean;
	accountIds: string[];
	template: string;
	image: boolean;
	when: 'next' | 'now';
	postTypes: string[];
}

export interface AutoShareAnswer {
	settings: AutoShareSettings;
	otherWorkspace: boolean;
	postTypes: Array< { name: string; label: string } >;
	tags: string[];
	defaultTemplate: string;
	sample: { title: string; values: Record< string, string > } | null;
}

export type When = 'next' | 'at' | 'now';

/** An image picked for a post. */
export interface Image {
	id: number;
	url: string;
	alt: string;
	mime: string;
	width: number;
	height: number;
}

/** What a channel sends: the main post, or its own version. */
export interface Content {
	text: string;
	image: Image | null;
}

/** A channel's own version. `synced` puts it back on the main post. */
export interface Version extends Content {
	synced: boolean;
}

/** Own versions by channel id. */
export type Versions = Record< string, Version >;

/** The article the composer is for, read from whichever editor. */
export interface Article {
	title: string;
	link: string;
	status: string;
	featured: Image | null;
}

declare global {
	interface Window {
		orbitwriteBoot?: { status?: Status };
	}
}
