import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { Choice, ControlCard, Note, Playground, Section, Toggle } from '../../../__stories__/story-harness';
import { RadioGroup, RadioGroupItem } from './radio';

const meta = {
  title: 'Form/Radio',
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
      <RadioGroupItem value="legacy" label="Legacy plan" disabled={true} />
    </RadioGroup>
  ),
} satisfies Meta<typeof RadioGroup>;

type Story = StoryObj<typeof meta>;

const ORIENTATIONS = ['vertical', 'horizontal'] as const;
const PLANS = [
  { value: 'starter', label: 'Starter — free' },
  { value: 'pro', label: 'Pro — $12/mo' },
  { value: 'team', label: 'Team — $29/mo' },
] as const;

function RadioPlayground() {
  const [orientation, setOrientation] = useState<(typeof ORIENTATIONS)[number]>('vertical');
  const [showDisabled, setShowDisabled] = useState(true);
  const [plan, setPlan] = useState('pro');

  return (
    <Playground>
      <ControlCard title="Options">
        <Choice label="Orientation" onChange={setOrientation} options={ORIENTATIONS} value={orientation} />
        <Toggle label="Disabled item" onChange={setShowDisabled} value={showDisabled} />
      </ControlCard>

      <Section>
        <RadioGroup onValueChange={setPlan} orientation={orientation} value={plan}>
          {PLANS.map((item) => (
            <RadioGroupItem key={item.value} label={item.label} value={item.value} />
          ))}
          {showDisabled ? <RadioGroupItem disabled={true} label="Legacy plan" value="legacy" /> : null}
        </RadioGroup>
      </Section>

      <Note testID="story-selected-plan">{`Selected: ${plan}`}</Note>
    </Playground>
  );
}

export default meta;

/** Both orientations plus the disabled item, driven live. A disabled item stays
 *  in the tab order but never commits a selection. */
export const Interactive: Story = {
  render: () => <RadioPlayground />,
};

export const Default: Story = {
  name: 'Demo: Select an option',
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    // Select Starter by its accessible name; the change fires with its value.
    const starter = await canvas.findByRole('radio', { name: 'Starter — free' });
    await userEvent.click(starter);
    await expect(args.onValueChange).toHaveBeenCalledWith('starter');
  },
};

export const Keyboard: Story = {
  name: 'Keyboard: arrow keys rove selection and focus',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const starter = await canvas.findByRole('radio', { name: 'Starter — free' });
    const pro = await canvas.findByRole('radio', { name: 'Pro — $12/mo' });
    const team = await canvas.findByRole('radio', { name: 'Team — $29/mo' });
    const legacy = await canvas.findByRole('radio', { name: 'Legacy plan' });

    // The selected radio (pro) is the roving-tabindex owner; focus it, then rove down.
    pro.focus();
    await userEvent.keyboard('{ArrowDown}');
    await waitFor(() => expect(team).toHaveAttribute('aria-checked', 'true'));
    await expect(team).toHaveFocus();

    // Down from the last enabled radio wraps to the first, skipping the disabled
    // legacy item.
    await userEvent.keyboard('{ArrowDown}');
    await waitFor(() => expect(starter).toHaveAttribute('aria-checked', 'true'));
    await expect(starter).toHaveFocus();
    await expect(legacy).toHaveAttribute('aria-checked', 'false');

    // Up reverses and wraps from the first back to the last enabled.
    await userEvent.keyboard('{ArrowUp}');
    await waitFor(() => expect(team).toHaveAttribute('aria-checked', 'true'));
    await expect(team).toHaveFocus();
  },
};
