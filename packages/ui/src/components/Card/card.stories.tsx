import type { Meta, StoryObj } from '@storybook/react';
import { type ComponentProps, useState } from 'react';
import { View } from 'react-native';
import { Choice, Controls, Playground, Sample, Section, Variants } from '../../__stories__/story-harness';
import { SURFACE_LEVELS, type SurfaceLevel } from '../../lib/elevated';
import { Text } from '../Text/text';
import { Card, type CardSize } from './card';

const meta = {
  title: 'Components/Card',
  component: Card,
  parameters: { layout: 'centered' },
  args: { size: 'md', elevation: 3 },
  argTypes: {
    size: { control: 'select', options: ['compact', 'md', 'lg'] },
    elevation: { control: { type: 'range', min: 1, max: 8, step: 1 } },
  },
} satisfies Meta<typeof Card>;

type Story = StoryObj<typeof meta>;

const CARD_WIDTH = 280;
const SIZES = ['compact', 'md', 'lg'] as const satisfies readonly CardSize[];
const SIZE_LABELS: Record<CardSize, string> = { compact: 'Compact', md: 'Medium', lg: 'Large' };
const ELEVATION_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8'] as const;
const TITLE = 'Card title';
const BODY = 'A container for grouping related content.';

type ElevationKey = (typeof ELEVATION_KEYS)[number];

// biome-ignore lint/style/useComponentExportOnlyModules: story helper
function CardPlayground(args: ComponentProps<typeof Card>) {
  const [size, setSize] = useState<CardSize>('md');
  const [elevationKey, setElevationKey] = useState<ElevationKey>('3');
  // The chips carry strings; the ladder is numeric, and the index is safe because
  // the chip values are exactly the ladder's own levels.
  const elevation: SurfaceLevel = SURFACE_LEVELS[Number(elevationKey) - 1] ?? 3;

  return (
    <Playground>
      <Controls>
        <Choice label="Size" onChange={setSize} options={SIZES} value={size} />
        <Choice label="Elevation" onChange={setElevationKey} options={ELEVATION_KEYS} value={elevationKey} />
      </Controls>

      <Card {...args} elevation={elevation} size={size} style={{ width: CARD_WIDTH }}>
        <Text className="font-semibold text-base text-foreground">{TITLE}</Text>
        <Text className="text-muted-foreground text-sm">{BODY}</Text>
      </Card>

      <View style={{ height: 12 }} />
      {/* Elevation drives both the surface fill and the shadow recipe, so the
          ladder is best read as a stack — each step is one surface token up. */}
      <Section title="Elevation ladder">
        <View style={{ gap: 12 }}>
          {SURFACE_LEVELS.map((level) => (
            <Card {...args} elevation={level} key={level} size={size} style={{ width: CARD_WIDTH }}>
              <Text className="font-semibold text-foreground text-sm">{`Elevation ${level}`}</Text>
            </Card>
          ))}
        </View>
      </Section>

      <Section title="Sizes">
        <Variants direction="column" gap={12}>
          {SIZES.map((name) => (
            <Sample key={name} label={name}>
              <Card {...args} elevation={elevation} size={name} style={{ width: CARD_WIDTH }}>
                <Text className="font-semibold text-foreground text-sm">{SIZE_LABELS[name]}</Text>
              </Card>
            </Sample>
          ))}
        </Variants>
      </Section>
    </Playground>
  );
}

export default meta;

/** Both axes the card exposes — the 1–8 surface/shadow ladder and the three
 *  padding sizes. Drive the top card with the chips, or compare the rows below. */
export const Interactive: Story = { render: (args) => <CardPlayground {...args} /> };
