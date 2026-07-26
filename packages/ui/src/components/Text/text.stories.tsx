import type { Meta, StoryObj } from '@storybook/react';
import type { ComponentProps } from 'react';
import { useState } from 'react';
import { View } from 'react-native';
import { Choice, Controls, Playground, Sample, Section, Toggle, Variants } from '../../__stories__/story-harness';
import { Text } from './text';

const meta = {
  title: 'Components/Text',
  component: Text,
  parameters: { layout: 'centered' },
  args: { weight: 'normal', size: 'base', children: 'The quick brown fox jumps over the lazy dog' },
  argTypes: {
    weight: { control: 'select', options: ['normal', 'medium', 'semibold', 'bold'] },
    size: { control: 'select', options: ['xs', 'sm', 'base', 'lg', 'xl', '2xl'] },
    numeric: { control: 'boolean' },
  },
} satisfies Meta<typeof Text>;

type Story = StoryObj<typeof meta>;

const WEIGHTS = ['normal', 'medium', 'semibold', 'bold'] as const;
const SIZES = ['xs', 'sm', 'base', 'lg', 'xl', '2xl'] as const;
const COLORS = [
  { value: 'text-foreground', label: 'foreground' },
  { value: 'text-muted-foreground', label: 'muted' },
  { value: 'text-primary', label: 'primary' },
  { value: 'text-danger', label: 'danger' },
] as const;
const PANGRAM = 'The quick brown fox jumps over the lazy dog';
const AMOUNTS = ['$1,234.50', '$42.00', '$999.99', '$12,345.67'];

type ColorClass = (typeof COLORS)[number]['value'];

// biome-ignore lint/style/useComponentExportOnlyModules: story helper
function TextPlayground(args: ComponentProps<typeof Text>) {
  const [weight, setWeight] = useState<(typeof WEIGHTS)[number]>('normal');
  const [size, setSize] = useState<(typeof SIZES)[number]>('base');
  const [color, setColor] = useState<ColorClass>('text-foreground');
  const [numeric, setNumeric] = useState(false);

  // Digits make the `numeric` cut legible; prose makes the weights legible.
  const sample = numeric ? AMOUNTS.join('  ') : PANGRAM;

  return (
    <Playground style={{ maxWidth: 420 }}>
      <Controls>
        <Choice label="Weight" onChange={setWeight} options={WEIGHTS} value={weight} />
        <Choice label="Size" onChange={setSize} options={SIZES} value={size} />
        <Choice label="Colour" onChange={setColor} options={COLORS} value={color} />
        <Toggle label="Numeric" onChange={setNumeric} value={numeric} />
      </Controls>

      <Text {...args} className={color} numeric={numeric} size={size} weight={weight}>
        {sample}
      </Text>

      <Section title="Sizes">
        <Variants direction="column" gap={10}>
          {SIZES.map((name) => (
            <Sample key={name} label={name}>
              <Text {...args} size={name} weight={weight}>
                {PANGRAM}
              </Text>
            </Sample>
          ))}
        </Variants>
      </Section>

      <Section title="Weights">
        <Variants direction="column" gap={10}>
          {WEIGHTS.map((name) => (
            <Sample key={name} label={name}>
              <Text {...args} size="lg" weight={name}>
                {PANGRAM}
              </Text>
            </Sample>
          ))}
        </Variants>
      </Section>

      <Section title="Colours">
        <Variants>
          {COLORS.map((token) => (
            <Text {...args} className={token.value} key={token.value} size="base" weight="medium">
              {token.label}
            </Text>
          ))}
        </Variants>
      </Section>

      {/* Tabular figures only pay off in a column: the `numeric` digits line up
          across rows while the proportional ones drift. */}
      <Section title="Numeric (tabular figures)">
        <View style={{ flexDirection: 'row', gap: 32 }}>
          <Sample label="proportional">
            <View style={{ gap: 4 }}>
              {AMOUNTS.map((amount) => (
                <Text {...args} key={amount} numeric={false} size="xl">
                  {amount}
                </Text>
              ))}
            </View>
          </Sample>
          <Sample label="numeric">
            <View style={{ gap: 4 }}>
              {AMOUNTS.map((amount) => (
                <Text {...args} key={amount} numeric={true} size="xl">
                  {amount}
                </Text>
              ))}
            </View>
          </Sample>
        </View>
      </Section>
    </Playground>
  );
}

export default meta;

/** Every weight, size, colour token and the tabular-figure mode in one story:
 *  drive the top line with the controls, or read the rows below. */
export const Interactive: Story = { render: (args) => <TextPlayground {...args} /> };
