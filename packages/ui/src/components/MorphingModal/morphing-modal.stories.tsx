import type { Meta, StoryObj } from '@storybook/react';
import { type ReactNode, useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { expect, fn, screen, userEvent, within } from 'storybook/test';
import { Lock, ScrollText, Trash2 } from '../../lib/icons';
import { Button } from '../Button/button';
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

type View_ = 'options' | 'private-key' | 'recovery' | null;

const CLOSE_LABEL = 'Close';
const OPEN_LABEL = 'Open wallet options';
const PRIVATE_KEY_TITLE = 'Private Key';
const PRIVATE_KEY_DESC = 'Your Private Key is the key used to back up your wallet. Keep it secret and secure.';
const RECOVERY_TITLE = 'Recovery Phrase';
const RECOVERY_DESC = '12 words you can use to restore your wallet on any device.';
const BACK_LABEL = 'Back';

// biome-ignore lint/style/useComponentExportOnlyModules: story helper
function Header({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <View className="mb-4 flex-row items-center justify-between">
      <Text className="font-semibold text-base text-foreground">{title}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose}>
        <Text className="text-muted-foreground text-sm">{CLOSE_LABEL}</Text>
      </Pressable>
    </View>
  );
}

// biome-ignore lint/style/useComponentExportOnlyModules: story helper
function Row({ icon, label, onPress }: { icon: ReactNode; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="mb-2 flex-row items-center gap-3 rounded-2xl bg-muted px-4 py-3"
    >
      {icon}
      <Text className="font-medium text-foreground text-sm">{label}</Text>
    </Pressable>
  );
}

type ModalViewCallbacks = {
  close: () => void;
  showOptions: () => void;
  showPrivateKey: () => void;
  showRecovery: () => void;
};

function renderModalView(view: View_, callbacks: ModalViewCallbacks): ReactNode {
  const { close, showOptions, showPrivateKey, showRecovery } = callbacks;
  if (view === 'options')
    return (
      <View>
        <Header title="Options" onClose={close} />
        <Row icon={<Lock size={16} color="#111111" />} label="View Private Key" onPress={showPrivateKey} />
        <Row icon={<ScrollText size={16} color="#111111" />} label="View Recovery Phrase" onPress={showRecovery} />
        <Row icon={<Trash2 size={16} color="#e5484d" />} label="Remove Wallet" onPress={close} />
      </View>
    );
  if (view === 'private-key')
    return (
      <View style={{ gap: 8 }}>
        <Text className="font-semibold text-foreground text-xl">{PRIVATE_KEY_TITLE}</Text>
        <Text className="text-muted-foreground text-sm">{PRIVATE_KEY_DESC}</Text>
        <Button variant="secondary" onPress={showOptions}>
          {BACK_LABEL}
        </Button>
      </View>
    );
  if (view === 'recovery')
    return (
      <View style={{ gap: 8 }}>
        <Text className="font-semibold text-foreground text-xl">{RECOVERY_TITLE}</Text>
        <Text className="text-muted-foreground text-sm">{RECOVERY_DESC}</Text>
        <Button variant="secondary" onPress={showOptions}>
          {BACK_LABEL}
        </Button>
      </View>
    );
  return null;
}

// biome-ignore lint/style/useComponentExportOnlyModules: story helper
function MorphingModalDemo({ placement }: { placement: 'bottom' | 'center' }) {
  const [view, setView] = useState<View_>(null);
  const showOptions = useCallback(() => setView('options'), []);
  const close = useCallback(() => setView(null), []);
  const showPrivateKey = useCallback(() => setView('private-key'), []);
  const showRecovery = useCallback(() => setView('recovery'), []);
  return (
    <View style={{ gap: 12 }}>
      <Button onPress={showOptions}>{OPEN_LABEL}</Button>
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
    // Open the modal, then morph to another view; the panel resizes to content.
    await userEvent.click(await canvas.findByText(OPEN_LABEL));
    await expect(await screen.findByText('Options')).toBeTruthy();
    await userEvent.click(await screen.findByText('View Private Key'));
    await expect(await screen.findByText(PRIVATE_KEY_TITLE)).toBeTruthy();
  },
};

export const Centered: Story = {
  render: () => <MorphingModalDemo placement="center" />,
};
