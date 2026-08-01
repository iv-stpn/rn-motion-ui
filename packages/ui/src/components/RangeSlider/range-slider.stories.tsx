import type { Meta, StoryObj } from '@storybook/react';
import { type ComponentProps, useState } from 'react';
import { View } from 'react-native';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { Choice, ControlCard, Note, Playground, Sample, Section, Toggle, Variants } from '../../__stories__/story-harness';
import { DirectionProvider } from '../../hooks/direction-provider';
import { RangeSlider } from './range-slider';

const meta = {
  title: 'Components/RangeSlider',
  component: RangeSlider,
  parameters: { layout: 'centered' },
  args: { defaultValue: 40, min: 0, max: 100, step: 5, accessibilityLabel: 'Value', onValueChange: fn() },
  argTypes: {
    min: { control: 'number' },
    max: { control: 'number' },
    step: { control: 'number' },
    showTicks: { control: 'boolean' },
  },
  decorators: [
    (Story) => (
      <View className="w-[340px]">
        <Story />
      </View>
    ),
  ],
} satisfies Meta<typeof RangeSlider>;

type Story = StoryObj<typeof meta>;

const STEPS = [
  { value: '1', label: '1 (continuous)' },
  { value: '5', label: '5' },
  { value: '25', label: '25' },
] as const;

type StepKey = (typeof STEPS)[number]['value'];

// biome-ignore lint/style/useComponentExportOnlyModules: story helper
function RangeSliderPlayground(args: ComponentProps<typeof RangeSlider>) {
  const [value, setValue] = useState(40);
  const [stepKey, setStepKey] = useState<StepKey>('5');
  const [showTicks, setShowTicks] = useState(true);
  const [disabled, setDisabled] = useState(false);

  // Ticks are drawn one per step, so a step of 1 over 0–100 would draw 101 of
  // them — the chip and the toggle are worth trying together.
  const step = Number(stepKey);

  return (
    <Playground>
      <ControlCard title="Options">
        <Choice label="Step" onChange={setStepKey} options={STEPS} value={stepKey} />
        <Toggle label="Ticks" onChange={setShowTicks} value={showTicks} />
        <Toggle label="Disabled" onChange={setDisabled} value={disabled} />
      </ControlCard>

      <View className="gap-2.5">
        <RangeSlider
          {...args}
          accessibilityLabel="Value"
          disabled={disabled}
          onValueChange={setValue}
          showTicks={showTicks}
          step={step}
          value={value}
        />
        <Note testID="story-value">{`Value ${value}`}</Note>
      </View>

      <Section title="Steps">
        <Variants direction="column">
          {STEPS.map((option) => (
            <Sample key={option.value} label={`step ${option.label}`} className="self-stretch">
              <RangeSlider
                accessibilityLabel={`Step ${option.value}`}
                defaultValue={40}
                showTicks={true}
                step={Number(option.value)}
                className="self-stretch"
              />
            </Sample>
          ))}
        </Variants>
      </Section>

      <Section title="Ranges and states">
        <Variants direction="column">
          <Sample label="−50 to 50, centred at 0" className="self-stretch">
            <RangeSlider accessibilityLabel="Balance" defaultValue={0} max={50} min={-50} step={10} />
          </Sample>
          <Sample label="no ticks" className="self-stretch">
            <RangeSlider accessibilityLabel="Smooth" defaultValue={72} showTicks={false} step={1} />
          </Sample>
          <Sample label="disabled" className="self-stretch">
            <RangeSlider accessibilityLabel="Locked" defaultValue={60} disabled={true} />
          </Sample>
        </Variants>
      </Section>
    </Playground>
  );
}

const DIRECTION_STYLES = { ltr: { direction: 'ltr' }, rtl: { direction: 'rtl' } } as const;
const RTL_TRACK_WIDTH = 300;

type DirectionalSliderProps = { direction: 'ltr' | 'rtl' };

// biome-ignore lint/style/useComponentExportOnlyModules: story helper co-located with its stories
function DirectionalSlider({ direction }: DirectionalSliderProps) {
  return (
    <DirectionProvider value={direction}>
      <View style={{ ...DIRECTION_STYLES[direction], width: RTL_TRACK_WIDTH }}>
        <RangeSlider
          accessibilityLabel={`Value (${direction})`}
          defaultValue={25}
          max={100}
          min={0}
          showTicks={false}
          step={1}
          testID={`slider-${direction}`}
        />
      </View>
    </DirectionProvider>
  );
}

export default meta;

/** One live slider with a readout, plus the step/tick/range combinations. Ticks
 *  are drawn per step, so `showTicks` only reads well on a coarse step. */
export const Interactive: Story = { render: (args) => <RangeSliderPlayground {...args} /> };

export const Default: Story = {
  name: 'Demo: Adjust the value',
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const slider = await canvas.findByRole('slider');
    await userEvent.click(slider);
    await expect(args.onValueChange).toHaveBeenCalled();
  },
};

/**
 * A slider has no measured geometry to inherit a mirroring from — every part of
 * it is pinned to a physical edge, and `locationX` is the distance from the
 * physical left of the track whichever way the page reads. So under RTL all
 * four have to be flipped together, or they disagree with each other: the
 * pointer mapping, the fill's growth origin, the thumb's travel, and the tick
 * positions.
 *
 * Both directions render the same `value={25}`, so every assertion below is a
 * comparison rather than a hard-coded pixel: the thumb sits a quarter of the way
 * in *from the minimum end*, and the two ends are opposite.
 */
export const RightToLeft: Story = {
  name: 'Demo: Mirrors under RTL',
  render: () => (
    <View className="gap-6">
      <DirectionalSlider direction="ltr" />
      <DirectionalSlider direction="rtl" />
    </View>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const ltr = await canvas.findByTestId('slider-ltr');
    const rtl = await canvas.findByTestId('slider-rtl');

    // The thumb is the only absolutely-positioned child that moves; the fill is
    // the one that spans and scales.
    const childBox = (track: HTMLElement, index: number) => {
      const child = track.children[index];
      if (!(child instanceof HTMLElement)) throw new Error(`No child ${index}`);
      return child.getBoundingClientRect();
    };
    const trackBox = (track: HTMLElement) => track.getBoundingClientRect();

    // The thumb's offset comes from an animated style that lands after the
    // track's first layout pass, so nothing is measurable until it has moved.
    await waitFor(() => expect(childBox(ltr, 2).left - trackBox(ltr).left).toBeGreaterThan(1));

    // At 25%, the filled portion hugs the minimum end — left in LTR, right in RTL.
    const ltrFill = childBox(ltr, 0);
    const rtlFill = childBox(rtl, 0);
    expect(ltrFill.left - trackBox(ltr).left).toBeLessThan(2);
    expect(trackBox(rtl).right - rtlFill.right).toBeLessThan(2);
    // …and it is a quarter of the track, not the whole thing, in both.
    expect(ltrFill.width).toBeLessThan(trackBox(ltr).width * 0.5);
    expect(rtlFill.width).toBeLessThan(trackBox(rtl).width * 0.5);

    // The thumb sits a quarter in from opposite ends.
    const ltrThumbOffset = childBox(ltr, 2).left - trackBox(ltr).left;
    const rtlThumbOffset = trackBox(rtl).right - childBox(rtl, 2).right;
    expect(Math.abs(ltrThumbOffset - rtlThumbOffset)).toBeLessThan(4);
    // Guards against the mirroring being a no-op: at 25% the thumb is nearer one
    // end, so the two directions must land in different halves of the track.
    expect(ltrThumbOffset).toBeLessThan(trackBox(ltr).width * 0.4);

    // The pointer mapping has to agree with the paint. Pressing the same
    // physical spot means opposite values in the two directions.
    const pressAt = async (track: HTMLElement, fraction: number) => {
      const box = track.getBoundingClientRect();
      const coords = { clientX: box.left + box.width * fraction, clientY: box.top + box.height / 2 };
      await userEvent.pointer([
        { keys: '[MouseLeft>]', target: track, coords },
        { keys: '[/MouseLeft]', target: track },
      ]);
    };

    await pressAt(ltr, 0.25);
    await pressAt(rtl, 0.25);
    // A quarter along physically: a low value reading left-to-right, a high one
    // reading right-to-left.
    expect(Number(ltr.getAttribute('aria-valuenow'))).toBeLessThan(40);
    expect(Number(rtl.getAttribute('aria-valuenow'))).toBeGreaterThan(60);
  },
};
