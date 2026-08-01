import type { Meta, StoryObj } from '@storybook/react';
import { type ComponentProps, useState } from 'react';
import { View } from 'react-native';
import { expect, within } from 'storybook/test';
import { Choice, ControlRow, Controls, Playground, Sample, Section, Toggle, Variants } from '../../__stories__/story-harness';
import { useThemeColors } from '../../theme/use-theme-color';
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
      options: ['spinner', 'dots', 'bars', 'dot-matrix', 'dither'] satisfies LoaderVariant[],
    },
    size: { control: { type: 'range', min: 16, max: 96, step: 4 } },
    speed: { control: { type: 'range', min: 0.25, max: 3, step: 0.25 } },
  },
} satisfies Meta<typeof Loader>;

type Story = StoryObj<typeof meta>;

const GALLERY = ['spinner', 'dots', 'bars', 'dot-matrix', 'dither'] as const satisfies readonly LoaderVariant[];

const SIZES = ['24', '36', '56'] as const;
const SPEEDS = [
  { value: '0.5', label: '0.5× (slow)' },
  { value: '1', label: '1×' },
  { value: '2', label: '2× (fast)' },
] as const;

type SpeedKey = (typeof SPEEDS)[number]['value'];

// biome-ignore lint/style/useComponentExportOnlyModules: story helper
function LoaderPlayground(args: ComponentProps<typeof Loader>) {
  const [variant, setVariant] = useState<LoaderVariant>('spinner');
  const [sizeKey, setSizeKey] = useState<(typeof SIZES)[number]>('36');
  const [speedKey, setSpeedKey] = useState<SpeedKey>('1');
  const [tinted, setTinted] = useState(false);

  const colors = useThemeColors();
  const size = Number(sizeKey);
  // `speed` is seconds per cycle, so a "2× fast" chip has to halve it.
  const speed = 1 / Number(speedKey);
  const color = tinted ? colors.primary : undefined;

  return (
    <Playground className="max-w-[540px]">
      <Controls>
        <ControlRow>
          <Choice label="Variant" onChange={setVariant} options={GALLERY} value={variant} />
          <Choice label="Size" onChange={setSizeKey} options={SIZES} value={sizeKey} />
          <Choice label="Speed" onChange={setSpeedKey} options={SPEEDS} value={speedKey} />
        </ControlRow>
        <ControlRow>
          <Toggle label="Tinted" onChange={setTinted} value={tinted} />
        </ControlRow>
      </Controls>

      <View className="h-24 items-center justify-center">
        <Loader {...args} color={color} size={size} speed={speed} variant={variant} />
      </View>

      <View className="h-3" />
      <Section title="Every variant">
        <Variants>
          {GALLERY.map((name) => (
            <Sample align="center" key={name} label={name} className="w-[84px]">
              <View className="h-12 justify-center">
                <Loader {...args} color={color} size={32} speed={speed} variant={name} />
              </View>
            </Sample>
          ))}
        </Variants>
      </Section>

      <Section title="Sizes">
        <Variants align="center">
          {SIZES.map((key) => (
            <Sample align="center" key={key} label={`${key}px`}>
              <Loader {...args} color={color} size={Number(key)} speed={speed} variant={variant} />
            </Sample>
          ))}
        </Variants>
      </Section>
    </Playground>
  );
}

export default meta;

/** Pick a variant, size and speed with the controls, or scan the gallery below
 *  for all five animations side-by-side. */
export const Interactive: Story = { render: (args) => <LoaderPlayground {...args} /> };

export const Spinner: Story = {
  name: 'Demo: Announces loading',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The accessible progressbar role is always present regardless of variant.
    await expect(await canvas.findByLabelText('Loading')).toBeInTheDocument();
  },
};
