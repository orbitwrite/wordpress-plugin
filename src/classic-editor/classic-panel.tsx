/**
 * "Share on Orbitwrite" on the classic editor's screen (the Classic Editor
 * plugin, or a post type without the block editor): the same composer as
 * the block editor sidebar, following the form.
 */
import Composer from '../composer';
import { useClassicArticle } from './use-classic-article';

interface Props {
	postId: number;
	permalink: string;
	status: string;
}

export default function ClassicPanel( { postId, permalink, status }: Props ) {
	const article = useClassicArticle( permalink, status );
	return <Composer postId={ postId } article={ article } />;
}
