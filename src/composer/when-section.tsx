/**
 * When the post goes out: next free slot, a picked time, or now.
 */
import {
	Button,
	DateTimePicker,
	Dropdown,
	Notice,
	Spinner,
	// WordPress exports the segmented control under these names only
	// (still so in 7.1); it's what core's own sidebars use.
	// eslint-disable-next-line @wordpress/no-unsafe-wp-apis
	__experimentalToggleGroupControl as ToggleGroupControl,
	// eslint-disable-next-line @wordpress/no-unsafe-wp-apis
	__experimentalToggleGroupControlOption as ToggleGroupControlOption,
} from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';

import { formatWallClock } from '../lib/time';
import type { When } from '../lib/types';
import Section from './section';
import type { Schedule } from './use-schedule';

interface Props {
	panels: boolean;
	schedule: Schedule;
	/** Called with a picked wall-clock time. */
	onPick: ( at: string ) => void;
	timezone: string;
}

/**
 * The date and time picker, behind a button showing the picked time.
 *
 * @param props
 * @param props.at     The wall-clock time, or ''.
 * @param props.onPick
 */
function TimePicker( {
	at,
	onPick,
}: {
	at: string;
	onPick: ( at: string ) => void;
} ) {
	return (
		<Dropdown
			className="orbitwrite-composer__date"
			contentClassName="orbitwrite-date-popover"
			popoverProps={ { placement: 'bottom-start' } }
			renderToggle={ ( { isOpen, onToggle } ) => (
				<Button
					variant="secondary"
					onClick={ onToggle }
					aria-expanded={ isOpen }
				>
					{ at
						? formatWallClock( at )
						: __( 'Pick a date and time', 'orbitwrite' ) }
				</Button>
			) }
			renderContent={ () => (
				<DateTimePicker
					currentDate={ at || null }
					onChange={ ( value ) =>
						onPick( ( value || '' ).slice( 0, 16 ) )
					}
				/>
			) }
		/>
	);
}

export default function WhenSection( {
	panels,
	schedule,
	onPick,
	timezone,
}: Props ) {
	const { when, choose, nextSlot, at } = schedule;
	return (
		<Section
			panels={ panels }
			title={ __( 'When', 'orbitwrite' ) }
			className="orbitwrite-composer__when"
		>
			<ToggleGroupControl
				__nextHasNoMarginBottom
				__next40pxDefaultSize
				isBlock
				label={ __( 'When', 'orbitwrite' ) }
				hideLabelFromVision={ panels }
				value={ when }
				onChange={ ( next ) => choose( next as When ) }
			>
				<ToggleGroupControlOption
					value="next"
					label={ __( 'Next slot', 'orbitwrite' ) }
				/>
				<ToggleGroupControlOption
					value="at"
					label={ __( 'Pick a time', 'orbitwrite' ) }
				/>
				<ToggleGroupControlOption
					value="now"
					label={ __( 'Now', 'orbitwrite' ) }
				/>
			</ToggleGroupControl>
			{ when === 'next' && nextSlot.loading && <Spinner /> }
			{ when === 'next' && nextSlot.error && (
				<Notice status="warning" isDismissible={ false }>
					{ nextSlot.error }
				</Notice>
			) }
			{ when === 'at' && <TimePicker at={ at } onPick={ onPick } /> }
			<p className="orbitwrite-composer__zone">
				{ sprintf(
					/* translators: %s: timezone name. */
					__(
						"Times are in your workspace's timezone, %s.",
						'orbitwrite'
					),
					timezone
				) }
			</p>
		</Section>
	);
}
