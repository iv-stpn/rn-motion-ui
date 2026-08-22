import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { View } from 'react-native';
import { CheckLine as Check } from 'rn-motion-ui-icons/icons/check-line';
import { ClockLine as Clock3 } from 'rn-motion-ui-icons/icons/clock-line';
import { Delete2Line as Trash2 } from 'rn-motion-ui-icons/icons/delete-2-line';
import { PinLine as Pin } from 'rn-motion-ui-icons/icons/pin-line';
import { expect, fn, userEvent, within } from 'storybook/test';
import { ELEVATION_KEYS, ELEVATIONS, type ElevationKey } from '../../../__stories__/story-elevations';
import { Choice, ControlCard, Playground } from '../../../__stories__/story-harness';
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
  title: 'Display/SwipeableList',
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

function SwipeableListPlayground() {
  const [elevationKey, setElevationKey] = useState<ElevationKey>('3');

  return (
    <Playground>
      <ControlCard title="Options">
        <Choice label="Elevation" onChange={setElevationKey} options={ELEVATION_KEYS} value={elevationKey} />
      </ControlCard>
      <SwipeableList
        actionWidth={56}
        closeOnAction={true}
        elevation={ELEVATIONS[elevationKey]}
        items={defaultItems}
        revealThreshold={34}
      />
    </Playground>
  );
}

/**
 * Default story: 4 items with left (Done/Pin) and right (Later/Trash) actions.
 * Swipe gesture is hard to simulate in play, so we verify items render correctly.
 */
export const Interactive: Story = {
  render: () => <SwipeableListPlayground />,
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
  name: 'Demo: Trigger an action',
  render: (args) => (
    <View className="w-full">
      <SwipeableList {...args} testID="story-swipe" />
    </View>
  ),
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    // Every row repeats the same four action labels, so a role query matches
    // four Trash buttons and says nothing about which row was pressed. The
    // testID names the row and the action together, which is the only way to
    // assert the payload — these buttons sit behind the draggable surface, so
    // there is no swipe to reveal one first in jsdom.
    const trash = canvas.getByTestId('story-swipe-row-feedback-action-trash');
    await userEvent.click(trash);

    // Give event handlers a tick.
    await new Promise((r) => setTimeout(r, 50));
    await expect(args.onAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: expect.objectContaining({ id: 'trash' }),
        item: expect.objectContaining({ id: 'feedback' }),
      }),
    );
  },
};
