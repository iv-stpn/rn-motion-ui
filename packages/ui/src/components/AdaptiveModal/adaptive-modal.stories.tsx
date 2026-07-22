import type { Meta, StoryObj } from '@storybook/react';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { expect, screen, userEvent, within } from 'storybook/test';
import { Button } from '../Button/button';
import { Text } from '../Text/text';
import { AdaptiveModal } from './adaptive-modal';

const meta = {
  title: 'Components/AdaptiveModal',
  component: AdaptiveModal,
  parameters: { layout: 'centered' },
  // visible and children are managed by each story's render fn; stubs satisfy the type checker
  args: { visible: false, onClose: () => undefined, children: null },
} satisfies Meta<typeof AdaptiveModal>;

type Story = StoryObj<typeof meta>;

const BODY =
  'AdaptiveModal renders a bottom sheet or full sheet on narrow screens and a centered panel — or right drawer — on wide screens, with a shared header and content renderer across every surface.';
const OPEN_MODAL_LABEL = 'Open modal';
const OPEN_DRAWER_LABEL = 'Open drawer';
const OPEN_SHEET_LABEL = 'Open bottom sheet';
const OPEN_COMPACT_LABEL = 'Open compact modal';
const CLOSE_LABEL = 'Close';

export default meta;

/** Centered desktop panel (largeScreenMode="modal"), forced wide. */
export const WideModal: Story = {
  render: () => {
    const [visible, setVisible] = useState(false);
    const handleOpen = useCallback(() => setVisible(true), []);
    const handleClose = useCallback(() => setVisible(false), []);
    return (
      <View>
        <Button onPress={handleOpen}>{OPEN_MODAL_LABEL}</Button>
        <AdaptiveModal
          visible={visible}
          onClose={handleClose}
          title="Settings"
          subtitle="Manage your preferences"
          showClose={true}
          isWideScreen={true}
          largeScreenMode="modal"
        >
          <Text style={{ color: '#6b7280', lineHeight: 22 }}>{BODY}</Text>
        </AdaptiveModal>
      </View>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Open the modal.
    await userEvent.click(await canvas.findByRole('button', { name: OPEN_MODAL_LABEL }));
    // Modal content mounts inside a portal — use screen to query outside the canvas.
    await expect(await screen.findByText('Settings')).toBeTruthy();
    // Close via the X button (accessibilityLabel="Close" → aria-label="Close").
    await userEvent.click(await screen.findByLabelText(CLOSE_LABEL));
  },
};

/** Right-edge drawer (largeScreenMode="rightDrawer"), forced wide. */
export const RightDrawer: Story = {
  render: () => {
    const [visible, setVisible] = useState(false);
    const handleOpen = useCallback(() => setVisible(true), []);
    const handleClose = useCallback(() => setVisible(false), []);
    return (
      <View>
        <Button onPress={handleOpen}>{OPEN_DRAWER_LABEL}</Button>
        <AdaptiveModal
          visible={visible}
          onClose={handleClose}
          title="Filters"
          subtitle="Refine the results"
          showClose={true}
          isWideScreen={true}
          largeScreenMode="rightDrawer"
        >
          <Text style={{ color: '#6b7280', lineHeight: 22 }}>{BODY}</Text>
        </AdaptiveModal>
      </View>
    );
  },
};

/** Partial bottom sheet (smallScreenMode="bottomSheet"), forced narrow. */
export const BottomSheet: Story = {
  render: () => {
    const [visible, setVisible] = useState(false);
    const handleOpen = useCallback(() => setVisible(true), []);
    const handleClose = useCallback(() => setVisible(false), []);
    return (
      <View>
        <Button onPress={handleOpen}>{OPEN_SHEET_LABEL}</Button>
        <AdaptiveModal
          visible={visible}
          onClose={handleClose}
          title="Quick actions"
          showClose={true}
          isWideScreen={false}
          smallScreenMode="bottomSheet"
        >
          <Text style={{ color: '#6b7280', lineHeight: 22 }}>{BODY}</Text>
        </AdaptiveModal>
      </View>
    );
  },
};

/** Compact centered panel — tighter padding. */
export const Compact: Story = {
  render: () => {
    const [visible, setVisible] = useState(false);
    const handleOpen = useCallback(() => setVisible(true), []);
    const handleClose = useCallback(() => setVisible(false), []);
    return (
      <View>
        <Button onPress={handleOpen}>{OPEN_COMPACT_LABEL}</Button>
        <AdaptiveModal
          visible={visible}
          onClose={handleClose}
          title="Confirm"
          showClose={true}
          isWideScreen={true}
          largeScreenMode="modal"
          compact={true}
        >
          <Text style={{ color: '#6b7280', lineHeight: 22 }}>{BODY}</Text>
        </AdaptiveModal>
      </View>
    );
  },
};
