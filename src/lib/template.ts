/**
 * The auto-share text template, filled in for the settings page's preview.
 * Pure.
 *
 * The same rules as includes/class-template.php, which fills it in for the
 * real share: tests/js/template.test.js runs the PHP tests' cases, so the
 * preview can't drift from what's sent.
 */

/** The tags a template may use. */
export const TAGS = [ 'title', 'url', 'excerpt', 'author', 'hashtags' ];

/**
 * Fill a template in. A line whose tags all came out empty is dropped, and
 * runs of blank lines fold into one.
 *
 * @param template
 * @param values   Tag => value.
 * @return Text.
 */
export function renderTemplate(
	template: string,
	values: Record< string, string | null | undefined >
): string {
	const lines: string[] = [];
	for ( const line of template.split( /\r\n|\r|\n/ ) ) {
		const filled = line.replace(
			/\{([a-z_]+)\}/g,
			( match, tag: string ) =>
				TAGS.includes( tag )
					? String( values[ tag ] ?? '' ).trim()
					: match
		);
		if ( /\{[a-z_]+\}/.test( line ) && filled.trim() === '' ) {
			continue;
		}
		lines.push( filled.replace( /\s+$/, '' ) );
	}
	return lines
		.join( '\n' )
		.replace( /\n{3,}/g, '\n\n' )
		.trim();
}

/**
 * Tags the template names that don't exist, as written.
 *
 * @param template
 * @return Unknown tag names.
 */
export function unknownTags( template: string ): string[] {
	const found = [ ...template.matchAll( /\{([^{}\s]+)\}/g ) ].map(
		( match ) => match[ 1 ]
	);
	return [ ...new Set( found.filter( ( tag ) => ! TAGS.includes( tag ) ) ) ];
}
