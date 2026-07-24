import type { Meta, StoryObj } from '@storybook/react';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { expect, screen, userEvent, within } from 'storybook/test';
import { Button } from '../Button/button';
import { Text } from '../Text/text';
import { AdaptiveModal, type LargeScreenMode, type SmallScreenMode } from './adaptive-modal';

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

type ModalDemoProps = {
  triggerLabel: string;
  title: string;
  subtitle?: string;
  mode: LargeScreenMode | SmallScreenMode;
  isWideScreen: boolean;
  compact?: boolean;
};

// biome-ignore lint/style/useComponentExportOnlyModules: story helper shared by the Interactive + variant stories
function ModalDemo({ triggerLabel, title, subtitle, mode, isWideScreen, compact = false }: ModalDemoProps) {
  const [visible, setVisible] = useState(false);
  const handleOpen = useCallback(() => setVisible(true), []);
  const handleClose = useCallback(() => setVisible(false), []);
  const largeScreenMode: LargeScreenMode = mode === 'rightDrawer' ? 'rightDrawer' : 'modal';
  const smallScreenMode: SmallScreenMode = mode === 'bottomSheet' ? 'bottomSheet' : 'fullSheet';
  return (
    <View>
      <Button onPress={handleOpen}>{triggerLabel}</Button>
      <AdaptiveModal
        visible={visible}
        onClose={handleClose}
        title={title}
        subtitle={subtitle}
        showClose={true}
        isWideScreen={isWideScreen}
        largeScreenMode={largeScreenMode}
        smallScreenMode={smallScreenMode}
        compact={compact}
      >
        <Text style={{ color: '#6b7280', lineHeight: 22 }}>{BODY}</Text>
      </AdaptiveModal>
    </View>
  );
}

export default meta;

/** User-navigable centered desktop panel — open and close it yourself. */
export const Interactive: Story = {
  render: () => (
    <ModalDemo
      triggerLabel={OPEN_MODAL_LABEL}
      title="Settings"
      subtitle="Manage your preferences"
      mode="modal"
      isWideScreen={true}
    />
  ),
};

/** Centered desktop panel (largeScreenMode="modal"), forced wide. */
export const WideModal: Story = {
  name: 'Demo: Open and close',
  render: () => (
    <ModalDemo
      triggerLabel={OPEN_MODAL_LABEL}
      title="Settings"
      subtitle="Manage your preferences"
      mode="modal"
      isWideScreen={true}
    />
  ),
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
  render: () => (
    <ModalDemo
      triggerLabel={OPEN_DRAWER_LABEL}
      title="Filters"
      subtitle="Refine the results"
      mode="rightDrawer"
      isWideScreen={true}
    />
  ),
};

/** Partial bottom sheet (smallScreenMode="bottomSheet"), forced narrow. */
export const BottomSheet: Story = {
  render: () => <ModalDemo triggerLabel={OPEN_SHEET_LABEL} title="Quick actions" mode="bottomSheet" isWideScreen={false} />,
};

/** Compact centered panel — tighter padding. */
export const Compact: Story = {
  render: () => <ModalDemo triggerLabel={OPEN_COMPACT_LABEL} title="Confirm" mode="modal" isWideScreen={true} compact={true} />,
};
