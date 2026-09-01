import type { Meta, StoryObj } from '@storybook/react';
import { type ReactNode, useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';
import { CloseLine as X } from 'rn-motion-ui-icons/icons/close-line';
import { Delete2Line as Trash2 } from 'rn-motion-ui-icons/icons/delete-2-line';
import { FaceidLine as ScanFace } from 'rn-motion-ui-icons/icons/faceid-line';
import { FileLine as ScrollText } from 'rn-motion-ui-icons/icons/file-line';
import { ForbidCircleLine as Ban } from 'rn-motion-ui-icons/icons/forbid-circle-line';
import { LockLine as Lock } from 'rn-motion-ui-icons/icons/lock-line';
import { ShieldLine as ShieldCheck } from 'rn-motion-ui-icons/icons/shield-line';
import { expect, fn, screen, userEvent, waitFor, within } from 'storybook/test';
import { ELEVATION_KEYS, ELEVATIONS, type ElevationKey } from '../../../__stories__/story-elevations';
import { Choice, ControlCard, Playground, Toggle } from '../../../__stories__/story-harness';
import { TriggerButton, TriggerControls, type TriggerState, useTriggerState } from '../../../__stories__/story-trigger';
import type { SurfaceElevation } from '../../../lib/elevated';
import { useThemeColor } from '../../../theme/use-theme-color';
import { Button } from '../../buttons/Button/button';
import { Text } from '../../typography/Text/text';
import { OVERLAY_OPTIONS, type OverlayType } from '../Overlay/overlay-type';
import { MorphingModal } from './morphing-modal';

const meta = {
  title: 'Menus/MorphingModal',
  component: MorphingModal,
  parameters: { layout: 'centered' },
  args: { viewId: null, onClose: fn(), children: null, placement: 'bottom' },
  argTypes: {
    placement: { control: 'select', options: ['bottom', 'center', 'bottom-sheet'] },
  },
} satisfies Meta<typeof MorphingModal>;

type Story = StoryObj<typeof meta>;

type WalletView = 'options' | 'private-key' | 'recovery' | null;

const OPEN_LABEL = 'Open wallet options';
const OPTIONS_TITLE = 'Options';
const PRIVATE_KEY_LABEL = 'View Private Key';
const RECOVERY_LABEL = 'View Recovery Phrase';
const PRIVATE_KEY_TITLE = 'Private Key';
const RECOVERY_TITLE = 'Recovery Phrase';
const CLOSE_LABEL = 'Close';
const BACK_LABEL = 'Back';
const PRIVATE_KEY_DESC = 'Your Private Key is the key used to back up your wallet. Keep it secret and secure at all times.';
const RECOVERY_DESC = '12 words you can use to restore your wallet on any device. Write them down somewhere safe.';
const CANCEL_LABEL = 'Cancel';
const REVEAL_LABEL = 'Reveal';
const DONE_LABEL = 'Done';
const HINT = 'Tap a row. The modal morphs height to match new content.';

const RECOVERY_WORDS = [
  'mountain',
  'river',
  'candle',
  'harbor',
  'amber',
  'violet',
  'spring',
  'ocean',
  'marble',
  'thunder',
  'willow',
  'crystal',
];

type CloseButtonProps = { label: string; onPress: () => void };

function CloseButton({ label, onPress }: CloseButtonProps) {
  const mutedForeground = useThemeColor('muted-foreground');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      className="h-7 w-7 items-center justify-center rounded-full"
    >
      <X size={14} color={mutedForeground} />
    </Pressable>
  );
}

type RowProps = { icon: ReactNode; label: string; danger?: boolean; onPress: () => void };

function Row({ icon, label, danger, onPress }: RowProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className={
        danger
          ? 'flex-row items-center gap-3 rounded-2xl bg-danger/10 px-4 py-3'
          : 'flex-row items-center gap-3 rounded-2xl bg-muted px-4 py-3'
      }
    >
      {icon}
      <Text weight="medium" className={danger ? 'text-danger text-sm' : 'text-foreground text-sm'}>
        {label}
      </Text>
    </Pressable>
  );
}

type ChecklistItemProps = { icon: ReactNode; text: string };

function ChecklistItem({ icon, text }: ChecklistItemProps) {
  return (
    <View className="flex-row items-center gap-2.5">
      {icon}
      <Text className="text-muted-foreground text-sm">{text}</Text>
    </View>
  );
}

type OptionsViewProps = { onPrivateKey: () => void; onRecovery: () => void; onClose: () => void };

function OptionsView({ onPrivateKey, onRecovery, onClose }: OptionsViewProps) {
  return (
    <View>
      <View className="mb-4 flex-row items-center justify-between">
        <Text weight="semibold" className="text-base text-foreground">
          {OPTIONS_TITLE}
        </Text>
        <CloseButton label={CLOSE_LABEL} onPress={onClose} />
      </View>
      <View className="gap-2">
        <Row icon={<Lock size={16} />} label={PRIVATE_KEY_LABEL} onPress={onPrivateKey} />
        <Row icon={<ScrollText size={16} />} label={RECOVERY_LABEL} onPress={onRecovery} />
        <Row icon={<Trash2 color="danger" size={16} />} label="Remove Wallet" danger={true} onPress={onClose} />
      </View>
    </View>
  );
}

type PrivateKeyViewProps = { onBack: () => void };

function PrivateKeyView({ onBack }: PrivateKeyViewProps) {
  const foreground = useThemeColor('foreground');
  const mutedForeground = useThemeColor('muted-foreground');
  const primaryForeground = useThemeColor('primary-foreground');
  return (
    <View>
      <View className="mb-3 flex-row items-start justify-between">
        <Lock size={20} color={foreground} />
        <CloseButton label={BACK_LABEL} onPress={onBack} />
      </View>
      <Text weight="semibold" className="text-foreground text-xl">
        {PRIVATE_KEY_TITLE}
      </Text>
      <Text className="mt-2 text-muted-foreground text-sm">{PRIVATE_KEY_DESC}</Text>
      <View className="my-4 h-px bg-border" />
      <View className="gap-2.5">
        <ChecklistItem icon={<ShieldCheck size={16} color={mutedForeground} />} text="Keep your private key safe" />
        <ChecklistItem icon={<ScrollText size={16} color={mutedForeground} />} text="Don't share it with anyone else" />
        <ChecklistItem icon={<Ban size={16} color={mutedForeground} />} text="If you lose it, we can't recover it" />
      </View>
      <View className="mt-5 flex-row gap-2">
        <Button variant="neutral" onPress={onBack} className="flex-1">
          {CANCEL_LABEL}
        </Button>
        <Button onPress={onBack} className="flex-1">
          <ScanFace size={16} color={primaryForeground} />
          {REVEAL_LABEL}
        </Button>
      </View>
    </View>
  );
}

type RecoveryViewProps = { onBack: () => void };

function RecoveryView({ onBack }: RecoveryViewProps) {
  const foreground = useThemeColor('foreground');
  return (
    <View>
      <View className="mb-3 flex-row items-start justify-between">
        <ScrollText size={20} color={foreground} />
        <CloseButton label={BACK_LABEL} onPress={onBack} />
      </View>
      <Text weight="semibold" className="text-foreground text-xl">
        {RECOVERY_TITLE}
      </Text>
      <Text className="mt-2 text-muted-foreground text-sm">{RECOVERY_DESC}</Text>
      <View className="mt-4 flex-row flex-wrap gap-2">
        {RECOVERY_WORDS.map((word, index) => (
          <View key={word} className="grow basis-[30%] flex-row rounded-lg border-[1.5px] border-border bg-surface-1 px-2 py-1.5">
            <Text className="mr-1 text-muted-foreground text-xs">{`${index + 1}.`}</Text>
            <Text className="text-foreground text-xs">{word}</Text>
          </View>
        ))}
      </View>
      <Button onPress={onBack} className="mt-5">
        {DONE_LABEL}
      </Button>
    </View>
  );
}

type ModalViewCallbacks = { close: () => void; showOptions: () => void; showPrivateKey: () => void; showRecovery: () => void };

function renderModalView(view: WalletView, callbacks: ModalViewCallbacks): ReactNode {
  const { close, showOptions, showPrivateKey, showRecovery } = callbacks;
  if (view === 'options') return <OptionsView onPrivateKey={showPrivateKey} onRecovery={showRecovery} onClose={close} />;
  if (view === 'private-key') return <PrivateKeyView onBack={showOptions} />;
  if (view === 'recovery') return <RecoveryView onBack={showOptions} />;
  return null;
}

const PLACEMENTS = [
  { value: 'bottom', label: 'Bottom' },
  { value: 'center', label: 'Center' },
  { value: 'bottom-sheet', label: 'Bottom Sheet' },
] as const satisfies readonly { value: 'bottom' | 'center' | 'bottom-sheet'; label: string }[];

type MorphingModalDemoProps = {
  placement: 'bottom' | 'center' | 'bottom-sheet';
  elevation?: SurfaceElevation;
  floating?: boolean;
  kind?: TriggerState['kind'];
  size?: TriggerState['size'];
  shape?: TriggerState['shape'];
  triggerFloating?: boolean;
  triggerElevation?: SurfaceElevation;
  overlay?: OverlayType;
  closeOnOutsidePress?: boolean;
  testID?: string;
};

function MorphingModalDemo({
  placement,
  elevation = 6,
  floating = false,
  kind,
  size,
  shape,
  triggerFloating,
  triggerElevation,
  overlay = 'blur',
  closeOnOutsidePress = true,
  testID,
}: MorphingModalDemoProps) {
  const [view, setView] = useState<WalletView>(null);
  const showOptions = useCallback(() => setView('options'), []);
  const close = useCallback(() => setView(null), []);
  const showPrivateKey = useCallback(() => setView('private-key'), []);
  const showRecovery = useCallback(() => setView('recovery'), []);
  return (
    <View className="items-center gap-3">
      <TriggerButton
        kind={kind}
        size={size}
        shape={shape}
        floating={triggerFloating}
        elevation={triggerElevation}
        label={OPEN_LABEL}
        onPress={showOptions}
      />
      <Text className="text-muted-foreground text-xs">{HINT}</Text>
      <MorphingModal
        viewId={view}
        onClose={close}
        placement={placement}
        elevation={elevation}
        floating={floating}
        overlay={overlay}
        closeOnOutsidePress={closeOnOutsidePress}
        testID={testID}
      >
        {renderModalView(view, { close, showOptions, showPrivateKey, showRecovery })}
      </MorphingModal>
    </View>
  );
}

function MorphingModalPlayground() {
  const [placement, setPlacement] = useState<'bottom' | 'center' | 'bottom-sheet'>('bottom');
  const [elevationKey, setElevationKey] = useState<ElevationKey>('6');
  const [floating, setFloating] = useState(false);
  const [overlay, setOverlay] = useState<OverlayType>('blur');
  const [closeOnOutside, setCloseOnOutside] = useState(true);
  const trigger = useTriggerState();
  return (
    <Playground className="min-w-[340px]">
      <ControlCard title="Options">
        <Choice label="Placement" onChange={setPlacement} options={PLACEMENTS} value={placement} />
        <Toggle label="Floating" onChange={setFloating} value={floating} />
        <Choice label="Elevation" onChange={setElevationKey} options={ELEVATION_KEYS} value={elevationKey} />
        <Choice label="Overlay" onChange={setOverlay} options={OVERLAY_OPTIONS} value={overlay} />
        <Toggle label="Close on outside" onChange={setCloseOnOutside} value={closeOnOutside} />
      </ControlCard>
      <TriggerControls state={trigger} />
      <MorphingModalDemo
        placement={placement}
        elevation={ELEVATIONS[elevationKey]}
        floating={floating}
        overlay={overlay}
        closeOnOutsidePress={closeOnOutside}
        kind={trigger.kind}
        size={trigger.size}
        shape={trigger.shape}
        triggerFloating={trigger.floating}
        triggerElevation={ELEVATIONS[trigger.elevation]}
      />
    </Playground>
  );
}

export default meta;

export const Interactive: Story = {
  render: () => <MorphingModalPlayground />,
};

export const Default: Story = {
  name: 'Demo: Open and morph',
  render: () => <MorphingModalDemo placement="bottom" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Open the modal; it lands on the options list, not a detail view.
    await userEvent.click(await canvas.findByRole('button', { name: OPEN_LABEL }));
    await expect(await screen.findByText(OPTIONS_TITLE)).toBeTruthy();
  },
};

export const CloseOnOverlayTap: Story = {
  name: 'Demo: Close on overlay tap',
  render: () => <MorphingModalDemo placement="bottom" testID="morph" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole('button', { name: OPEN_LABEL }));
    await expect(await screen.findByText(OPTIONS_TITLE)).toBeTruthy();

    // The scrim must be what actually paints in the empty area around the
    // panel. `userEvent` dispatches straight at the node without hit-testing,
    // so a click alone would pass even while the panel's positioning layer sat
    // on top and swallowed every real tap. Probe the top-left corner — far from
    // the bottom-anchored card — and name what paints there so a regression
    // reports the offending layer instead of a bare `false`.
    const doc = canvasElement.ownerDocument;
    const topmost = doc.elementFromPoint(12, 12);
    const label = topmost?.closest('[data-testid]')?.getAttribute('data-testid') ?? topmost?.className ?? 'nothing';
    await expect(label).toBe('morph-backdrop');

    // The other half of `box-none`: the panel itself must still take taps. A
    // positioning layer fixed with plain `pointerEvents: 'none'` would pass
    // the corner probe above and still leave the card dead, so morph a view.
    await userEvent.click(await screen.findByText(PRIVATE_KEY_LABEL));
    await expect(await screen.findByText(PRIVATE_KEY_TITLE)).toBeTruthy();

    await userEvent.click(await screen.findByTestId('morph-backdrop'));
    await waitFor(() => expect(screen.queryByText(PRIVATE_KEY_TITLE)).toBeNull());
  },
};
