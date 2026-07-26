import type { Meta, StoryObj } from '@storybook/react';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { expect, screen, userEvent, within } from 'storybook/test';
import { Choice, Controls, Note, Playground, Section, Toggle } from '../../__stories__/story-harness';
import { TRIGGER_KINDS, TriggerButton, type TriggerKind } from '../../__stories__/story-trigger';
import { Button } from '../Button/button';
import { Text } from '../Text/text';
import { BottomSheet } from './bottom-sheet';

const meta = {
  title: 'Components/BottomSheet',
  component: BottomSheet,
  parameters: { layout: 'centered' },
  // open and children are managed by each story's render fn; stubs satisfy the type checker
  args: { open: false, children: null },
} satisfies Meta<typeof BottomSheet>;

type Story = StoryObj<typeof meta>;

const LOREM =
  'Swipe down or tap the overlay to dismiss. This sheet slides up from the bottom of the screen with a drag-to-dismiss gesture built in.';

const BOTTOM_SHEET_TITLE = 'Bottom Sheet';
const OPEN_SHEET_LABEL = 'Open sheet';
const DISMISS_LABEL = 'Dismiss';
const SWIPE_SUFFIX = ' — swipe to dismiss';
const CLOSED_NOTE = 'Closed';
const FULL_SHEET_NOTE = '"Full sheet" drops the drag handle and the 90% height cap, so the sheet owns the whole screen.';
const LOCKED_NOTE = 'With "Close on overlay" off, only the sheet\'s own button (or a downward swipe) dismisses it.';
const CHROME_NOTE = 'The handle and backdrop each take their own className, so the chrome can be re-tinted per sheet.';

const FILLER_KEYS = ['r1', 'r2', 'r3', 'r4', 'r5', 'r6', 'r7', 'r8', 'r9', 'r10', 'r11', 'r12'] as const;

const TINTED_HANDLE = 'bg-surface-3';
const TINTED_BACKDROP = 'bg-primary/20';

type SheetBodyProps = { long?: boolean; full?: boolean; onClose: () => void };

// biome-ignore lint/style/useComponentExportOnlyModules: story helper co-located with its stories
function SheetBody({ long = false, full = false, onClose }: SheetBodyProps) {
  return (
    <View style={{ flex: full ? 1 : undefined, padding: 24, gap: 12 }}>
      <Text size="lg" weight="semibold">
        {BOTTOM_SHEET_TITLE}
      </Text>
      <Text className="text-muted-foreground">{LOREM}</Text>
      {long
        ? FILLER_KEYS.map((key, index) => (
            <Text className="text-muted-foreground" key={key}>
              {`Item ${index + 1}${SWIPE_SUFFIX}`}
            </Text>
          ))
        : null}
      <Button onPress={onClose} variant="secondary">
        {DISMISS_LABEL}
      </Button>
    </View>
  );
}

// biome-ignore lint/style/useComponentExportOnlyModules: story helper co-located with its stories
function SheetPlayground() {
  const [fullSheet, setFullSheet] = useState(false);
  const [closeOnOverlay, setCloseOnOverlay] = useState(true);
  const [longContent, setLongContent] = useState(false);
  const [tinted, setTinted] = useState(false);
  const [open, setOpen] = useState(false);
  const [closes, setCloses] = useState(0);
  const [triggerKind, setTriggerKind] = useState<TriggerKind>('button');

  const handleOpen = useCallback(() => setOpen(true), []);
  const handleClose = useCallback(() => setOpen(false), []);
  const handleAfterClose = useCallback(() => setCloses((count) => count + 1), []);

  return (
    <Playground style={{ minWidth: 340 }}>
      <Controls>
        <Toggle label="Full sheet" onChange={setFullSheet} value={fullSheet} />
        <Toggle label="Long content" onChange={setLongContent} value={longContent} />
        <Toggle label="Close on overlay" onChange={setCloseOnOverlay} value={closeOnOverlay} />
        <Toggle label="Tinted chrome" onChange={setTinted} value={tinted} />
        <Choice label="Trigger" onChange={setTriggerKind} options={TRIGGER_KINDS} value={triggerKind} />
      </Controls>

      <Section>
        <TriggerButton kind={triggerKind} label={OPEN_SHEET_LABEL} onPress={handleOpen} />
        <Note testID="story-open">{open ? `Open — dismissed ${closes}×` : `${CLOSED_NOTE} — dismissed ${closes}×`}</Note>
      </Section>

      <Note>{FULL_SHEET_NOTE}</Note>
      <Note>{LOCKED_NOTE}</Note>
      <Note>{CHROME_NOTE}</Note>

      <BottomSheet
        backdropClassName={tinted ? TINTED_BACKDROP : undefined}
        closeOnOverlayClick={closeOnOverlay}
        fullSheet={fullSheet}
        handleClassName={tinted ? TINTED_HANDLE : undefined}
        onAfterClose={handleAfterClose}
        onOpenChange={setOpen}
        open={open}
      >
        <SheetBody full={fullSheet} long={longContent} onClose={handleClose} />
      </BottomSheet>
    </Playground>
  );
}

// biome-ignore lint/style/useComponentExportOnlyModules: story helper co-located with its stories
function SheetDemo() {
  const [open, setOpen] = useState(false);
  const handleOpen = useCallback(() => setOpen(true), []);
  const handleClose = useCallback(() => setOpen(false), []);
  return (
    <View style={{ gap: 12 }}>
      <TriggerButton label={OPEN_SHEET_LABEL} onPress={handleOpen} />
      <BottomSheet onOpenChange={setOpen} open={open}>
        <SheetBody onClose={handleClose} />
      </BottomSheet>
    </View>
  );
}

export default meta;

/** Height, overlay behaviour, content length and the handle/backdrop slots in one canvas. */
export const Interactive: Story = { render: () => <SheetPlayground /> };

/** Drag the handle or tap the overlay to dismiss. */
export const Default: Story = {
  name: 'Demo: Open the sheet',
  render: () => <SheetDemo />,
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
