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
  title: 'Buttons/IconButton',
  component: IconButton,
  parameters: { layout: 'centered' },
  args: {
    icon: Trash2,
    floating: false,
    elevation: 3,
    size: 'md',
    shape: 'pill',
    blurRadius: 0,
    opacity: 1,
    rim: false,
    rimWidth: 2,
    accessibilityLabel: 'Delete',
    onPress: fn(),
  },
  argTypes: {
    floating: { control: 'boolean' },
    elevation: { control: 'select', options: [0, 1, 2, 3, 4, 5, 6, 7, 8] },
    size: { control: 'select', options: ['sm', 'md', 'lg'] },
    shape: { control: 'select', options: ['rounded', 'pill'] },
    blurRadius: { control: { type: 'range', min: 0, max: 40, step: 1 } },
    opacity: { control: { type: 'range', min: 0, max: 1, step: 0.05 } },
    rim: { control: 'boolean' },
    rimWidth: { control: { type: 'range', min: 0.5, max: 6, step: 0.5 } },
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
  const [floating, setFloating] = useState(false);
  const [elevation, setElevation] = useState<ElevationLabel>('3');
  const [size, setSize] = useState<(typeof SIZES)[number]>('md');
  const [pill, setPill] = useState(true);
  const [loading, setLoading] = useState(false);
  const [disabled, setDisabled] = useState(false);
  const [ripple, setRipple] = useState(false);
  const [glass, setGlass] = useState(false);
  const [count, setCount] = useState(0);

  const handlePress = useCallback(() => {
    setCount((n) => n + 1);
    args.onPress?.();
  }, [args.onPress]);

  const live: IconButtonProps = {
    ...args,
    floating,
    blurRadius: glass ? 24 : 0,
    opacity: glass ? 0.5 : 1,
    rim: glass,
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
        <Toggle label="Floating" onChange={setFloating} value={floating} />
        <Toggle label="Glass" onChange={setGlass} value={glass} />
        <Choice label="Elevation" onChange={setElevation} options={ELEVATIONS} value={elevation} />
        <Choice label="Size" onChange={setSize} options={SIZES} value={size} />
        <Toggle label="Pill" onChange={setPill} value={pill} />
        <Toggle label="Loading" onChange={setLoading} value={loading} />
        <Toggle label="Disabled" onChange={setDisabled} value={disabled} />
        <Toggle label="Ripple" onChange={setRipple} value={ripple} />
      </ControlCard>

      <View className="relative flex-row items-center gap-4 overflow-hidden rounded-2xl p-4">
        {/* Coloured shapes sit behind the plate so the frosted glass has a
            backdrop to blur when the Glass toggle is on. */}
        {glass ? (
          <>
            <View
              className="absolute"
              style={{ top: 0, left: 0, width: 56, height: 56, borderRadius: 28, backgroundColor: '#3b82f6' }}
            />
            <View
              className="absolute"
              style={{ right: 0, bottom: 0, width: 64, height: 64, borderRadius: 32, backgroundColor: '#ec4899' }}
            />
            <View
              className="absolute"
              style={{ top: 8, left: 64, width: 40, height: 40, borderRadius: 20, backgroundColor: '#f59e0b' }}
            />
          </>
        ) : null}
        <IconButton {...live} onPress={handlePress} icon={args.icon} />
        <Note testID="story-press-count">{`Pressed ${count} times`}</Note>
      </View>

      <View className="h-3" />
      <Section title="Shadow">
        <Variants>
          <Sample label="resting">
            <IconButton {...args} size={size} floating={false} />
          </Sample>
          <Sample label="floating">
            <IconButton {...args} size={size} floating={true} />
          </Sample>
        </Variants>
      </Section>

      <Section title="Sizes">
        <Variants align="center">
          {SIZES.map((name) => (
            <IconButton {...args} key={name} size={name} floating={floating} />
          ))}
        </Variants>
      </Section>

      <Section title="Shapes">
        <Variants align="center">
          <Sample label="rounded">
            <IconButton {...args} floating={floating} />
          </Sample>
          <Sample label="pill">
            <IconButton {...args} shape="pill" floating={floating} />
          </Sample>
        </Variants>
      </Section>

      <Section title="States">
        <Variants align="center">
          <Sample label="loading (resting)">
            <IconButton {...args} icon={Download} loading={true} floating={false} />
          </Sample>
          <Sample label="loading (floating)">
            <IconButton {...args} icon={Download} loading={true} floating={true} />
          </Sample>
          <Sample label="disabled (resting)">
            <IconButton {...args} disabled={true} floating={false} />
          </Sample>
          <Sample label="disabled (floating)">
            <IconButton {...args} disabled={true} floating={true} />
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

/** Resting vs. floating at the default md size, with a secondary icon for visual
 *  variety. */
export const ElevationStates: Story = {
  render: (args) => (
    <Variants>
      <Sample label="resting">
        <IconButton {...args} icon={ArrowRight} floating={false} accessibilityLabel="Resting" />
      </Sample>
      <Sample label="floating">
        <IconButton {...args} icon={ArrowRight} floating={true} accessibilityLabel="Floating" />
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
          <IconButton {...args} size={name} floating={false} accessibilityLabel={SIZE_LABELS[name]} />
        </Sample>
      ))}
    </Variants>
  ),
};

/**
 * The glass treatment — set `blurRadius` to frost the backdrop behind the plate,
 * thin the tint with `opacity`, and draw the `rim` specular edge light. The
 * coloured shapes behind are what the `backdrop-filter` blur reads, so the frost
 * only reads over a non-flat backdrop.
 */
export const Frosted: Story = {
  args: { blurRadius: 24, opacity: 0.5, rim: true, elevation: 3, size: 'lg' },
  render: (args) => (
    <View className="relative h-[200px] w-[320px] items-center justify-center overflow-hidden">
      <View
        className="absolute"
        style={{ top: 24, left: 24, width: 96, height: 96, borderRadius: 48, backgroundColor: '#3b82f6' }}
      />
      <View
        className="absolute"
        style={{ right: 28, bottom: 24, width: 112, height: 112, borderRadius: 56, backgroundColor: '#ec4899' }}
      />
      <View
        className="absolute"
        style={{ top: 56, right: 48, width: 64, height: 64, borderRadius: 32, backgroundColor: '#f59e0b' }}
      />
      <IconButton {...args} />
    </View>
  ),
};
