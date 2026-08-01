import type { Meta, StoryObj } from '@storybook/react';
import { type ComponentProps, useState } from 'react';
import { expect, fn, userEvent, within } from 'storybook/test';
import { Controls, Playground, Sample, Section, Toggle, Variants } from '../../__stories__/story-harness';
import { Switch } from './switch';

const meta = {
  title: 'Components/Switch',
  component: Switch,
  parameters: { layout: 'centered' },
  args: { isSelected: false, label: 'Enable notifications', onSelectedChange: fn() },
} satisfies Meta<typeof Switch>;

type Story = StoryObj<typeof meta>;

const noop = () => {
  /* static sample */
};

// biome-ignore lint/style/useComponentExportOnlyModules: story helper
function SwitchPlayground(args: ComponentProps<typeof Switch>) {
  const [on, setOn] = useState(true);
  const [disabled, setDisabled] = useState(false);

  return (
    <Playground>
      <Controls>
        <Toggle label="Disabled" onChange={setDisabled} value={disabled} />
      </Controls>

      <Switch {...args} isSelected={on} isDisabled={disabled} label="Enable notifications" onSelectedChange={setOn} />

      <Section title="States">
        <Variants direction="column">
          <Sample label="Off">
            <Switch {...args} isSelected={false} label="Off" onSelectedChange={noop} />
          </Sample>
          <Sample label="On">
            <Switch {...args} isSelected={true} label="On" onSelectedChange={noop} />
          </Sample>
          {/* Pressing a disabled switch runs a short 2px shake instead of toggling. */}
          <Sample label="Disabled, off">
            <Switch {...args} isSelected={false} isDisabled={true} label="Disabled" onSelectedChange={noop} />
          </Sample>
          <Sample label="Disabled, on">
            <Switch {...args} isSelected={true} isDisabled={true} label="Disabled" onSelectedChange={noop} />
          </Sample>
        </Variants>
      </Section>
    </Playground>
  );
}

export default meta;

/** Toggle the live switch, flip it to disabled, and compare every track/thumb
 *  state below. */
export const Interactive: Story = {
  render: (args) => <SwitchPlayground {...args} />,
};

export const Default: Story = {
  name: 'Demo: Toggle on',
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const toggle = await canvas.findByRole('switch');
    await userEvent.click(toggle);
    await expect(args.onSelectedChange).toHaveBeenCalledWith(true);
  },
};
