/**
 * The plugin's own REST routes. The browser never talks to Orbitwrite
 * directly: WordPress holds the token and makes every call.
 */
import apiFetch from '@wordpress/api-fetch';
import { addQueryArgs } from '@wordpress/url';

import type {
	AnalyticsAnswer,
	ArticleAutoShare,
	AutoShareAnswer,
	AutoShareSettings,
	ChannelsAnswer,
	Numbers,
	Share,
	SharesAnswer,
	Status,
	When,
} from './types';

/** The send route's body. */
export interface SendRequest {
	postId: number;
	text: string;
	attachmentId: number;
	altText: string;
	channels: Array< {
		accountId: string;
		synced: boolean;
		text?: string;
		attachmentId?: number;
		altText?: string;
	} >;
	when: When;
	at: string;
}

const BASE = '/orbitwrite/v1';

export const getStatus = ( returnTo: string ) =>
	apiFetch< Status >( {
		path: addQueryArgs( `${ BASE }/status`, { returnTo } ),
	} );

export const getChannels = () =>
	apiFetch< ChannelsAnswer >( { path: `${ BASE }/channels` } );

export const getNextSlot = ( accountIds: string[] ) =>
	apiFetch< { at: string } >( {
		path: addQueryArgs( `${ BASE }/next-slot`, { accountIds } ),
	} );

export const send = ( data: SendRequest ) =>
	apiFetch< { shares: Share[] } >( {
		path: `${ BASE }/send`,
		method: 'POST',
		data,
	} );

export const getShares = ( postId: number ) =>
	apiFetch< SharesAnswer >( {
		path: addQueryArgs( `${ BASE }/shares`, { postId } ),
	} );

export const discard = ( postId: number, groupId: string ) =>
	apiFetch< { deleted: true } >( {
		path: `${ BASE }/discard`,
		method: 'POST',
		data: { postId, groupId },
	} );

export const getShareNumbers = ( postId: number ) =>
	apiFetch< { numbers: Numbers } >( {
		path: addQueryArgs( `${ BASE }/share-numbers`, { postId } ),
	} );

export const getAnalytics = () =>
	apiFetch< AnalyticsAnswer >( { path: `${ BASE }/analytics` } );

export const getAutoShare = () =>
	apiFetch< AutoShareAnswer >( { path: `${ BASE }/auto-share` } );

export const saveAutoShare = ( data: AutoShareSettings ) =>
	apiFetch< { settings: AutoShareSettings } >( {
		path: `${ BASE }/auto-share`,
		method: 'POST',
		data,
	} );

export const setArticleAutoShare = ( postId: number, enabled: boolean ) =>
	apiFetch< { autoShare: ArticleAutoShare } >( {
		path: `${ BASE }/auto-share/article`,
		method: 'POST',
		data: { postId, enabled },
	} );

export const disconnect = () =>
	apiFetch< { connected: false } >( {
		path: `${ BASE }/disconnect`,
		method: 'POST',
	} );

/**
 * Whether an error means the user has to (re)connect.
 *
 * @param error What apiFetch rejected with.
 * @return Whether.
 */
export const isNotConnected = ( error: unknown ): boolean =>
	( error as { code?: string } | null )?.code === 'orbitwrite_not_connected';

/**
 * The words of whatever apiFetch rejected with.
 *
 * @param error
 * @return Message.
 */
export const messageOf = ( error: unknown ): string =>
	String( ( error as { message?: string } | null )?.message ?? error );

/**
 * A rejection handler that tells a lost connection apart from any other
 * failure.
 *
 * @param onDisconnected Called with the error when the user has to (re)connect.
 * @param onError        Called with the words of any other error.
 * @return Handler, for `.catch()`.
 */
export const handleError =
	(
		onDisconnected: ( error: unknown ) => void,
		onError: ( message: string ) => void
	) =>
	( error: unknown ): void =>
		isNotConnected( error )
			? onDisconnected( error )
			: onError( messageOf( error ) );
