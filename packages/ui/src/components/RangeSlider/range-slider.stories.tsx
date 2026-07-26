import type { Meta, StoryObj } from '@storybook/react';
import { type ComponentProps, useState } from 'react';
import { View } from 'react-native';
import { expect, fn, userEvent, within } from 'storybook/test';
import { Choice, Controls, Note, Playground, Sample, Section, Toggle, Variants } from '../../__stories__/story-harness';
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
      <View style={{ width: 340 }}>
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
      <Controls>
        <Choice label="Step" onChange={setStepKey} options={STEPS} value={stepKey} />
        <Toggle label="Ticks" onChange={setShowTicks} value={showTicks} />
        <Toggle label="Disabled" onChange={setDisabled} value={disabled} />
      </Controls>

      <View style={{ gap: 10 }}>
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
        <Variants direction="column" gap={18}>
          {STEPS.map((option) => (
            <Sample key={option.value} label={`step ${option.label}`} style={{ alignSelf: 'stretch' }}>
              <RangeSlider
                accessibilityLabel={`Step ${option.value}`}
                defaultValue={40}
                showTicks={true}
                step={Number(option.value)}
                style={{ alignSelf: 'stretch' }}
              />
            </Sample>
          ))}
        </Variants>
      </Section>

      <Section title="Ranges and states">
        <Variants direction="column" gap={18}>
          <Sample label="−50 to 50, centred at 0" style={{ alignSelf: 'stretch' }}>
            <RangeSlider accessibilityLabel="Balance" defaultValue={0} max={50} min={-50} step={10} />
          </Sample>
          <Sample label="no ticks" style={{ alignSelf: 'stretch' }}>
            <RangeSlider accessibilityLabel="Smooth" defaultValue={72} showTicks={false} step={1} />
          </Sample>
          <Sample label="disabled" style={{ alignSelf: 'stretch' }}>
            <RangeSlider accessibilityLabel="Locked" defaultValue={60} disabled={true} />
          </Sample>
        </Variants>
      </Section>
    </Playground>
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
