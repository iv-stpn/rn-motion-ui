import type { Meta, StoryObj } from '@storybook/react';
import type { ComponentProps } from 'react';
import { useState } from 'react';
import { View } from 'react-native';
import { expect, within } from 'storybook/test';
import { Choice, ControlCard, Playground, Sample, Section, Toggle, Variants } from '../../../__stories__/story-harness';
import { Text } from './text';

const meta = {
  title: 'Typography/Text',
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
    <Playground className="max-w-[420px]">
      <ControlCard title="Options">
        <Choice label="Weight" onChange={setWeight} options={WEIGHTS} value={weight} />
        <Choice label="Size" onChange={setSize} options={SIZES} value={size} />
        <Choice label="Colour" onChange={setColor} options={COLORS} value={color} />
        <Toggle label="Numeric" onChange={setNumeric} value={numeric} />
      </ControlCard>

      <Text {...args} className={color} numeric={numeric} size={size} weight={weight}>
        {sample}
      </Text>

      <Section title="Sizes">
        <Variants direction="column">
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
        <Variants direction="column">
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
        <View className="flex-row gap-8">
          <Sample label="proportional">
            <View className="gap-1">
              {AMOUNTS.map((amount) => (
                <Text {...args} key={amount} numeric={false} size="xl">
                  {amount}
                </Text>
              ))}
            </View>
          </Sample>
          <Sample label="numeric">
            <View className="gap-1">
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

const BASE_TESTID = 'text-base';
const OVERRIDE_TESTID = 'text-override';
const SMALL_TESTID = 'text-small';
const LARGE_TESTID = 'text-large';
const NUMERIC_TESTID = 'text-numeric';

export default meta;

/** Every weight, size, colour token and the tabular-figure mode in one story:
 *  drive the top line with the controls, or read the rows below. */
export const Interactive: Story = { render: (args) => <TextPlayground {...args} /> };

/**
 * Text has no behaviour to drive — its entire contract is that props and
 * `className` resolve to the right utilities, and that when they disagree the
 * caller's `className` wins. That last part is the fragile one: the override
 * only works because `cn` recognises `text-foreground` and
 * `text-muted-foreground` as the same group and drops the earlier one. Group
 * membership is a hand-maintained table, so a colour that stops being
 * recognised leaves *both* classes on the element and hands the decision to
 * stylesheet order — silently, and only for some tokens.
 *
 * So this is a real assertion rather than the render-only exemption the
 * component would otherwise get: the base colour, the override beating it, the
 * size scale moving, and the numeric cut applying.
 */
export const Default: Story = {
  name: 'Demo: Props and className resolve',
  render: () => (
    <View>
      <Text testID={BASE_TESTID}>{PANGRAM}</Text>
      <Text className="text-muted-foreground" testID={OVERRIDE_TESTID}>
        {PANGRAM}
      </Text>
      <Text size="xs" testID={SMALL_TESTID}>
        {PANGRAM}
      </Text>
      <Text size="2xl" testID={LARGE_TESTID}>
        {PANGRAM}
      </Text>
      <Text numeric={true} testID={NUMERIC_TESTID}>
        {AMOUNTS[0]}
      </Text>
    </View>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Probe with the utility class itself: comparing against a resolved token
    // keeps the assertion sRGB-vs-sRGB and survives a retint of the token.
    const probe = document.createElement('div');
    canvasElement.appendChild(probe);
    const colorOf = (utility: string) => {
      probe.className = utility;
      const { color } = getComputedStyle(probe);
      // A class the scanner never registered contributes nothing, and the two
      // sides would then agree on the inherited colour for the wrong reason.
      expect(color).not.toBe('');
      return color;
    };

    try {
      const foreground = colorOf('text-foreground');
      const muted = colorOf('text-muted-foreground');
      expect(foreground).not.toBe(muted);

      expect(getComputedStyle(await canvas.findByTestId(BASE_TESTID)).color).toBe(foreground);
      // Last-wins: the base `text-foreground` must be gone, not merely outranked.
      expect(getComputedStyle(await canvas.findByTestId(OVERRIDE_TESTID)).color).toBe(muted);
    } finally {
      probe.remove();
    }

    const fontSize = async (testID: string) => Number.parseFloat(getComputedStyle(await canvas.findByTestId(testID)).fontSize);
    expect(await fontSize(SMALL_TESTID)).toBeLessThan(await fontSize(LARGE_TESTID));

    // `numeric` is a three-utility bundle; tabular figures are the one with a
    // computed style to read back.
    const numeric = getComputedStyle(await canvas.findByTestId(NUMERIC_TESTID));
    expect(numeric.fontVariantNumeric).toContain('tabular-nums');
  },
};
