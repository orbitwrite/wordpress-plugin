/**
 * The composer's content model: one main post, and per channel either "same
 * as main post" or that channel's own version.
 *
 * `versions` maps a channel id to `{ text, image, synced }`. A channel with no
 * entry uses the main post. Unticking "Same as main post" for the first time
 * copies the main post into the channel's version; ticking it again sets
 * `synced` back but keeps the text, so unticking once more restores what was
 * written rather than throwing it away.
 *
 * Pure, so the rules are tested without rendering anything.
 */

/**
 * Whether a channel uses its own version.
 *
 * @param {Object} versions
 * @param {string} id
 * @return {boolean} Whether.
 */
export function hasOwnVersion( versions, id ) {
	return !! versions[ id ] && ! versions[ id ].synced;
}

/**
 * What a channel will send: its own version, or the main post.
 *
 * @param {Object} main     `{ text, image }`.
 * @param {Object} versions
 * @param {string} id
 * @return {{text: string, image: Object|null}} Content.
 */
export function contentFor( main, versions, id ) {
	return hasOwnVersion( versions, id ) ? versions[ id ] : main;
}

/**
 * Give a channel its own version, starting from the main post the first time.
 *
 * @param {Object} versions
 * @param {string} id
 * @param {Object} main
 * @return {Object} Versions.
 */
export function giveOwnVersion( versions, id, main ) {
	const existing = versions[ id ];
	return {
		...versions,
		[ id ]: existing
			? { ...existing, synced: false }
			: { text: main.text, image: main.image, synced: false },
	};
}

/**
 * Put a channel back on the main post, keeping what was written for it.
 *
 * @param {Object} versions
 * @param {string} id
 * @return {Object} Versions.
 */
export function backToMainPost( versions, id ) {
	return versions[ id ]
		? { ...versions, [ id ]: { ...versions[ id ], synced: true } }
		: versions;
}

/**
 * Change a channel's own version.
 *
 * @param {Object} versions
 * @param {string} id
 * @param {Object} changes  `{ text?, image? }`.
 * @return {Object} Versions.
 */
export function editVersion( versions, id, changes ) {
	return { ...versions, [ id ]: { ...versions[ id ], ...changes } };
}

/**
 * Start a channel's own version again from the main post.
 *
 * @param {Object} versions
 * @param {string} id
 * @param {Object} main
 * @return {Object} Versions.
 */
export function copyMainPost( versions, id, main ) {
	return editVersion( versions, id, { text: main.text, image: main.image } );
}

/**
 * Whether any of these channels sends the main post.
 *
 * @param {string[]} selected
 * @param {Object}   versions
 * @return {boolean} Whether.
 */
export function mainPostInUse( selected, versions ) {
	return selected.some( ( id ) => ! hasOwnVersion( versions, id ) );
}

/**
 * The `send` request's content fields.
 *
 * @param {string[]} selected Channel ids, in the order shown.
 * @param {Object}   main
 * @param {Object}   versions
 * @return {Object} `{ text, attachmentId, altText, channels }`.
 */
export function sendPayload( selected, main, versions ) {
	return {
		text: main.text,
		attachmentId: main.image?.id || 0,
		altText: main.image?.alt || '',
		channels: selected.map( ( id ) => {
			if ( ! hasOwnVersion( versions, id ) ) {
				return { accountId: id, synced: true };
			}
			const own = versions[ id ];
			return {
				accountId: id,
				synced: false,
				text: own.text,
				attachmentId: own.image?.id || 0,
				altText: own.image?.alt || '',
			};
		} ),
	};
}
