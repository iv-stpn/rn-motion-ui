import type { Meta, StoryObj } from '@storybook/react';
import { type ComponentProps, useCallback, useState } from 'react';
import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { expect, fn, userEvent, within } from 'storybook/test';
import { Choice, ControlCard, Playground, Sample, Section, Toggle, Variants } from '../../../__stories__/story-harness';
import { useThemeColors } from '../../../theme/use-theme-color';
import { StarRating, type StarRenderProps } from './star-rating';

const meta = {
  title: 'Form/StarRating',
  component: StarRating,
  parameters: { layout: 'centered' },
  args: { onValueChange: fn() },
  argTypes: {
    size: { control: 'select', options: ['sm', 'md', 'lg'] },
    max: { control: { type: 'number', min: 1, max: 10 } },
  },
} satisfies Meta<typeof StarRating>;

type Story = StoryObj<typeof meta>;

const SIZES = ['sm', 'md', 'lg'] as const;
const MAX_VALUES = ['5', '10'] as const;
const HEART_PATH =
  'M12 21s-6.7-4.35-9.33-8.02C.6 10.1 1.4 6.3 4.4 4.9 6.6 3.86 9.2 4.6 12 7.6c2.8-3 5.4-3.74 7.6-2.7 3 1.4 3.8 5.2 1.73 8.08C18.7 16.65 12 21 12 21z';

// Custom shape passed to `renderStar` — proves the prop takes any node, not just stars.
function renderHeart({ size, color, filled }: StarRenderProps) {
  return (
    <Svg height={size} viewBox="0 0 24 24" width={size}>
      <Path d={HEART_PATH} fill={filled ? color : 'none'} stroke={color} strokeLinejoin="round" strokeWidth={2} />
    </Svg>
  );
}

function StarRatingPlayground(args: ComponentProps<typeof StarRating>) {
  const [size, setSize] = useState<(typeof SIZES)[number]>('md');
  const [maxKey, setMaxKey] = useState<(typeof MAX_VALUES)[number]>('5');
  const [showValue, setShowValue] = useState(true);
  const [allowClear, setAllowClear] = useState(true);
  const [round, setRound] = useState(true);
  const [rating, setRating] = useState(3);

  const colors = useThemeColors();
  const max = Number(maxKey);
  const handleChange = useCallback(
    (next: number) => {
      setRating(next);
      args.onValueChange?.(next);
    },
    [args.onValueChange],
  );

  return (
    <Playground>
      <ControlCard title="Options">
        <Choice label="Size" onChange={setSize} options={SIZES} value={size} />
        <Choice label="Max" onChange={setMaxKey} options={MAX_VALUES} value={maxKey} />
        <Toggle label="Show value" onChange={setShowValue} value={showValue} />
        <Toggle label="Allow clear" onChange={setAllowClear} value={allowClear} />
        <Toggle label="Round tips" onChange={setRound} value={round} />
      </ControlCard>

      <View className="flex-row items-center gap-4">
        <StarRating
          {...args}
          allowClear={allowClear}
          max={max}
          onValueChange={handleChange}
          round={round}
          showValue={showValue}
          size={size}
          value={Math.min(rating, max)}
        />
      </View>

      <Section title="Sizes">
        <Variants direction="column">
          {SIZES.map((name) => (
            <Sample align="center" key={name} label={name}>
              <StarRating defaultValue={3} showValue={true} size={name} />
            </Sample>
          ))}
        </Variants>
      </Section>

      <Section title="Read-only (fractional values allowed)">
        <Variants direction="column">
          <Sample label="3 / 5">
            <StarRating readOnly={true} value={3} />
          </Sample>
          <Sample label="3.7 / 5">
            <StarRating readOnly={true} showValue={true} value={3.7} />
          </Sample>
          <Sample label="4.3 / 10">
            <StarRating max={10} readOnly={true} showValue={true} value={4.3} />
          </Sample>
        </Variants>
      </Section>

      <Section title="Custom colours and shape">
        <Variants direction="column">
          <Sample label="activeStarColor / inactiveStarColor">
            <StarRating
              activeStarColor={colors.primary}
              defaultValue={4}
              inactiveStarColor={colors['surface-5']}
              showValue={true}
            />
          </Sample>
          <Sample label="renderStar">
            <StarRating activeStarColor={colors.danger} defaultValue={2} renderStar={renderHeart} />
          </Sample>
        </Variants>
      </Section>
    </Playground>
  );
}

export default meta;

/** One live rating plus every display mode: switch size, max, clearing and the
 *  value label with the controls, or read the rows below for the fixed states. */
export const Interactive: Story = { render: (args) => <StarRatingPlayground {...args} /> };

export const Default: Story = {
  name: 'Demo: Rate four stars',
  args: { showValue: true, testID: 'story-stars' },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const fourth = await canvas.findByRole('radio', { name: '4 stars' });
    await userEvent.click(fourth);
    await expect(args.onValueChange).toHaveBeenCalledWith(4);
    // Each star is addressable by position as well as by name. The read-only
    // branch draws its own stars under the same `-star-<n>` suffix, so a test
    // can target the fourth star without knowing which branch rendered it.
    await expect(canvas.getByTestId('story-stars-star-4')).toBe(fourth);
  },
};
