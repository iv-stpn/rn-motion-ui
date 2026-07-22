import type { Meta, StoryObj } from '@storybook/react';
import { View } from 'react-native';
import { expect, within } from 'storybook/test';
import { Text } from '../Text/text';
import { Loader, type LoaderVariant } from './loader';

const meta = {
  title: 'Components/Loader',
  component: Loader,
  parameters: { layout: 'centered' },
  // No `color` arg: leave it unset so each variant resolves its colour from
  // `useThemeColor('foreground')` and adapts to the active theme toolbar. A
  // hardcoded `color` here would pin every loader to that swatch in both light
  // and dark mode, hiding the dark-mode adaptivity the default is meant to give.
  args: { variant: 'spinner', size: 36, speed: 1, label: 'Loading' },
  argTypes: {
    variant: {
      control: 'select',
      options: [
        'spinner',
        'dots',
        'bars',
        'dot-matrix',
        'dither',
        'comet',
        'scramble',
        'newton',
        'helix',
        'percent',
        'ascii',
        'ascii-line',
        'ascii-braille',
        'ascii-blocks',
        'ascii-bounce',
      ] satisfies LoaderVariant[],
    },
    size: { control: { type: 'range', min: 16, max: 96, step: 4 } },
    speed: { control: { type: 'range', min: 0.25, max: 3, step: 0.25 } },
  },
} satisfies Meta<typeof Loader>;

type Story = StoryObj<typeof meta>;

const GALLERY: LoaderVariant[] = [
  'spinner',
  'dots',
  'bars',
  'dot-matrix',
  'dither',
  'comet',
  'scramble',
  'newton',
  'helix',
  'percent',
  'ascii',
  'ascii-line',
  'ascii-braille',
  'ascii-blocks',
  'ascii-bounce',
];

export default meta;

export const Spinner: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The accessible progressbar role is always present regardless of variant.
    await expect(await canvas.findByLabelText('Loading')).toBeInTheDocument();
  },
};

export const Dots: Story = { args: { variant: 'dots' } };
export const Bars: Story = { args: { variant: 'bars' } };
export const Percent: Story = { args: { variant: 'percent' } };
export const Scramble: Story = { args: { variant: 'scramble' } };

export const Gallery: Story = {
  render: (args) => (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 32, maxWidth: 520, justifyContent: 'center' }}>
      {GALLERY.map((variant) => (
        <View key={variant} style={{ alignItems: 'center', gap: 12, width: 90 }}>
          <View style={{ height: 48, justifyContent: 'center' }}>
            <Loader {...args} variant={variant} />
          </View>
          <Text style={{ fontSize: 11, color: '#71717a' }}>{variant}</Text>
        </View>
      ))}
    </View>
  ),
};
