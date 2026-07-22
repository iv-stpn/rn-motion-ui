import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { View } from 'react-native';
import { expect, within } from 'storybook/test';
import { Text } from '../Text/text';
import { CylinderCarousel } from './cylinder-carousel';

const SLIDES = [
  { label: 'Aurora', color: '#6a7bff' },
  { label: 'Ember', color: '#ff6a3d' },
  { label: 'Citrus', color: '#ffce54' },
  { label: 'Mint', color: '#00ffb2' },
  { label: 'Grape', color: '#9f50d3' },
  { label: 'Coral', color: '#ff5cf4' },
  { label: 'Ocean', color: '#4d9eff' },
  { label: 'Slate', color: '#8a8a9a' },
];

const meta = {
  title: 'Components/CylinderCarousel',
  component: CylinderCarousel,
  parameters: { layout: 'centered' },
  args: {
    itemSize: 120,
    visibleItems: 5,
    variant: 'convex',
    minScale: 0.55,
    snap: true,
    autoRotate: false,
    children: null,
  },
  argTypes: {
    variant: { control: 'select', options: ['concave', 'convex'] },
    minScale: { control: { type: 'range', min: 0.2, max: 1, step: 0.05 } },
    itemSize: { control: { type: 'range', min: 80, max: 240, step: 10 } },
    snap: { control: 'boolean' },
    autoRotate: { control: 'boolean' },
  },
} satisfies Meta<typeof CylinderCarousel>;

type Story = StoryObj<typeof meta>;

const DRAG_HINT = 'Drag to roll';

type BallProps = { label: string; color: string };

// biome-ignore lint/style/useComponentExportOnlyModules: story helper
function Ball({ label, color }: BallProps) {
  return (
    <View
      style={{
        flex: 1,
        borderRadius: 999,
        backgroundColor: color,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.08)',
      }}
    >
      <Text style={{ color: '#ffffff', fontWeight: '600', fontSize: 15 }}>{label}</Text>
    </View>
  );
}

// Mirrors the web preview's concave/convex toggle.
// biome-ignore lint/style/useComponentExportOnlyModules: story helper
function VariantDemo() {
  const [variant, setVariant] = useState<'concave' | 'convex'>('concave');
  return (
    <View style={{ width: 480, paddingVertical: 24, gap: 12, alignItems: 'center' }}>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {(['concave', 'convex'] as const).map((v) => (
          <Text
            key={v}
            // biome-ignore lint/performance/noJsxPropsBind: story demo handler
            onPress={() => setVariant(v)}
            testID={`variant-${v}`}
            style={{
              paddingHorizontal: 14,
              paddingVertical: 6,
              borderRadius: 999,
              overflow: 'hidden',
              fontSize: 13,
              color: variant === v ? '#ffffff' : '#111111',
              backgroundColor: variant === v ? '#111111' : '#f4f4f5',
            }}
          >
            {v}
          </Text>
        ))}
      </View>
      <CylinderCarousel variant={variant} itemSize={120} height={200} minScale={0.5}>
        {SLIDES.map((s) => (
          <Ball key={s.label} label={s.label} color={s.color} />
        ))}
      </CylinderCarousel>
    </View>
  );
}

export default meta;

export const Default: Story = {
  render: (args) => (
    <View style={{ width: 480, paddingVertical: 24 }}>
      <CylinderCarousel {...args} testID="cylinder" height={200}>
        {SLIDES.map((s) => (
          <Ball key={s.label} label={s.label} color={s.color} />
        ))}
      </CylinderCarousel>
      <Text style={{ textAlign: 'center', marginTop: 12, fontSize: 12, color: '#71717a' }}>{DRAG_HINT}</Text>
    </View>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByTestId('cylinder')).toBeInTheDocument();
    // All items are mounted (positioned around the ring).
    await expect(await canvas.findByText('Aurora')).toBeInTheDocument();
  },
};

export const ConcaveConvex: Story = {
  render: () => <VariantDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByTestId('variant-convex')).toBeInTheDocument();
  },
};
