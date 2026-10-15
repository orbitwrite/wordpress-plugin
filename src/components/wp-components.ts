/**
 * WordPress components typed as they behave, where their published types are
 * narrower than what they take.
 */
import {
	CheckboxControl as WPCheckboxControl,
	MenuItem as WPMenuItem,
} from '@wordpress/components';
import { MediaUpload as WPMediaUpload } from '@wordpress/media-utils';
import type {
	ComponentProps,
	ComponentType,
	ReactElement,
	ReactNode,
} from 'react';

import type { PickedMedia } from '../lib/media';

/** A checkbox whose label is any content, not only text: it's rendered inside the `<label>`. */
export const CheckboxControl = WPCheckboxControl as ComponentType<
	Omit< ComponentProps< typeof WPCheckboxControl >, 'label' > & {
		label?: ReactNode;
	}
>;

/** A menu item that's a link: MenuItem passes `href` on to its Button. */
export const MenuItem = WPMenuItem as ComponentType<
	ComponentProps< typeof WPMenuItem > & {
		href?: string;
		target?: string;
		rel?: string;
	}
>;

/** The Media Library modal; its published types declare no props. */
export const MediaUpload = WPMediaUpload as unknown as ComponentType< {
	allowedTypes?: string[];
	value?: number;
	onSelect: ( media: PickedMedia ) => void;
	render: ( props: { open: () => void } ) => ReactElement;
} >;
