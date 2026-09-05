import type { Meta, StoryObj } from '@storybook/react';
import { type ComponentProps, useState } from 'react';
import { View } from 'react-native';
import { expect, waitFor, within } from 'storybook/test';
import { Choice, ControlCard, Playground, Sample, Toggle } from '../../../__stories__/story-harness';
import { Text } from '../../typography/Text/text';
import { Glass } from './glass';

const meta = {
  title: 'Display/Glass',
  component: Glass,
  parameters: { layout: 'centered' },
  args: { blurRadius: 20, borderRadius: 0, rim: true },
  argTypes: {
    blurRadius: { control: { type: 'range', min: 0, max: 60, step: 1 } },
    borderRadius: { control: { type: 'range', min: 0, max: 40, step: 1 } },
    rim: { control: 'boolean' },
  },
} satisfies Meta<typeof Glass>;

type Story = StoryObj<typeof meta>;

const BLUR_OPTIONS = ['8', '20', '40'] as const;
const RADIUS_OPTIONS = ['0', '12', '24'] as const;
const RIM_LABEL = 'Rim';
const BLUR_LABEL = 'Blur';
const RADIUS_LABEL = 'Radius';
const GLASS_LABEL = 'Glass';
const BACKDROP_LABEL = 'A colourful backdrop to frost';
const TRANSPARENT = 'rgba(0, 0, 0, 0)';

type RadiusKey = (typeof RADIUS_OPTIONS)[number];
type BlurKey = (typeof BLUR_OPTIONS)[number];

function GlassPlayground(args: ComponentProps<typeof Glass>) {
  const [rim, setRim] = useState(true);
  const [blurKey, setBlurKey] = useState<BlurKey>('20');
  const [radiusKey, setRadiusKey] = useState<RadiusKey>('0');
  const blurRadius = Number(blurKey);
  const borderRadius = Number(radiusKey);

  return (
    <Playground>
      <ControlCard title="Options">
        <Toggle label={RIM_LABEL} onChange={setRim} value={rim} />
        <Choice label={BLUR_LABEL} onChange={setBlurKey} options={BLUR_OPTIONS} value={blurKey} />
        <Choice label={RADIUS_LABEL} onChange={setRadiusKey} options={RADIUS_OPTIONS} value={radiusKey} />
      </ControlCard>

      <Sample label={GLASS_LABEL}>
        <View className="relative h-40 w-[280px] overflow-hidden rounded-xl">
          {/* Striped colour bars sit behind the glass so the blur has something to frost. */}
          <View className="absolute inset-0 flex-row">
            <View className="flex-1 bg-danger" />
            <View className="flex-1 bg-warning" />
            <View className="flex-1 bg-success" />
            <View className="flex-1 bg-primary" />
          </View>
          <Glass {...args} borderRadius={borderRadius} blurRadius={blurRadius} className="m-4 p-4" rim={rim}>
            <Text weight="semibold" className="text-foreground text-sm">
              {BACKDROP_LABEL}
            </Text>
          </Glass>
        </View>
      </Sample>
    </Playground>
  );
}

export default meta;

/** The three knobs the primitive exposes — blur radius, corner radius, and the
 *  rim. Drive the pane with the chips; the colour bars behind it make the frost
 *  read. */
export const Interactive: Story = { render: (args) => <GlassPlayground {...args} /> };

/**
 * The web twin is one CSS declaration pair — a translucent `glass` fill over a
 * `backdrop-filter` blur — plus the `Rim` SVG edge light. This pins the fill and
 * blur against the `glass` token they must resolve to, and confirms the rim
 * actually draws its stroke, so a retint of `--color-glass` survives the
 * comparison and a scanner miss fails open (transparent fill or a missing rim)
 * rather than passing vacuously.
 */
export const BlurTintAndRimResolveFromTokens: Story = {
  render: () => (
    <View className="bg-background">
      <Glass testID="glass-probe" className="h-24 w-[280px]" />
    </View>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const glass = await canvas.findByTestId('glass-probe');

    // Resolve the token the same way the browser resolved the inline style, so
    // the comparison is sRGB-vs-sRGB (the component reads `--color-glass` via the
    // `bg-glass` utility, and the browser resolves the oklch var → sRGB).
    const probe = document.createElement('div');
    canvasElement.appendChild(probe);
    const resolveToken = (token: string) => {
      probe.style.backgroundColor = `var(${token})`;
      const resolved = getComputedStyle(probe).backgroundColor;
      // An undefined custom property leaves the declaration invalid, so the
      // probe falls back to transparent — which is also what a missing token
      // yields on the glass. Asserting non-transparent keeps the comparisons
      // from passing vacuously when both sides are "nothing".
      expect(resolved).not.toBe(TRANSPARENT);
      return resolved;
    };

    try {
      const style = getComputedStyle(glass);

      // The frost is the CSS `backdrop-filter`, not a background wash: the fill
      // is translucent (alpha < 1) and composites over the blur.
      expect(style.backdropFilter).toContain('blur(');
      expect(style.backgroundColor).toBe(resolveToken('--color-glass'));
      expect(style.backgroundColor).not.toBe(TRANSPARENT);

      // The rim is an SVG stroke layer that mounts once the host has measured —
      // react-native-svg renders real `<svg>`/`<rect>` DOM on web. Its stroke
      // must be a real colour (the solid accent), not the transparent fallback,
      // or the edge light drew nothing.
      await waitFor(() => {
        const rect = glass.querySelector('svg rect');
        expect(rect).toBeTruthy();
        const stroke = rect?.getAttribute('stroke');
        expect(stroke).toBeTruthy();
        expect(stroke).not.toBe('none');
      });
    } finally {
      probe.remove();
    }
  },
};
