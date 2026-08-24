import type { Meta, StoryObj } from '@storybook/react';
import { type ComponentProps, useState } from 'react';
import { View } from 'react-native';
import { expect, within } from 'storybook/test';
import { Choice, ControlCard, Playground, Sample, Section, Toggle, Variants } from '../../../__stories__/story-harness';
import { SURFACE_LEVELS, type SurfaceElevation, type SurfaceLevel } from '../../../lib/elevated';
import { Text } from '../../typography/Text/text';
import { Card, type CardSize } from './card';

const meta = {
  title: 'Display/Card',
  component: Card,
  parameters: { layout: 'centered' },
  args: { size: 'md', elevation: 3, elevated: true },
  argTypes: {
    size: { control: 'select', options: ['compact', 'md', 'lg'] },
    elevation: { control: { type: 'range', min: 0, max: 8, step: 1 } },
    elevated: { control: 'boolean' },
  },
} satisfies Meta<typeof Card>;

type Story = StoryObj<typeof meta>;

const SIZES = ['compact', 'md', 'lg'] as const satisfies readonly CardSize[];
const SIZE_LABELS: Record<CardSize, string> = { compact: 'Compact', md: 'Medium', lg: 'Large' };
const ELEVATION_KEYS = ['0', '1', '2', '3', '4', '5', '6', '7', '8'] as const;
const TITLE = 'Card title';
const BODY = 'A container for grouping related content.';

type ElevationKey = (typeof ELEVATION_KEYS)[number];

function CardPlayground(args: ComponentProps<typeof Card>) {
  const [size, setSize] = useState<CardSize>('md');
  const [elevationKey, setElevationKey] = useState<ElevationKey>('3');
  const [elevated, setElevated] = useState(true);
  // The chips carry strings; the ladder is numeric. `0` is the flat resting
  // surface — otherwise the chip value indexes the ladder's own levels.
  const elevation: SurfaceElevation = elevationKey === '0' ? 0 : (SURFACE_LEVELS[Number(elevationKey) - 1] ?? 3);

  return (
    <Playground>
      <ControlCard title="Options">
        <Choice label="Size" onChange={setSize} options={SIZES} value={size} />
        <Toggle label="Elevated" onChange={setElevated} value={elevated} />
        <Choice label="Elevation" onChange={setElevationKey} options={ELEVATION_KEYS} value={elevationKey} />
      </ControlCard>

      <Card {...args} elevation={elevation} elevated={elevated} size={size} className="w-[280px]">
        <Text weight="semibold" className="text-base text-foreground">
          {TITLE}
        </Text>
        <Text className="text-muted-foreground text-sm">{BODY}</Text>
      </Card>

      <View className="h-3" />
      {/* Elevation drives both the surface fill and the shadow recipe, so the
          ladder is best read as a stack — each step is one surface token up. */}
      <Section title="Elevation ladder">
        <View className="gap-3">
          <Card {...args} elevation={0} elevated={elevated} size={size} className="w-[280px]">
            <Text weight="semibold" className="text-foreground text-sm">
              Flat (0)
            </Text>
          </Card>
          {SURFACE_LEVELS.map((level) => (
            <Card {...args} elevation={level} elevated={elevated} key={level} size={size} className="w-[280px]">
              <Text weight="semibold" className="text-foreground text-sm">{`Elevation ${level}`}</Text>
            </Card>
          ))}
        </View>
      </Section>

      <Section title="Sizes">
        <Variants direction="column">
          {SIZES.map((name) => (
            <Sample key={name} label={name}>
              <Card {...args} elevation={elevation} elevated={elevated} size={name}>
                <Text weight="semibold" className="text-foreground text-sm">
                  {SIZE_LABELS[name]}
                </Text>
              </Card>
            </Sample>
          ))}
        </Variants>
      </Section>
    </Playground>
  );
}

const ladderTestID = (level: SurfaceElevation) => `card-elevation-${level}`;
const PROBED_LEVELS = [1, 3, 6] as const satisfies readonly SurfaceLevel[];
const TRANSPARENT = 'rgba(0, 0, 0, 0)';

export default meta;

/** Both axes the card exposes — the 0–8 surface/shadow ladder (0 is flat) and the
 *  three padding sizes. Drive the top card with the chips, or compare the rows below. */
export const Interactive: Story = { render: (args) => <CardPlayground {...args} /> };

/**
 * The whole of `elevation` is that one number drives a *pair* of utilities —
 * `bg-surface-N` and `shadow-elevated-N` — so fill and rim stay calibrated at
 * the same rung. Nothing else in the component enforces that, and a scanner
 * miss fails open: an unregistered class renders as no background and no
 * shadow, which looks merely flat rather than broken.
 *
 * This pins both halves against the tokens they must resolve to. The shadows
 * are additionally compared across levels, because in light mode every surface
 * from 3 up is pure white — the shadow is the only thing that moves, so a
 * background-only assertion would pass on a ladder that had stopped laddering.
 */
export const ElevationPairsSurfaceAndShadow: Story = {
  render: () => (
    <View className="gap-3">
      <Card elevation={0} className="w-[280px]" testID={ladderTestID(0)}>
        <Text weight="semibold" className="text-foreground text-sm">
          Flat (0)
        </Text>
      </Card>
      {SURFACE_LEVELS.map((level) => (
        <Card elevation={level} key={level} className="w-[280px]" testID={ladderTestID(level)}>
          <Text weight="semibold" className="text-foreground text-sm">{`Elevation ${level}`}</Text>
        </Card>
      ))}
    </View>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Probe with the utility classes themselves rather than the raw tokens:
    // Tailwind never emits `--shadow-elevated-N` as a custom property, it
    // inlines the value into `--tw-shadow` and composes the final box-shadow
    // out of five layers (inset, inset-ring, ring-offset, ring, shadow). Only
    // an element carrying the real class reproduces that composition.
    const probe = document.createElement('div');
    canvasElement.appendChild(probe);
    const expectedFor = (level: SurfaceLevel) => {
      probe.className = `bg-surface-${level} shadow-elevated-${level}`;
      const { backgroundColor, boxShadow } = getComputedStyle(probe);
      // A class the scanner never registered simply doesn't exist, leaving the
      // probe transparent and shadowless — which is also what a card with no
      // surface classes looks like. Pinning the probe to real values first
      // keeps the comparisons below from passing vacuously.
      expect(backgroundColor).not.toBe(TRANSPARENT);
      expect(boxShadow).not.toBe('none');
      return { backgroundColor, boxShadow };
    };
    // One await for the render; the whole ladder mounts in the same pass, so
    // the rest of the lookups are synchronous.
    await canvas.findByTestId(ladderTestID(1));
    const cardStyle = (level: SurfaceElevation) => getComputedStyle(canvas.getByTestId(ladderTestID(level)));

    try {
      for (const level of PROBED_LEVELS) {
        const expected = expectedFor(level);
        const actual = cardStyle(level);
        expect(actual.backgroundColor).toBe(expected.backgroundColor);
        expect(actual.boxShadow).toBe(expected.boxShadow);
      }

      // Elevation 0 is the flat resting surface: a surface-3 fill, no shadow/border.
      const flat = cardStyle(0);
      probe.className = 'bg-surface-3';
      expect(flat.backgroundColor).toBe(getComputedStyle(probe).backgroundColor);
      expect(flat.boxShadow).toBe('none');

      // …and the rungs are actually distinct, not eight aliases of one recipe.
      // In light mode every surface from 3 up is pure white, so the shadow is
      // the only thing that moves — a background-only check would pass on a
      // ladder that had stopped laddering.
      expect(cardStyle(3).boxShadow).not.toBe(cardStyle(6).boxShadow);
    } finally {
      probe.remove();
    }
  },
};
