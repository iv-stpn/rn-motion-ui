import type { Meta, StoryObj } from '@storybook/react';
import { View } from 'react-native';
import { expect, fn, userEvent, within } from 'storybook/test';
import { Check, Clock3, Pin, Trash2 } from '../../lib/icons';
import { SWIPE_TONE_ICON_COLOR, type SwipeAction, SwipeableList, type SwipeableListItem } from './swipeable-list';

// -- Shared story data -------------------------------------------------------

const leftActions: SwipeAction[] = [
  {
    id: 'done',
    label: 'Done',
    icon: <Check size={16} color={SWIPE_TONE_ICON_COLOR.success} />,
    tone: 'success',
  },
  {
    id: 'pin',
    label: 'Pin',
    icon: <Pin size={16} color={SWIPE_TONE_ICON_COLOR.primary} />,
    tone: 'primary',
  },
];

const rightActions: SwipeAction[] = [
  {
    id: 'later',
    label: 'Later',
    icon: <Clock3 size={16} color={SWIPE_TONE_ICON_COLOR.warning} />,
    tone: 'warning',
  },
  {
    id: 'trash',
    label: 'Trash',
    icon: <Trash2 size={16} color={SWIPE_TONE_ICON_COLOR.danger} />,
    tone: 'danger',
  },
];

const defaultItems: SwipeableListItem[] = [
  {
    id: 'brief',
    title: 'Launch brief',
    description: 'Finalize the announcement copy',
    meta: '9:41',
    leftActions,
    rightActions,
  },
  {
    id: 'feedback',
    title: 'Client feedback',
    description: 'Three comments need a response',
    meta: '11:08',
    leftActions,
    rightActions,
  },
  {
    id: 'review',
    title: 'Design review',
    description: 'Check spacing before handoff',
    meta: '13:20',
    leftActions,
    rightActions,
  },
  {
    id: 'incident',
    title: 'Flagged run',
    description: 'Retry queue has one failed job',
    meta: 'Now',
    leftActions,
    rightActions,
  },
];

// -- Meta --------------------------------------------------------------------

const meta = {
  title: 'Components/SwipeableList',
  component: SwipeableList,
  parameters: { layout: 'padded' },
  args: {
    items: defaultItems,
    onAction: fn(),
    actionWidth: 56,
    revealThreshold: 34,
    closeOnAction: true,
  },
} satisfies Meta<typeof SwipeableList>;

type Story = StoryObj<typeof meta>;
export default meta;

// -- Stories -----------------------------------------------------------------

/**
 * Default story: 4 items with left (Done/Pin) and right (Later/Trash) actions.
 * Swipe gesture is hard to simulate in play, so we verify items render correctly.
 */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify each item renders with its title text.
    await expect(await canvas.findByText('Launch brief')).toBeTruthy();
    await expect(await canvas.findByText('Client feedback')).toBeTruthy();
    await expect(await canvas.findByText('Design review')).toBeTruthy();
    await expect(await canvas.findByText('Flagged run')).toBeTruthy();
  },
};

/**
 * WithAction: same items but with an onAction handler spy. We directly press a
 * revealed action button (buttons are always in the DOM even before swiping,
 * so they can be triggered by aria-label in storybook tests).
 */
export const WithAction: Story = {
  render: (args) => (
    <View style={{ width: '100%' }}>
      <SwipeableList {...args} />
    </View>
  ),
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    // Action buttons are rendered in the DOM (behind the surface); accessible by label.
    // We find the first "Trash" button and press it.
    const trashButtons = await canvas.findAllByRole('button', { name: 'Trash' });
    await expect(trashButtons.length).toBeGreaterThan(0);

    // Pressing the button should call onAction.
    const firstTrash = trashButtons[0];
    if (firstTrash) {
      await userEvent.click(firstTrash);
      // Give event handlers a tick.
      await new Promise((r) => setTimeout(r, 50));
      await expect(args.onAction).toHaveBeenCalled();
    }
  },
};
