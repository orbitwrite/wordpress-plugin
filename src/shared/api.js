/**
 * The plugin's own REST routes. The browser never talks to Orbitwrite
 * directly: WordPress holds the token and makes every call.
 */
import apiFetch from '@wordpress/api-fetch';
import { addQueryArgs } from '@wordpress/url';

const BASE = '/orbitwrite/v1';

export const getStatus = ( returnTo ) =>
	apiFetch( { path: addQueryArgs( `${ BASE }/status`, { returnTo } ) } );

export const getChannels = () => apiFetch( { path: `${ BASE }/channels` } );

export const getNextSlot = ( accountIds ) =>
	apiFetch( { path: addQueryArgs( `${ BASE }/next-slot`, { accountIds } ) } );

export const send = ( data ) =>
	apiFetch( { path: `${ BASE }/send`, method: 'POST', data } );

export const getShares = ( postId ) =>
	apiFetch( { path: addQueryArgs( `${ BASE }/shares`, { postId } ) } );

export const discard = ( postId, groupId ) =>
	apiFetch( {
		path: `${ BASE }/discard`,
		method: 'POST',
		data: { postId, groupId },
	} );

export const getShareNumbers = ( postId ) =>
	apiFetch( {
		path: addQueryArgs( `${ BASE }/share-numbers`, { postId } ),
	} );

export const getAnalytics = () => apiFetch( { path: `${ BASE }/analytics` } );

export const getAutoShare = () => apiFetch( { path: `${ BASE }/auto-share` } );

export const saveAutoShare = ( data ) =>
	apiFetch( { path: `${ BASE }/auto-share`, method: 'POST', data } );

export const setArticleAutoShare = ( postId, enabled ) =>
	apiFetch( {
		path: `${ BASE }/auto-share/article`,
		method: 'POST',
		data: { postId, enabled },
	} );

export const disconnect = () =>
	apiFetch( { path: `${ BASE }/disconnect`, method: 'POST' } );

/**
 * Whether an error means the user has to (re)connect.
 *
 * @param {{code?: string}} error
 * @return {boolean} Whether.
 */
export const isNotConnected = ( error ) =>
	error?.code === 'orbitwrite_not_connected';
