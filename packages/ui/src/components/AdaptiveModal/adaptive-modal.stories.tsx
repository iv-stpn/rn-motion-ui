import type { Meta, StoryObj } from '@storybook/react';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { expect, screen, userEvent, within } from 'storybook/test';
import { ELEVATION_KEYS, ELEVATIONS, type ElevationKey } from '../../__stories__/story-elevations';
import { Choice, ControlCard, Note, Playground, Toggle } from '../../__stories__/story-harness';
import { TriggerButton, TriggerControls, useTriggerState } from '../../__stories__/story-trigger';
import { Button } from '../Button/button';
import { Text } from '../Text/text';
import { AdaptiveModal, type LargeScreenMode, type SmallScreenMode, type WidePanelSize } from './adaptive-modal';

const meta = {
  title: 'Components/AdaptiveModal',
  component: AdaptiveModal,
  parameters: { layout: 'centered' },
  // open and children are managed by each story's render fn; stubs satisfy the type checker
  args: { open: false, children: null },
} satisfies Meta<typeof AdaptiveModal>;

type Story = StoryObj<typeof meta>;

const BODY =
  'AdaptiveModal renders a bottom sheet or full sheet on narrow screens and a centered panel — or right drawer — on wide screens, with a shared header and content renderer across every surface.';
const EXTRA_BODY =
  'Scrollable content is wrapped in a ScrollView, so a panel that hits its height cap scrolls instead of overflowing.';
const OPEN_MODAL_LABEL = 'Open modal';
const CLOSE_LABEL = 'Close';
const DONE_LABEL = 'Done';
const TITLE = 'Settings';
const SUBTITLE = 'Manage your preferences';
const CUSTOM_LAYOUT_TITLE = 'Custom layout';
const CLOSED_NOTE = 'Closed';
const SIZE_NOTE = 'Panel size, elevation and the wide layout only apply while "Wide screen" is on.';

const SCREENS = [
  { value: 'wide', label: 'Wide screen' },
  { value: 'narrow', label: 'Narrow screen' },
] as const;
type ScreenKey = (typeof SCREENS)[number]['value'];

const LARGE_MODES = [
  { value: 'modal', label: 'Centered modal' },
  { value: 'rightDrawer', label: 'Right drawer' },
] as const satisfies readonly { value: LargeScreenMode; label: string }[];

const SMALL_MODES = [
  { value: 'bottomSheet', label: 'Bottom sheet' },
  { value: 'fullSheet', label: 'Full sheet' },
] as const satisfies readonly { value: SmallScreenMode; label: string }[];

// Named presets instead of four numeric controls — each one is a `widePanelSize` object.
const PANEL_SIZES = {
  auto: undefined,
  narrow: { width: 380 },
  wide: { width: '70%', maxWidth: 720 },
  tall: { width: 480, height: '80%' },
} as const satisfies Record<string, WidePanelSize | undefined>;
type PanelSizeKey = keyof typeof PANEL_SIZES;
const PANEL_SIZE_OPTIONS = [
  { value: 'auto', label: 'Auto' },
  { value: 'narrow', label: '380px' },
  { value: 'wide', label: '70% / max 720' },
  { value: 'tall', label: '480 × 80%' },
] as const satisfies readonly { value: PanelSizeKey; label: string }[];

// Named keys rather than array indices, so the filler paragraphs keep stable identities.
const FILLER_KEYS = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'] as const;

type ModalBodyProps = { long?: boolean };

// biome-ignore lint/style/useComponentExportOnlyModules: story helper co-located with its stories
function ModalBody({ long = false }: ModalBodyProps) {
  return (
    <View className="gap-3">
      <Text className="text-muted-foreground">{BODY}</Text>
      {long
        ? FILLER_KEYS.map((key) => (
            <Text className="text-muted-foreground" key={key}>
              {EXTRA_BODY}
            </Text>
          ))
        : null}
    </View>
  );
}

type CustomBodyProps = { onClose: () => void };

// `customLayout` drops the modal's own padding, so the caller owns the frame.
// biome-ignore lint/style/useComponentExportOnlyModules: story helper co-located with its stories
function CustomBody({ onClose }: CustomBodyProps) {
  return (
    <View className="gap-4 border-border border-t p-6">
      <Text size="lg" weight="semibold">
        {CUSTOM_LAYOUT_TITLE}
      </Text>
      <Text className="text-muted-foreground">{BODY}</Text>
      <Button onPress={onClose} size="sm" className="self-end" variant="outline">
        {DONE_LABEL}
      </Button>
    </View>
  );
}

// biome-ignore lint/style/useComponentExportOnlyModules: story helper co-located with its stories
function ModalPlayground() {
  const [screenKey, setScreenKey] = useState<ScreenKey>('wide');
  const [largeMode, setLargeMode] = useState<LargeScreenMode>('modal');
  const [smallMode, setSmallMode] = useState<SmallScreenMode>('bottomSheet');
  const [sizeKey, setSizeKey] = useState<PanelSizeKey>('auto');
  const [elevationKey, setElevationKey] = useState<ElevationKey>('6');
  const [withSubtitle, setWithSubtitle] = useState(true);
  const [withClose, setWithClose] = useState(true);
  const [compact, setCompact] = useState(false);
  const [scrollable, setScrollable] = useState(false);
  const [customLayout, setCustomLayout] = useState(false);
  const [closeOnOverlay, setCloseOnOverlay] = useState(true);
  const [open, setOpen] = useState(false);
  const trigger = useTriggerState();

  const handleOpen = useCallback(() => setOpen(true), []);
  const handleClose = useCallback(() => setOpen(false), []);
  const openNote = open ? `Open — ${screenKey} / ${largeMode} / ${smallMode}` : CLOSED_NOTE;

  return (
    <Playground className="min-w-[340px]">
      <ControlCard title="Modal panel">
        <Choice label="Screen" onChange={setScreenKey} options={SCREENS} value={screenKey} />
        <Choice label="Wide layout" onChange={setLargeMode} options={LARGE_MODES} value={largeMode} />
        <Choice label="Narrow layout" onChange={setSmallMode} options={SMALL_MODES} value={smallMode} />
        <Choice label="Panel size" onChange={setSizeKey} options={PANEL_SIZE_OPTIONS} value={sizeKey} />
        <Choice onChange={setElevationKey} options={ELEVATION_KEYS} value={elevationKey} />
      </ControlCard>

      <ControlCard title="Options">
        <Toggle label="Subtitle" onChange={setWithSubtitle} value={withSubtitle} />
        <Toggle label="Close button" onChange={setWithClose} value={withClose} />
        <Toggle label="Compact" onChange={setCompact} value={compact} />
        <Toggle label="Scrollable" onChange={setScrollable} value={scrollable} />
        <Toggle label="Custom layout" onChange={setCustomLayout} value={customLayout} />
        <Toggle label="Close on overlay" onChange={setCloseOnOverlay} value={closeOnOverlay} />
      </ControlCard>

      <TriggerControls state={trigger} />

      <TriggerButton
        kind={trigger.kind}
        size={trigger.size}
        shape={trigger.shape}
        label={OPEN_MODAL_LABEL}
        onPress={handleOpen}
      />
      <Note testID="story-open">{openNote}</Note>

      <Note>{SIZE_NOTE}</Note>

      <AdaptiveModal
        closeOnOverlayClick={closeOnOverlay}
        compact={compact}
        customLayout={customLayout}
        elevation={ELEVATIONS[elevationKey]}
        isWideScreen={screenKey === 'wide'}
        largeScreenMode={largeMode}
        onOpenChange={setOpen}
        open={open}
        scrollable={scrollable}
        showClose={withClose}
        smallScreenMode={smallMode}
        subtitle={withSubtitle ? SUBTITLE : undefined}
        title={TITLE}
        widePanelSize={PANEL_SIZES[sizeKey]}
      >
        {customLayout ? <CustomBody onClose={handleClose} /> : <ModalBody long={scrollable} />}
      </AdaptiveModal>
    </Playground>
  );
}

// biome-ignore lint/style/useComponentExportOnlyModules: story helper co-located with its stories
function ModalDemo() {
  const [open, setOpen] = useState(false);
  const handleOpen = useCallback(() => setOpen(true), []);
  return (
    <View className="items-center">
      <TriggerButton label={OPEN_MODAL_LABEL} onPress={handleOpen} />
      <AdaptiveModal
        isWideScreen={true}
        largeScreenMode="modal"
        onOpenChange={setOpen}
        open={open}
        showClose={true}
        subtitle={SUBTITLE}
        title={TITLE}
      >
        <ModalBody />
      </AdaptiveModal>
    </View>
  );
}

export default meta;

/** Every surface in one canvas: wide/narrow override, both layouts per breakpoint, panel size, padding, scrolling and overlay behaviour. */
export const Interactive: Story = { render: () => <ModalPlayground /> };

/** Centered desktop panel (largeScreenMode="modal"), forced wide. */
export const WideModal: Story = {
  name: 'Demo: Open and close',
  render: () => <ModalDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Open the modal.
    await userEvent.click(await canvas.findByRole('button', { name: OPEN_MODAL_LABEL }));
    // Modal content mounts inside a portal — use screen to query outside the canvas.
    await expect(await screen.findByText(TITLE)).toBeTruthy();
    // Close via the X button (accessibilityLabel="Close" → aria-label="Close").
    await userEvent.click(await screen.findByLabelText(CLOSE_LABEL));
  },
};
