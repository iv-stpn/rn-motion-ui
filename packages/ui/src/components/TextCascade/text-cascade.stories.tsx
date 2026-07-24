import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { View } from 'react-native';
import { expect, within } from 'storybook/test';
import { useMountEffect } from '../../hooks/use-mount-effect';
import { Text } from '../Text/text';
import { TextCascade } from './text-cascade';

const meta = {
  title: 'Components/TextCascade',
  component: TextCascade,
  parameters: { layout: 'centered' },
  args: {
    text: 'Install skills',
    className: 'text-lg font-medium text-foreground',
  },
} satisfies Meta<typeof TextCascade>;

type Story = StoryObj<typeof meta>;

const PHRASES = ['Install skills', 'Open settings', 'Ship updates'];
const FAST_PHRASES = ['Syncing', 'Merging', 'Deploying'];
const STEADY_LABEL = 'steady';
const FAST_LABEL = 'fast';

type CascadeDemoProps = { phrases: string[]; interval: number; className?: string };

// Cycles the label every few seconds so the letter-by-letter roll is visible.
// biome-ignore lint/style/useComponentExportOnlyModules: story helper
function CascadeDemo({ phrases, interval, className }: CascadeDemoProps) {
  const [phrase, setPhrase] = useState(0);
  useMountEffect(() => {
    const id = setInterval(() => setPhrase((p) => (p + 1) % phrases.length), interval);
    return () => clearInterval(id);
  });
  const current = phrases[phrase % phrases.length] ?? phrases[0] ?? '';
  return (
    <View style={{ minWidth: 200, alignItems: 'center' }}>
      <TextCascade text={current} className={className} />
    </View>
  );
}

export default meta;

export const AllVariants: Story = {
  name: 'All variants',
  render: (args) => (
    <View style={{ gap: 24, alignItems: 'center' }}>
      <View style={{ gap: 8, alignItems: 'center' }}>
        <Text className="text-muted-foreground text-xs">{STEADY_LABEL}</Text>
        <CascadeDemo phrases={PHRASES} interval={2400} className={args.className} />
      </View>
      <View style={{ gap: 8, alignItems: 'center' }}>
        <Text className="text-muted-foreground text-xs">{FAST_LABEL}</Text>
        <CascadeDemo phrases={FAST_PHRASES} interval={1400} className={args.className} />
      </View>
    </View>
  ),
};

/** Cycles the label every few seconds so the letter-by-letter roll is visible. */
export const Cycling: Story = {
  render: (args) => <CascadeDemo phrases={PHRASES} interval={2400} className={args.className} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The current phrase is exposed as the accessible label.
    await expect(await canvas.findByLabelText('Install skills')).toBeInTheDocument();
  },
};
