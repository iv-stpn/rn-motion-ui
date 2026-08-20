import type { Meta, StoryObj } from '@storybook/react';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { expect, screen, userEvent, within } from 'storybook/test';
import { Choice, ControlCard, Note, Playground, Toggle } from '../../../__stories__/story-harness';
import { TriggerButton, TriggerControls, useTriggerState } from '../../../__stories__/story-trigger';
import { cn } from '../../../lib/cn';
import { Button } from '../../form/Button/button';
import { Text } from '../../typography/Text/text';
import { FullSheet, type FullSheetMode } from './full-sheet';

const meta = {
  title: 'Menus/FullSheet',
  component: FullSheet,
  parameters: { layout: 'centered' },
  // open and children are managed by each story's render fn; stubs satisfy the type checker
  args: { open: false, children: null },
} satisfies Meta<typeof FullSheet>;

type Story = StoryObj<typeof meta>;

const BODY_TEXT =
  'This full-screen sheet slides up from the bottom. It supports a title, subtitle, close button, scrollable content, compact padding, and a back-button mode.';
const FILLER_TEXT =
  'Scrollable content is wrapped in a ScrollView, so a body taller than the viewport scrolls instead of clipping.';
const OPEN_SHEET_LABEL = 'Open sheet';
const CLOSE_LABEL = 'Close';
const TITLE = 'Settings';
const SUBTITLE = 'Manage your preferences';
const CUSTOM_LAYOUT_TITLE = 'Custom layout';
const CLOSED_NOTE = 'Closed';
const MODE_NOTE =
  'Back-button mode overlays a back arrow at top-left and hands the content layout to the caller, so the header toggles and "Custom layout" only apply in default mode.';
const DISMISS_NOTE = 'With "Dismissable" off the header buttons disappear — the button inside the sheet still closes it.';

const MODES = [
  { value: 'default', label: 'Default header' },
  { value: 'back-button', label: 'Back button' },
] as const satisfies readonly { value: FullSheetMode; label: string }[];

// Named keys rather than array indices, so the filler paragraphs keep stable identities.
const FILLER_KEYS = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8'] as const;

type SheetBodyProps = { long?: boolean; padded?: boolean; centered?: boolean; onClose: () => void };

function SheetBody({ long = false, padded = false, centered = false, onClose }: SheetBodyProps) {
  return (
    <View className={cn('flex-1 gap-3', centered ? 'items-center' : 'items-stretch', padded ? 'p-6' : 'p-0')}>
      {centered ? (
        <Text size="2xl" weight="bold">
          {CUSTOM_LAYOUT_TITLE}
        </Text>
      ) : null}
      <Text className="text-muted-foreground">{BODY_TEXT}</Text>
      {long
        ? FILLER_KEYS.map((key) => (
            <Text className="text-muted-foreground" key={key}>
              {FILLER_TEXT}
            </Text>
          ))
        : null}
      <Button onPress={onClose} size="sm" style={{ alignSelf: centered ? 'center' : 'flex-start' }} variant="inverse">
        {CLOSE_LABEL}
      </Button>
    </View>
  );
}

function SheetPlayground() {
  const [mode, setMode] = useState<FullSheetMode>('default');
  const [withSubtitle, setWithSubtitle] = useState(true);
  const [withClose, setWithClose] = useState(true);
  const [compact, setCompact] = useState(false);
  const [scrollable, setScrollable] = useState(true);
  const [customLayout, setCustomLayout] = useState(false);
  const [dismissable, setDismissable] = useState(true);
  const [long, setLong] = useState(false);
  const [open, setOpen] = useState(false);
  const trigger = useTriggerState();

  const handleOpen = useCallback(() => setOpen(true), []);
  const handleClose = useCallback(() => setOpen(false), []);

  // Back-button mode and `customLayout` both hand the content frame to the caller,
  // so the body supplies its own padding there.
  const ownsLayout = mode === 'back-button' || customLayout;
  const openNote = open ? `Open — ${mode}` : CLOSED_NOTE;

  return (
    <Playground className="min-w-[340px]">
      <ControlCard title="Options">
        <Choice label="Mode" onChange={setMode} options={MODES} value={mode} />
        <Toggle label="Subtitle" onChange={setWithSubtitle} value={withSubtitle} />
        <Toggle label="Close button" onChange={setWithClose} value={withClose} />
        <Toggle label="Compact" onChange={setCompact} value={compact} />
        <Toggle label="Scrollable" onChange={setScrollable} value={scrollable} />
        <Toggle label="Custom layout" onChange={setCustomLayout} value={customLayout} />
        <Toggle label="Dismissable" onChange={setDismissable} value={dismissable} />
        <Toggle label="Long content" onChange={setLong} value={long} />
      </ControlCard>

      <TriggerControls state={trigger} />

      <TriggerButton
        kind={trigger.kind}
        size={trigger.size}
        shape={trigger.shape}
        label={OPEN_SHEET_LABEL}
        onPress={handleOpen}
      />
      <Note testID="story-open">{openNote}</Note>

      <Note>{MODE_NOTE}</Note>
      <Note>{DISMISS_NOTE}</Note>

      <FullSheet
        compact={compact}
        customLayout={customLayout}
        dismissable={dismissable}
        mode={mode}
        onOpenChange={setOpen}
        open={open}
        scrollable={scrollable}
        showClose={withClose}
        subtitle={withSubtitle ? SUBTITLE : undefined}
        title={TITLE}
      >
        <SheetBody centered={customLayout && mode === 'default'} long={long} onClose={handleClose} padded={ownsLayout} />
      </FullSheet>
    </Playground>
  );
}

function SheetDemo() {
  const [open, setOpen] = useState(false);
  const handleOpen = useCallback(() => setOpen(true), []);
  const handleClose = useCallback(() => setOpen(false), []);
  return (
    <View>
      <TriggerButton label={OPEN_SHEET_LABEL} onPress={handleOpen} />
      <FullSheet onOpenChange={setOpen} open={open} showClose={true} subtitle={SUBTITLE} title={TITLE}>
        <SheetBody onClose={handleClose} />
      </FullSheet>
    </View>
  );
}

export default meta;

/** Every layout in one canvas: header vs back-button mode, padding, scrolling, custom layout and the non-dismissable case. */
export const Interactive: Story = { render: () => <SheetPlayground /> };

/** Standard sheet with title and close button. */
export const WithHeader: Story = {
  name: 'Demo: Open and close',
  render: () => <SheetDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Open the sheet.
    await userEvent.click(await canvas.findByRole('button', { name: OPEN_SHEET_LABEL }));
    // Sheet content mounts inside a Modal — use screen to query outside the canvas.
    await expect(await screen.findByText(TITLE)).toBeTruthy();
    // Close via the X button (accessibilityLabel="Close" → aria-label="Close").
    await userEvent.click(await screen.findByLabelText(CLOSE_LABEL));
  },
};
