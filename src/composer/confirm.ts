/**
 * Ask before something that can't be undone.
 *
 * @param question
 * @return Whether the person said yes.
 */
export function confirmed( question: string ): boolean {
	// eslint-disable-next-line no-alert
	return window.confirm( question );
}
