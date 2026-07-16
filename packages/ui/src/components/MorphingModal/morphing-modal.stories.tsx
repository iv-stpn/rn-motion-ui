import type { Meta, StoryObj } from '@storybook/react';
import { type ReactNode, useState } from 'react';
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

export default meta;
type Story = StoryObj<typeof meta>;

type View_ = 'options' | 'private-key' | 'recovery' | null;

function Header({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <View className="mb-4 flex-row items-center justify-between">
      <Text className="text-base font-semibold text-foreground">{title}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose}>
        <Text className="text-sm text-muted-foreground">Close</Text>
      </Pressable>
    </View>
  );
}

function Row({ icon, label, onPress }: { icon: ReactNode; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="mb-2 flex-row items-center gap-3 rounded-2xl bg-muted px-4 py-3"
    >
      {icon}
      <Text className="text-sm font-medium text-foreground">{label}</Text>
    </Pressable>
  );
}

function MorphingModalDemo({ placement }: { placement: 'bottom' | 'center' }) {
  const [view, setView] = useState<View_>(null);
  return (
    <View style={{ gap: 12 }}>
      <Button onPress={() => setView('options')}>Open wallet options</Button>
      <MorphingModal viewId={view} onClose={() => setView(null)} placement={placement}>
        {view === 'options' ? (
          <View>
            <Header title="Options" onClose={() => setView(null)} />
            <Row icon={<Lock size={16} color="#111111" />} label="View Private Key" onPress={() => setView('private-key')} />
            <Row
              icon={<ScrollText size={16} color="#111111" />}
              label="View Recovery Phrase"
              onPress={() => setView('recovery')}
            />
            <Row icon={<Trash2 size={16} color="#e5484d" />} label="Remove Wallet" onPress={() => setView(null)} />
          </View>
        ) : view === 'private-key' ? (
          <View style={{ gap: 8 }}>
            <Text className="text-xl font-semibold text-foreground">Private Key</Text>
            <Text className="text-sm text-muted-foreground">
              Your Private Key is the key used to back up your wallet. Keep it secret and secure.
            </Text>
            <Button variant="secondary" onPress={() => setView('options')}>
              Back
            </Button>
          </View>
        ) : view === 'recovery' ? (
          <View style={{ gap: 8 }}>
            <Text className="text-xl font-semibold text-foreground">Recovery Phrase</Text>
            <Text className="text-sm text-muted-foreground">12 words you can use to restore your wallet on any device.</Text>
            <Button variant="secondary" onPress={() => setView('options')}>
              Back
            </Button>
          </View>
        ) : null}
      </MorphingModal>
    </View>
  );
}

export const Default: Story = {
  render: () => <MorphingModalDemo placement="bottom" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Open the modal, then morph to another view; the panel resizes to content.
    await userEvent.click(await canvas.findByText('Open wallet options'));
    await expect(await screen.findByText('Options')).toBeTruthy();
    await userEvent.click(await screen.findByText('View Private Key'));
    await expect(await screen.findByText('Private Key')).toBeTruthy();
  },
};

export const Centered: Story = {
  render: () => <MorphingModalDemo placement="center" />,
};
