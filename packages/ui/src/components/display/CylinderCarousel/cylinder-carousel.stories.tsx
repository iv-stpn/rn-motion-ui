import type { Meta, StoryObj } from '@storybook/react';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { expect, within } from 'storybook/test';
import { Choice, ControlCard, Note, Playground, Sample, Section, Toggle, Variants } from '../../../__stories__/story-harness';
import { cn } from '../../../lib/cn';
import { Text } from '../../typography/Text/text';
import { CylinderCarousel, type CylinderCarouselVariant } from './cylinder-carousel';

const SLIDES = [
  { label: 'Aurora', bgClass: 'bg-[#6a7bff]' },
  { label: 'Ember', bgClass: 'bg-[#ff6a3d]' },
  { label: 'Citrus', bgClass: 'bg-[#ffce54]' },
  { label: 'Mint', bgClass: 'bg-[#00ffb2]' },
  { label: 'Grape', bgClass: 'bg-[#9f50d3]' },
  { label: 'Coral', bgClass: 'bg-[#ff5cf4]' },
  { label: 'Ocean', bgClass: 'bg-[#4d9eff]' },
  { label: 'Slate', bgClass: 'bg-[#8a8a9a]' },
];

const meta = {
  title: 'Display/CylinderCarousel',
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
const STAGE_HEIGHT = 200;

const VARIANTS = ['concave', 'convex'] as const satisfies readonly CylinderCarouselVariant[];
const ITEM_SIZES = ['90', '120', '160'] as const;
const SLOTS = ['3', '5', '7'] as const;
const MIN_SCALES = ['0.3', '0.55', '0.8'] as const;

type BallProps = { label: string; bgClass: string };

// biome-ignore lint/style/useComponentExportOnlyModules: story helper
function Ball({ label, bgClass }: BallProps) {
  return (
    <View className={cn('flex-1 items-center justify-center rounded-full border border-[rgba(0,0,0,0.08)]', bgClass)}>
      <Text className="font-semibold text-[15px] text-white">{label}</Text>
    </View>
  );
}

/** The eight balls, rebuilt per carousel instance (children can't be shared). */
function balls() {
  return SLIDES.map((slide) => <Ball bgClass={slide.bgClass} key={slide.label} label={slide.label} />);
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
    <Playground className="w-120">
      <ControlCard title="Options">
        <Choice label="Variant" onChange={setVariant} options={VARIANTS} value={variant} />
        <Choice label="Item size" onChange={setItemSizeKey} options={ITEM_SIZES} value={itemSizeKey} />
        <Choice label="Visible slots" onChange={setSlotsKey} options={SLOTS} value={slotsKey} />
        <Choice label="Min scale" onChange={setMinScaleKey} options={MIN_SCALES} value={minScaleKey} />
        <Toggle label="Snap" onChange={setSnap} value={snap} />
        <Toggle label="Auto-rotate" onChange={setAutoRotate} value={autoRotate} />
      </ControlCard>

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

      <View className="h-3" />
      <Section title="Convex rolls on the outside, concave on the inside">
        <Variants align="stretch" direction="column">
          {VARIANTS.map((option) => (
            <Sample key={option} label={option}>
              <CylinderCarousel height={160} itemSize={90} minScale={0.5} className="w-120" variant={option}>
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
