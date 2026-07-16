import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { expect, fn, userEvent, within } from 'storybook/test';
import { RadioGroup, RadioGroupItem } from './radio';

const meta = {
  title: 'Components/Radio',
  component: RadioGroup,
  parameters: { layout: 'centered' },
  // `children` is required on RadioGroup; the render below supplies the real
  // items, so this only satisfies the CSF3 type (render ignores args.children).
  args: { defaultValue: 'pro', onValueChange: fn(), children: null },
  argTypes: {
    orientation: { control: 'select', options: ['vertical', 'horizontal'] },
  },
  render: (args) => (
    <RadioGroup {...args}>
      <RadioGroupItem value="starter" label="Starter — free" />
      <RadioGroupItem value="pro" label="Pro — $12/mo" />
      <RadioGroupItem value="team" label="Team — $29/mo" />
      <RadioGroupItem value="legacy" label="Legacy plan" disabled />
    </RadioGroup>
  ),
} satisfies Meta<typeof RadioGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    // Select Starter by its accessible name; the change fires with its value.
    const starter = await canvas.findByRole('radio', { name: 'Starter — free' });
    await userEvent.click(starter);
    await expect(args.onValueChange).toHaveBeenCalledWith('starter');
  },
};

export const Horizontal: Story = { args: { orientation: 'horizontal' } };

export const Interactive: Story = {
  render: (args) => {
    const [plan, setPlan] = useState('pro');
    return (
      <RadioGroup {...args} value={plan} onValueChange={setPlan}>
        <RadioGroupItem value="starter" label="Starter — free" />
        <RadioGroupItem value="pro" label="Pro — $12/mo" />
        <RadioGroupItem value="team" label="Team — $29/mo" />
        <RadioGroupItem value="legacy" label="Legacy plan" disabled />
      </RadioGroup>
    );
  },
};
