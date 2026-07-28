import type { Meta, StoryObj } from '@storybook/react';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { expect, within } from 'storybook/test';
import { Choice, Controls, Note, Playground, Sample, Section, Toggle, Variants } from '../../__stories__/story-harness';
import { Text } from '../Text/text';
import { CylinderCarousel, type CylinderCarouselVariant } from './cylinder-carousel';

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

const DRAG_HINT = 'Drag the ring — or flick it and let the momentum settle.';
/** The default `accessibilityValueText` shape: "3 of 12". */
const POSITION_TEXT = /^\d+ of \d+$/;
const STAGE_WIDTH = 480;
const STAGE_HEIGHT = 200;

const VARIANTS = ['concave', 'convex'] as const satisfies readonly CylinderCarouselVariant[];
const ITEM_SIZES = ['90', '120', '160'] as const;
const SLOTS = ['3', '5', '7'] as const;
const MIN_SCALES = ['0.3', '0.55', '0.8'] as const;

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

/** The eight balls, rebuilt per carousel instance (children can't be shared). */
function balls() {
  return SLIDES.map((slide) => <Ball color={slide.color} key={slide.label} label={slide.label} />);
}

// biome-ignore lint/style/useComponentExportOnlyModules: story helper
function CarouselPlayground() {
  const [variant, setVariant] = useState<CylinderCarouselVariant>('convex');
  const [itemSizeKey, setItemSizeKey] = useState<(typeof ITEM_SIZES)[number]>('120');
  const [slotsKey, setSlotsKey] = useState<(typeof SLOTS)[number]>('5');
  const [minScaleKey, setMinScaleKey] = useState<(typeof MIN_SCALES)[number]>('0.55');
  const [snap, setSnap] = useState(true);
  const [autoRotate, setAutoRotate] = useState(false);
  const [index, setIndex] = useState(0);

  const handleIndexChange = useCallback((next: number) => setIndex(next), []);
  const front = SLIDES[index % SLIDES.length]?.label ?? '';

  return (
    <Playground style={{ width: STAGE_WIDTH }}>
      <Controls>
        <Choice label="Variant" onChange={setVariant} options={VARIANTS} value={variant} />
        <Choice label="Item size" onChange={setItemSizeKey} options={ITEM_SIZES} value={itemSizeKey} />
        <Choice label="Visible slots" onChange={setSlotsKey} options={SLOTS} value={slotsKey} />
        <Choice label="Min scale" onChange={setMinScaleKey} options={MIN_SCALES} value={minScaleKey} />
        <Toggle label="Snap" onChange={setSnap} value={snap} />
        <Toggle label="Auto-rotate" onChange={setAutoRotate} value={autoRotate} />
      </Controls>

      <CylinderCarousel
        autoRotate={autoRotate}
        height={STAGE_HEIGHT}
        itemSize={Number(itemSizeKey)}
        minScale={Number(minScaleKey)}
        onIndexChange={handleIndexChange}
        snap={snap}
        testID="cylinder"
        variant={variant}
        visibleItems={Number(slotsKey)}
      >
        {balls()}
      </CylinderCarousel>
      <Note testID="story-front">{`Front: ${front} · ${DRAG_HINT}`}</Note>

      <View style={{ height: 12 }} />
      <Section title="Convex rolls on the outside, concave on the inside">
        <Variants align="stretch" direction="column" gap={12}>
          {VARIANTS.map((option) => (
            <Sample key={option} label={option}>
              <CylinderCarousel height={160} itemSize={90} minScale={0.5} style={{ width: STAGE_WIDTH }} variant={option}>
                {balls()}
              </CylinderCarousel>
            </Sample>
          ))}
        </Variants>
      </Section>
    </Playground>
  );
}

export default meta;

/** Roll the ring by dragging (or wheel on web); every knob that shapes the cylinder is live. */
export const Interactive: Story = {
  render: () => <CarouselPlayground />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const cylinder = await canvas.findByTestId('cylinder');
    await expect(cylinder).toBeInTheDocument();
    // Every item is mounted at once, positioned around the ring — one per carousel on screen.
    const auroras = await canvas.findAllByText('Aurora');
    await expect(auroras.length).toBeGreaterThan(0);

    // Without a role the carousel is a drag surface with no non-pointer way in
    // at all. "adjustable" is what gives VoiceOver/TalkBack the swipe-to-change
    // gesture, and the value is what tells the user where they are in the ring.
    // `adjustable` is React Native's name for it; react-native-web translates
    // it to the ARIA role with the same meaning, which is `slider`.
    expect(cylinder).toHaveAttribute('role', 'slider');
    expect(cylinder).toHaveAttribute('aria-valuemin', '0');
    expect(cylinder).toHaveAttribute('aria-valuenow');
    // The `text` form matters more than the number here — "3" alone says nothing.
    expect(cylinder.getAttribute('aria-valuetext')).toMatch(POSITION_TEXT);
  },
};
