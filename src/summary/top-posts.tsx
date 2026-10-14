/**
 * The workspace's best posts of the period.
 */
import { __, _n, sprintf } from '@wordpress/i18n';

import { OpenInOrbitwrite, PlatformLinks } from '../components/links';
import { formatCount } from '../lib/numbers';
import { formatInstant } from '../lib/time';
import type { AnalyticsAnswer } from '../lib/types';

type TopPost = AnalyticsAnswer[ 'topPosts' ][ number ];

/**
 * A post's date and headline numbers, leaving out what nothing reported.
 *
 * @param post
 * @param timezone
 * @return e.g. "Thu 15 Oct, 09:00 · 38 engagements · 1,204 impressions".
 */
function postLine( post: TopPost, timezone: string ): string {
	const { engagements, impressions } = post.metrics;
	return [
		formatInstant( post.publishedAt, timezone ),
		typeof engagements === 'number'
			? sprintf(
					/* translators: %s: number. */
					_n(
						'%s engagement',
						'%s engagements',
						engagements,
						'orbitwrite'
					),
					formatCount( engagements )
			  )
			: null,
		typeof impressions === 'number'
			? sprintf(
					/* translators: %s: number. */
					_n(
						'%s impression',
						'%s impressions',
						impressions,
						'orbitwrite'
					),
					formatCount( impressions )
			  )
			: null,
	]
		.filter( Boolean )
		.join( ' · ' );
}

interface Props {
	posts: TopPost[];
	timezone: string;
}

export default function TopPosts( { posts, timezone }: Props ) {
	if ( ! posts.length ) {
		return null;
	}
	return (
		<>
			<h3>{ __( 'Top posts', 'orbitwrite' ) }</h3>
			<ol className="orbitwrite-summary__posts">
				{ posts.map( ( post ) => (
					<li key={ post.groupId || post.publishedAt }>
						<p className="orbitwrite-summary__excerpt">
							{ post.excerpt }
						</p>
						<p className="orbitwrite-summary__muted">
							{ postLine( post, timezone ) }
						</p>
						<p className="orbitwrite-composer__row">
							<PlatformLinks links={ post.links } />
							{ post.openUrl && (
								<OpenInOrbitwrite href={ post.openUrl } />
							) }
						</p>
					</li>
				) ) }
			</ol>
		</>
	);
}
