import type { Meta, StoryObj } from '@storybook/react';
import { type ComponentProps, useState } from 'react';
import { expect, fn, userEvent, within } from 'storybook/test';
import { Controls, Playground, Sample, Section, Toggle, Variants } from '../../__stories__/story-harness';
import { Switch } from './switch';

const meta = {
  title: 'Components/Switch',
  component: Switch,
  parameters: { layout: 'centered' },
  args: { checked: false, label: 'Enable notifications', onCheckedChange: fn() },
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

      <Switch {...args} checked={on} disabled={disabled} label="Enable notifications" onCheckedChange={setOn} />

      <Section title="States">
        <Variants direction="column">
          <Sample label="Off">
            <Switch {...args} checked={false} label="Off" onCheckedChange={noop} />
          </Sample>
          <Sample label="On">
            <Switch {...args} checked={true} label="On" onCheckedChange={noop} />
          </Sample>
          {/* Pressing a disabled switch runs a short 2px shake instead of toggling. */}
          <Sample label="Disabled, off">
            <Switch {...args} checked={false} disabled={true} label="Disabled" onCheckedChange={noop} />
          </Sample>
          <Sample label="Disabled, on">
            <Switch {...args} checked={true} disabled={true} label="Disabled" onCheckedChange={noop} />
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
    await expect(args.onCheckedChange).toHaveBeenCalledWith(true);
  },
};
