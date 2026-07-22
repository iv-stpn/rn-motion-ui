import type { Meta, StoryObj } from '@storybook/react';
import { type ReactNode, useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';
import { expect, fn, screen, userEvent, within } from 'storybook/test';
import { Ban, Lock, ScanFace, ScrollText, ShieldCheck, Trash2, X } from '../../lib/icons';
import { Button } from '../Button/button';
import { Text } from '../Text/text';
import { MorphingModal } from './morphing-modal';

const meta = {
  title: 'Components/MorphingModal',
  component: MorphingModal,
  parameters: { layout: 'centered' },
  args: { viewId: null, onClose: fn(), children: null, placement: 'bottom' },
  argTypes: {
    placement: { control: 'select', options: ['bottom', 'center'] },
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

// biome-ignore lint/style/useComponentExportOnlyModules: story helper
function CloseButton({ label, onPress }: CloseButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      className="h-7 w-7 items-center justify-center rounded-full"
    >
      <X size={14} color="#737373" />
    </Pressable>
  );
}

type RowProps = { icon: ReactNode; label: string; destructive?: boolean; onPress: () => void };

// biome-ignore lint/style/useComponentExportOnlyModules: story helper
function Row({ icon, label, destructive, onPress }: RowProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className={
        destructive
          ? 'flex-row items-center gap-3 rounded-2xl bg-destructive/10 px-4 py-3'
          : 'flex-row items-center gap-3 rounded-2xl bg-muted px-4 py-3'
      }
    >
      {icon}
      <Text className={destructive ? 'font-medium text-destructive text-sm' : 'font-medium text-foreground text-sm'}>
        {label}
      </Text>
    </Pressable>
  );
}

type ChecklistItemProps = { icon: ReactNode; text: string };

// biome-ignore lint/style/useComponentExportOnlyModules: story helper
function ChecklistItem({ icon, text }: ChecklistItemProps) {
  return (
    <View className="flex-row items-center" style={{ gap: 10 }}>
      {icon}
      <Text className="text-muted-foreground text-sm">{text}</Text>
    </View>
  );
}

type OptionsViewProps = { onPrivateKey: () => void; onRecovery: () => void; onClose: () => void };

// biome-ignore lint/style/useComponentExportOnlyModules: story helper
function OptionsView({ onPrivateKey, onRecovery, onClose }: OptionsViewProps) {
  return (
    <View>
      <View className="mb-4 flex-row items-center justify-between">
        <Text className="font-semibold text-base text-foreground">{OPTIONS_TITLE}</Text>
        <CloseButton label={CLOSE_LABEL} onPress={onClose} />
      </View>
      <View style={{ gap: 8 }}>
        <Row icon={<Lock size={16} color="#111111" />} label={PRIVATE_KEY_LABEL} onPress={onPrivateKey} />
        <Row icon={<ScrollText size={16} color="#111111" />} label={RECOVERY_LABEL} onPress={onRecovery} />
        <Row icon={<Trash2 size={16} color="#e5484d" />} label="Remove Wallet" destructive={true} onPress={onClose} />
      </View>
    </View>
  );
}

type PrivateKeyViewProps = { onBack: () => void };

// biome-ignore lint/style/useComponentExportOnlyModules: story helper
function PrivateKeyView({ onBack }: PrivateKeyViewProps) {
  return (
    <View>
      <View className="mb-3 flex-row items-start justify-between">
        <Lock size={20} color="#111111" />
        <CloseButton label={BACK_LABEL} onPress={onBack} />
      </View>
      <Text className="font-semibold text-foreground text-xl">{PRIVATE_KEY_TITLE}</Text>
      <Text className="mt-2 text-muted-foreground text-sm">{PRIVATE_KEY_DESC}</Text>
      <View className="my-4 h-px bg-border" />
      <View style={{ gap: 10 }}>
        <ChecklistItem icon={<ShieldCheck size={16} color="#737373" />} text="Keep your private key safe" />
        <ChecklistItem icon={<ScrollText size={16} color="#737373" />} text="Don't share it with anyone else" />
        <ChecklistItem icon={<Ban size={16} color="#737373" />} text="If you lose it, we can't recover it" />
      </View>
      <View className="mt-5 flex-row" style={{ gap: 8 }}>
        <Button variant="secondary" onPress={onBack} style={{ flex: 1 }}>
          {CANCEL_LABEL}
        </Button>
        <Button onPress={onBack} style={{ flex: 1 }}>
          <ScanFace size={16} color="#fafafa" />
          {REVEAL_LABEL}
        </Button>
      </View>
    </View>
  );
}

type RecoveryViewProps = { onBack: () => void };

// biome-ignore lint/style/useComponentExportOnlyModules: story helper
function RecoveryView({ onBack }: RecoveryViewProps) {
  return (
    <View>
      <View className="mb-3 flex-row items-start justify-between">
        <ScrollText size={20} color="#111111" />
        <CloseButton label={BACK_LABEL} onPress={onBack} />
      </View>
      <Text className="font-semibold text-foreground text-xl">{RECOVERY_TITLE}</Text>
      <Text className="mt-2 text-muted-foreground text-sm">{RECOVERY_DESC}</Text>
      <View className="mt-4 flex-row flex-wrap" style={{ gap: 8 }}>
        {RECOVERY_WORDS.map((word, index) => (
          <View
            key={word}
            className="flex-row rounded-lg border border-border bg-surface px-2 py-1.5"
            style={{ flexBasis: '30%', flexGrow: 1 }}
          >
            <Text className="mr-1 text-muted-foreground text-xs">{`${index + 1}.`}</Text>
            <Text className="text-foreground text-xs">{word}</Text>
          </View>
        ))}
      </View>
      <Button onPress={onBack} style={{ marginTop: 20 }}>
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

type MorphingModalDemoProps = { placement: 'bottom' | 'center' };

// biome-ignore lint/style/useComponentExportOnlyModules: story helper
function MorphingModalDemo({ placement }: MorphingModalDemoProps) {
  const [view, setView] = useState<WalletView>(null);
  const showOptions = useCallback(() => setView('options'), []);
  const close = useCallback(() => setView(null), []);
  const showPrivateKey = useCallback(() => setView('private-key'), []);
  const showRecovery = useCallback(() => setView('recovery'), []);
  return (
    <View className="items-center" style={{ gap: 12 }}>
      <Button onPress={showOptions}>{OPEN_LABEL}</Button>
      <Text className="text-muted-foreground text-xs">{HINT}</Text>
      <MorphingModal viewId={view} onClose={close} placement={placement}>
        {renderModalView(view, { close, showOptions, showPrivateKey, showRecovery })}
      </MorphingModal>
    </View>
  );
}

export default meta;

export const Default: Story = {
  render: () => <MorphingModalDemo placement="bottom" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Open the modal; it lands on the options list, not a detail view.
    await userEvent.click(await canvas.findByText(OPEN_LABEL));
    await expect(await screen.findByText(OPTIONS_TITLE)).toBeTruthy();
  },
};

export const Centered: Story = {
  render: () => <MorphingModalDemo placement="center" />,
};
