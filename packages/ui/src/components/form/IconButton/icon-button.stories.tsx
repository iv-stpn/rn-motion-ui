import type { Meta, StoryObj } from '@storybook/react';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { ArrowRightLine as ArrowRight } from 'rn-motion-ui-icons/icons/arrow-right-line';
import { Delete2Line as Trash2 } from 'rn-motion-ui-icons/icons/delete-2-line';
import { DownloadLine as Download } from 'rn-motion-ui-icons/icons/download-line';
import { expect, fn, userEvent, within } from 'storybook/test';
import { Choice, ControlCard, Note, Playground, Sample, Section, Toggle, Variants } from '../../../__stories__/story-harness';
import type { SurfaceElevation } from '../../../lib/elevated';
import { IconButton, type IconButtonProps } from './icon-button';

const meta = {
  title: 'Form/IconButton',
  component: IconButton,
  parameters: { layout: 'centered' },
  args: {
    icon: Trash2,
    elevated: true,
    elevation: 3,
    size: 'md',
    shape: 'pill',
    accessibilityLabel: 'Delete',
    onPress: fn(),
  },
  argTypes: {
    elevated: { control: 'boolean' },
    elevation: { control: 'select', options: [0, 1, 2, 3, 4, 5, 6, 7, 8] },
    size: { control: 'select', options: ['sm', 'md', 'lg'] },
    shape: { control: 'select', options: ['rounded', 'pill'] },
  },
} satisfies Meta<typeof IconButton>;

type Story = StoryObj<typeof meta>;

const ELEVATIONS = ['0', '1', '2', '3', '4', '5', '6', '7', '8'] as const;
type ElevationLabel = (typeof ELEVATIONS)[number];
const ELEVATION_LEVEL: Record<ElevationLabel, SurfaceElevation> = {
  '0': 0,
  '1': 1,
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
};
const SIZES = ['sm', 'md', 'lg'] as const;
const SIZE_LABELS: Record<(typeof SIZES)[number], string> = { sm: 'Small', md: 'Medium', lg: 'Large' };

function IconButtonPlayground(args: IconButtonProps) {
  const [elevated, setElevated] = useState(true);
  const [elevation, setElevation] = useState<ElevationLabel>('3');
  const [size, setSize] = useState<(typeof SIZES)[number]>('md');
  const [pill, setPill] = useState(true);
  const [loading, setLoading] = useState(false);
  const [disabled, setDisabled] = useState(false);
  const [ripple, setRipple] = useState(false);
  const [count, setCount] = useState(0);

  const handlePress = useCallback(() => {
    setCount((n) => n + 1);
    args.onPress?.();
  }, [args.onPress]);

  const live: IconButtonProps = {
    ...args,
    elevated,
    elevation: ELEVATION_LEVEL[elevation],
    size,
    shape: pill ? 'pill' : 'rounded',
    loading,
    disabled,
    ripple,
  };

  return (
    <Playground>
      <ControlCard title="Options">
        <Toggle label="Elevated" onChange={setElevated} value={elevated} />
        <Choice label="Elevation" onChange={setElevation} options={ELEVATIONS} value={elevation} />
        <Choice label="Size" onChange={setSize} options={SIZES} value={size} />
        <Toggle label="Pill" onChange={setPill} value={pill} />
        <Toggle label="Loading" onChange={setLoading} value={loading} />
        <Toggle label="Disabled" onChange={setDisabled} value={disabled} />
        <Toggle label="Ripple" onChange={setRipple} value={ripple} />
      </ControlCard>

      <View className="flex-row items-center gap-4">
        <IconButton {...live} onPress={handlePress} icon={args.icon} />
        <Note testID="story-press-count">{`Pressed ${count} times`}</Note>
      </View>

      <View className="h-3" />
      <Section title="Elevation">
        <Variants>
          <Sample label="flat">
            <IconButton {...args} size={size} elevated={false} />
          </Sample>
          <Sample label="elevated">
            <IconButton {...args} size={size} elevated={true} />
          </Sample>
        </Variants>
      </Section>

      <Section title="Sizes">
        <Variants align="center">
          {SIZES.map((name) => (
            <IconButton {...args} key={name} size={name} elevated={elevated} />
          ))}
        </Variants>
      </Section>

      <Section title="Shapes">
        <Variants align="center">
          <Sample label="rounded">
            <IconButton {...args} elevated={elevated} />
          </Sample>
          <Sample label="pill">
            <IconButton {...args} shape="pill" elevated={elevated} />
          </Sample>
        </Variants>
      </Section>

      <Section title="States">
        <Variants align="center">
          <Sample label="loading (flat)">
            <IconButton {...args} icon={Download} loading={true} elevated={false} />
          </Sample>
          <Sample label="loading (elevated)">
            <IconButton {...args} icon={Download} loading={true} elevated={true} />
          </Sample>
          <Sample label="disabled (flat)">
            <IconButton {...args} disabled={true} elevated={false} />
          </Sample>
          <Sample label="disabled (elevated)">
            <IconButton {...args} disabled={true} elevated={true} />
          </Sample>
        </Variants>
      </Section>
    </Playground>
  );
}

export default meta;

/** Every elevation state, size, shape and interaction in one place: drive the top
 *  button with the controls, or read the rows below for the full catalogue. */
export const Interactive: Story = {
  render: (args) => <IconButtonPlayground {...args} />,
};

export const Primary: Story = {
  name: 'Demo: Press to confirm',
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const button = await canvas.findByRole('button');
    await userEvent.click(button);
    await expect(args.onPress).toHaveBeenCalled();
  },
};

/** Flat vs. elevated at the default md size, with a secondary icon for visual
 *  variety. */
export const ElevationStates: Story = {
  render: (args) => (
    <Variants>
      <Sample label="flat">
        <IconButton {...args} icon={ArrowRight} elevated={false} accessibilityLabel="Flat" />
      </Sample>
      <Sample label="elevated">
        <IconButton {...args} icon={ArrowRight} elevated={true} accessibilityLabel="Elevated" />
      </Sample>
    </Variants>
  ),
};

/** The three sizes side by side, flat. */
export const AllSizes: Story = {
  render: (args) => (
    <Variants align="center">
      {SIZES.map((name) => (
        <Sample key={name} label={SIZE_LABELS[name]}>
          <IconButton {...args} size={name} elevated={false} accessibilityLabel={SIZE_LABELS[name]} />
        </Sample>
      ))}
    </Variants>
  ),
};
