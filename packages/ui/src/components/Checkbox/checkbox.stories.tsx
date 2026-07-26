import type { Meta, StoryObj } from '@storybook/react';
import { type ComponentProps, useState } from 'react';
import { View } from 'react-native';
import { expect, fn, userEvent, within } from 'storybook/test';
import { Controls, Playground, Sample, Section, Toggle, Variants } from '../../__stories__/story-harness';
import { Checkbox } from './checkbox';

const meta = {
  title: 'Components/Checkbox',
  component: Checkbox,
  parameters: { layout: 'centered' },
  args: { checked: false, label: 'Accept terms and conditions', onCheckedChange: fn() },
} satisfies Meta<typeof Checkbox>;

type Story = StoryObj<typeof meta>;

const TERMS_LABEL = 'Accept terms and conditions';

// biome-ignore lint/style/useComponentExportOnlyModules: story helper
function CheckboxPlayground(args: ComponentProps<typeof Checkbox>) {
  const [checked, setChecked] = useState(true);
  const [disabled, setDisabled] = useState(false);
  const [indeterminate, setIndeterminate] = useState(false);

  return (
    <Playground>
      <Controls>
        <Toggle label="Disabled" onChange={setDisabled} value={disabled} />
        <Toggle label="Indeterminate" onChange={setIndeterminate} value={indeterminate} />
      </Controls>

      <Checkbox {...args} checked={checked} disabled={disabled} indeterminate={indeterminate} onCheckedChange={setChecked} />

      <View style={{ height: 12 }} />
      <Section title="States">
        <Variants direction="column" gap={12}>
          <Sample label="Unchecked">
            <Checkbox {...args} checked={false} label="Unchecked" onCheckedChange={args.onCheckedChange} />
          </Sample>
          <Sample label="Checked">
            <Checkbox {...args} checked={true} label="Checked" onCheckedChange={args.onCheckedChange} />
          </Sample>
          <Sample label="Indeterminate">
            <Checkbox
              {...args}
              checked={true}
              indeterminate={true}
              label="Select all (partial)"
              onCheckedChange={args.onCheckedChange}
            />
          </Sample>
          <Sample label="Disabled, checked">
            <Checkbox {...args} checked={true} disabled={true} label="Disabled" onCheckedChange={args.onCheckedChange} />
          </Sample>
          <Sample label="Disabled, unchecked">
            <Checkbox {...args} checked={false} disabled={true} label="Disabled" onCheckedChange={args.onCheckedChange} />
          </Sample>
        </Variants>
      </Section>
    </Playground>
  );
}

export default meta;

/** Drive the live box with the controls; the column below holds every state
 *  (including the ones a press can't reach, like indeterminate and disabled). */
export const Interactive: Story = {
  args: { label: TERMS_LABEL },
  render: (args) => <CheckboxPlayground {...args} />,
};

export const Default: Story = {
  name: 'Demo: Toggle on',
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const box = await canvas.findByRole('checkbox');
    await userEvent.click(box);
    await expect(args.onCheckedChange).toHaveBeenCalledWith(true);
  },
};
