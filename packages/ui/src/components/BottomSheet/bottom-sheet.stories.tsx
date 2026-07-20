import type { Meta, StoryObj } from '@storybook/react';
import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { expect, screen, userEvent, within } from 'storybook/test';
import { Button } from '../Button/button';
import { BottomSheet } from './bottom-sheet';

const meta = {
  title: 'Components/BottomSheet',
  component: BottomSheet,
  parameters: { layout: 'centered' },
  // visible and children are managed by each story's render fn; stubs satisfy the type checker
  args: { visible: false, onClose: () => undefined, children: null },
} satisfies Meta<typeof BottomSheet>;

type Story = StoryObj<typeof meta>;

const LOREM =
  'Swipe down or tap the overlay to dismiss. This sheet slides up from the bottom of the screen with a drag-to-dismiss gesture built in.';

const BOTTOM_SHEET_TITLE = 'Bottom Sheet';
const SCROLLABLE_CONTENT_TITLE = 'Scrollable Content';
const FULL_HEIGHT_TITLE = 'Full-Height Sheet';
const LOCKED_TITLE = 'Overlay Tap Disabled';
const OPEN_SHEET_LABEL = 'Open sheet';
const OPEN_SCROLLABLE_LABEL = 'Open scrollable sheet';
const OPEN_FULL_LABEL = 'Open full sheet';
const OPEN_LOCKED_LABEL = 'Open locked sheet';
const DISMISS_LABEL = 'Dismiss';
const CLOSE_LABEL = 'Close';
const SWIPE_SUFFIX = ' — swipe to dismiss';
const FULL_SHEET_BODY = 'No handle, no 90% cap — takes the full screen.';
const LOCKED_BODY = 'Tapping outside does nothing. Use the button.';

type OpenButtonProps = { label?: string };

// biome-ignore lint/style/useComponentExportOnlyModules: story helper co-located with its stories
function OpenButton({ label = OPEN_SHEET_LABEL }: OpenButtonProps) {
  const [visible, setVisible] = useState(false);
  const handleOpen = useCallback(() => setVisible(true), []);
  const handleClose = useCallback(() => setVisible(false), []);
  return (
    <View style={{ gap: 12 }}>
      <Button onPress={handleOpen}>{label}</Button>
      <BottomSheet visible={visible} onClose={handleClose}>
        <View style={{ padding: 24, gap: 12 }}>
          <Text style={{ fontWeight: '600', fontSize: 18 }}>{BOTTOM_SHEET_TITLE}</Text>
          <Text style={{ color: '#6b7280', lineHeight: 22 }}>{LOREM}</Text>
          <Button variant="secondary" onPress={handleClose}>
            {DISMISS_LABEL}
          </Button>
        </View>
      </BottomSheet>
    </View>
  );
}

export default meta;

/** Drag the handle or tap the overlay to dismiss. */
export const Default: Story = {
  render: () => <OpenButton />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Open the sheet.
    await userEvent.click(await canvas.findByRole('button', { name: OPEN_SHEET_LABEL }));
    // Sheet content mounts inside a Modal — use screen to query outside the canvas.
    await expect(await screen.findByText(BOTTOM_SHEET_TITLE)).toBeTruthy();
    // Verify the dismiss button is present and interactive.
    await expect(await screen.findByRole('button', { name: DISMISS_LABEL })).toBeTruthy();
  },
};

/** Content tall enough to trigger internal scroll. */
export const ScrollableContent: Story = {
  render: () => {
    const [visible, setVisible] = useState(false);
    const handleOpen = useCallback(() => setVisible(true), []);
    const handleClose = useCallback(() => setVisible(false), []);
    return (
      <View style={{ gap: 12 }}>
        <Button onPress={handleOpen}>{OPEN_SCROLLABLE_LABEL}</Button>
        <BottomSheet visible={visible} onClose={handleClose}>
          <View style={{ padding: 24, gap: 12 }}>
            <Text style={{ fontWeight: '600', fontSize: 18 }}>{SCROLLABLE_CONTENT_TITLE}</Text>
            {Array.from({ length: 12 }, (_, i) => {
              const label = `Item ${i + 1}`;
              return (
                <Text key={label} style={{ color: '#6b7280' }}>
                  {label}
                  {SWIPE_SUFFIX}
                </Text>
              );
            })}
            <Button variant="secondary" onPress={handleClose}>
              {CLOSE_LABEL}
            </Button>
          </View>
        </BottomSheet>
      </View>
    );
  },
};

/** `fullSheet` stretches to full screen height. */
export const FullSheet: Story = {
  render: () => {
    const [visible, setVisible] = useState(false);
    const handleOpen = useCallback(() => setVisible(true), []);
    const handleClose = useCallback(() => setVisible(false), []);
    return (
      <View style={{ gap: 12 }}>
        <Button onPress={handleOpen}>{OPEN_FULL_LABEL}</Button>
        <BottomSheet visible={visible} onClose={handleClose} fullSheet={true}>
          <View style={{ flex: 1, padding: 24, gap: 12 }}>
            <Text style={{ fontWeight: '600', fontSize: 18 }}>{FULL_HEIGHT_TITLE}</Text>
            <Text style={{ color: '#6b7280' }}>{FULL_SHEET_BODY}</Text>
            <Button variant="secondary" onPress={handleClose}>
              {CLOSE_LABEL}
            </Button>
          </View>
        </BottomSheet>
      </View>
    );
  },
};

/** `closeOnOverlayClick={false}` — only the explicit dismiss button closes the sheet. */
export const LockedOverlay: Story = {
  render: () => {
    const [visible, setVisible] = useState(false);
    const handleOpen = useCallback(() => setVisible(true), []);
    const handleClose = useCallback(() => setVisible(false), []);
    return (
      <View style={{ gap: 12 }}>
        <Button onPress={handleOpen}>{OPEN_LOCKED_LABEL}</Button>
        <BottomSheet visible={visible} onClose={handleClose} closeOnOverlayClick={false}>
          <View style={{ padding: 24, gap: 12 }}>
            <Text style={{ fontWeight: '600', fontSize: 18 }}>{LOCKED_TITLE}</Text>
            <Text style={{ color: '#6b7280' }}>{LOCKED_BODY}</Text>
            <Button variant="secondary" onPress={handleClose}>
              {DISMISS_LABEL}
            </Button>
          </View>
        </BottomSheet>
      </View>
    );
  },
};
