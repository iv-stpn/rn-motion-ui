import type { Meta, StoryObj } from '@storybook/react';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { expect, fn, userEvent, within } from 'storybook/test';
import { ELEVATION_KEYS, ELEVATIONS, type ElevationKey } from '../../../__stories__/story-elevations';
import { Choice, ControlCard, Note, Playground, Sample, Section, Toggle, Variants } from '../../../__stories__/story-harness';
import { CloseButton, type CloseButtonProps, type CloseButtonSize } from './close-button';

const meta = {
  title: 'Buttons/CloseButton',
  component: CloseButton,
  parameters: { layout: 'centered' },
  args: {
    floating: false,
    elevation: 3,
    size: 'md',
    accessibilityLabel: 'Close',
    onPress: fn(),
  },
  argTypes: {
    floating: { control: 'boolean' },
    elevation: { control: 'select', options: [0, 1, 2, 3, 4, 5, 6, 7, 8] },
    size: { control: 'select', options: ['sm', 'md', 'lg'] },
  },
} satisfies Meta<typeof CloseButton>;

type Story = StoryObj<typeof meta>;

const SIZES = ['sm', 'md', 'lg'] as const satisfies readonly CloseButtonSize[];
const SIZE_LABELS: Record<(typeof SIZES)[number], string> = { sm: 'Small', md: 'Medium', lg: 'Large' };

function CloseButtonPlayground(args: CloseButtonProps) {
  const [floating, setFloating] = useState(false);
  const [elevation, setElevation] = useState<ElevationKey>('3');
  const [size, setSize] = useState<(typeof SIZES)[number]>('md');
  const [count, setCount] = useState(0);

  const handlePress = useCallback(() => {
    setCount((n) => n + 1);
    args.onPress?.();
  }, [args.onPress]);

  const live: CloseButtonProps = { ...args, floating, elevation: ELEVATIONS[elevation], size };

  return (
    <Playground>
      <ControlCard title="Options">
        <Toggle label="Floating" onChange={setFloating} value={floating} />
        <Choice label="Elevation" onChange={setElevation} options={ELEVATION_KEYS} value={elevation} />
        <Choice label="Size" onChange={setSize} options={SIZES} value={size} />
      </ControlCard>

      <View className="flex-row items-center gap-4">
        <CloseButton {...live} onPress={handlePress} />
        <Note testID="story-press-count">{`Pressed ${count} times`}</Note>
      </View>

      <View className="h-3" />
      <Section title="Shadow">
        <Variants align="center">
          <Sample label="resting">
            <CloseButton {...args} size={size} floating={false} />
          </Sample>
          <Sample label="floating">
            <CloseButton {...args} size={size} floating={true} />
          </Sample>
        </Variants>
      </Section>

      <Section title="Sizes">
        <Variants align="center">
          {SIZES.map((name) => (
            <CloseButton
              {...args}
              key={name}
              size={name}
              floating={floating}
              accessibilityLabel={`Close (${SIZE_LABELS[name]})`}
            />
          ))}
        </Variants>
      </Section>

      {/* Unlike a Button, a CloseButton's fill follows elevation too (its tint is
          `surface(elevation)`), so the ladder reads the background and the drop
          shadow together rather than the shadow alone. */}
      <Section title="Elevation ladder">
        <Variants align="center">
          <Sample label="flat (0)">
            <CloseButton {...args} elevation={0} floating={floating} size={size} />
          </Sample>
          {ELEVATION_KEYS.map((key) => (
            <Sample key={key} label={key}>
              <CloseButton {...args} elevation={ELEVATIONS[key]} floating={floating} size={size} />
            </Sample>
          ))}
        </Variants>
      </Section>
    </Playground>
  );
}

export default meta;

/** Floating / elevation / size in one place: drive the top button with the
 *  controls, or read the shadow, size and elevation rows below. */
export const Interactive: Story = {
  render: (args) => <CloseButtonPlayground {...args} />,
};

export const Primary: Story = {
  name: 'Demo: Press to close',
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const button = await canvas.findByRole('button', { name: 'Close' });
    await userEvent.click(button);
    await expect(args.onPress).toHaveBeenCalled();
  },
};

/** The three sizes side by side, flat. */
export const AllSizes: Story = {
  render: (args) => (
    <Variants align="center">
      {SIZES.map((name) => (
        <Sample key={name} label={SIZE_LABELS[name]}>
          <CloseButton {...args} size={name} floating={false} accessibilityLabel={`Close (${SIZE_LABELS[name]})`} />
        </Sample>
      ))}
    </Variants>
  ),
};
