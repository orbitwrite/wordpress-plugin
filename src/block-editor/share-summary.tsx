/**
 * The article's posts, one line each, with their numbers once published.
 */
import { OpenInOrbitwrite } from '../components/links';
import StatusPill from '../components/status-pill';
import type { ArticleShares } from '../hooks/use-article-shares';
import { numbersLine } from '../lib/shares';
import { formatInstant } from '../lib/time';

export default function ShareSummary( { sent, numbers }: ArticleShares ) {
	if ( ! sent.shares.length ) {
		return null;
	}
	return (
		<ul className="orbitwrite-share-summary">
			{ sent.shares.map( ( share ) => {
				const published = share.status === 'published';
				const line = published
					? numbersLine( numbers[ share.groupId ] )
					: null;
				return (
					<li key={ share.groupId }>
						<StatusPill share={ share } />
						{ share.scheduledAt &&
							! published &&
							` ${ formatInstant(
								share.scheduledAt,
								sent.timezone || 'UTC'
							) }` }
						{ line && (
							<span className="orbitwrite-share-summary__numbers">
								{ line }
							</span>
						) }
						{ share.openUrl && (
							<OpenInOrbitwrite href={ share.openUrl } />
						) }
					</li>
				);
			} ) }
		</ul>
	);
}
