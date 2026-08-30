import type { Meta, StoryObj } from '@storybook/react';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { expect, screen, userEvent, within } from 'storybook/test';
import { ControlCard, Note, Playground, Toggle } from '../../../__stories__/story-harness';
import { ColorPicker, type ColorPickerChange } from './color-picker';

const meta = {
  title: 'Form/ColorPicker',
  component: ColorPicker,
  parameters: { layout: 'centered' },
} satisfies Meta<typeof ColorPicker>;

type Story = StoryObj<typeof meta>;

const CUSTOM_SWATCHES = ['#ff0000', '#00ff00', '#0000ff', '#000000', '#ffffff'] as const;

function ColorPickerPlayground() {
  const [picked, setPicked] = useState('#3b82f6');
  const [controlled, setControlled] = useState(false);
  const [withTitle, setWithTitle] = useState(false);
  const [withCustomSwatches, setWithCustomSwatches] = useState(false);

  const onChange = useCallback((color: ColorPickerChange) => setPicked(color.hex), []);

  const stateProps = controlled ? { value: picked } : { defaultValue: '#3b82f6' };

  return (
    <Playground className="min-w-[340px]">
      <ControlCard title="Picker">
        <Toggle label="Controlled" onChange={setControlled} value={controlled} />
        <Toggle label="Title" onChange={setWithTitle} value={withTitle} />
        <Toggle label="Custom swatches" onChange={setWithCustomSwatches} value={withCustomSwatches} />
      </ControlCard>

      <View className="items-start">
        <ColorPicker
          {...stateProps}
          onChange={onChange}
          swatches={withCustomSwatches ? CUSTOM_SWATCHES : undefined}
          title={withTitle ? 'Pick a color' : undefined}
        />
      </View>

      <Note testID="story-readout">Current color: {picked}</Note>
    </Playground>
  );
}

export default meta;

/** Every knob in one canvas: controlled state, header title, and a swappable swatch palette. */
export const Interactive: Story = { render: () => <ColorPickerPlayground /> };

/** Uncontrolled picker — click the trigger, then tap a swatch. */
export const Default: Story = {
  name: 'Demo: Pick a color',
  render: () => (
    <View className="items-center">
      <ColorPicker defaultValue="#3b82f6" />
    </View>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The trigger shows the initial hex; clicking it opens the panel.
    await userEvent.click(await canvas.findByText('#3b82f6'));
    // Panel content mounts in a Modal — use screen to query outside the canvas.
    await expect(await screen.findByLabelText('Swatch #ef4444')).toBeTruthy();
    await userEvent.click(screen.getByLabelText('Swatch #ef4444'));
    // The trigger (still in the canvas) now reports the swatch's color.
    await expect(await canvas.findByText('#ef4444')).toBeTruthy();
  },
};
