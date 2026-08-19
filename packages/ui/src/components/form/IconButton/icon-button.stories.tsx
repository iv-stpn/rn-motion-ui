import type { Meta, StoryObj } from '@storybook/react';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { ArrowRightLine as ArrowRight } from 'rn-motion-ui-icons/icons/arrow-right-line';
import { Delete2Line as Trash2 } from 'rn-motion-ui-icons/icons/delete-2-line';
import { DownloadLine as Download } from 'rn-motion-ui-icons/icons/download-line';
import { Settings3Line as Settings } from 'rn-motion-ui-icons/icons/settings-3-line';
import { expect, fn, userEvent, within } from 'storybook/test';
import { Choice, ControlCard, Note, Playground, Sample, Section, Toggle, Variants } from '../../../__stories__/story-harness';
import type { ButtonVariant } from '../Button/button';
import { IconButton, type IconButtonProps } from './icon-button';

const meta = {
  title: 'Form/IconButton',
  component: IconButton,
  parameters: { layout: 'centered' },
  args: {
    icon: Trash2,
    variant: 'neutral',
    size: 'md',
    shape: 'rounded',
    accessibilityLabel: 'Delete',
    onPress: fn(),
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['neutral', 'inverse', 'ghost', 'danger', 'special', 'outlineDanger', 'ghostDanger'],
    },
    size: { control: 'select', options: ['sm', 'md', 'lg'] },
    shape: { control: 'select', options: ['rounded', 'pill'] },
  },
} satisfies Meta<typeof IconButton>;

type Story = StoryObj<typeof meta>;

const VARIANTS = [
  'neutral',
  'inverse',
  'ghost',
  'danger',
  'special',
  'outlineDanger',
  'ghostDanger',
] as const satisfies readonly ButtonVariant[];
const SIZES = ['sm', 'md', 'lg'] as const;
const SIZE_LABELS: Record<(typeof SIZES)[number], string> = { sm: 'Small', md: 'Medium', lg: 'Large' };

// Sample colours for iconBackgroundColor demos
const TILE_COLORS = ['#FF3B30', '#007AFF', '#34C759', '#FF9500', '#AF52DE'];

function IconButtonPlayground(args: IconButtonProps) {
  const [variant, setVariant] = useState<ButtonVariant>('neutral');
  const [size, setSize] = useState<(typeof SIZES)[number]>('md');
  const [pill, setPill] = useState(false);
  const [loading, setLoading] = useState(false);
  const [disabled, setDisabled] = useState(false);
  const [ripple, setRipple] = useState(false);
  const [tileColor, setTileColor] = useState<string | undefined>(undefined);
  const [customIconColor, setCustomIconColor] = useState(false);
  const [count, setCount] = useState(0);

  const handlePress = useCallback(() => {
    setCount((n) => n + 1);
    args.onPress?.();
  }, [args.onPress]);

  const handleTileToggle = useCallback((v: boolean) => setTileColor(v ? '#007AFF' : undefined), []);

  const live: IconButtonProps = {
    ...args,
    variant,
    size,
    shape: pill ? 'pill' : 'rounded',
    loading,
    disabled,
    ripple,
    iconBackgroundColor: tileColor,
    iconColor: customIconColor ? '#FFFFFF' : undefined,
  };

  return (
    <Playground>
      <ControlCard title="Options">
        <Choice label="Variant" onChange={setVariant} options={VARIANTS} value={variant} />
        <Choice label="Size" onChange={setSize} options={SIZES} value={size} />
        <Toggle label="Pill" onChange={setPill} value={pill} />
        <Toggle label="Loading" onChange={setLoading} value={loading} />
        <Toggle label="Disabled" onChange={setDisabled} value={disabled} />
        <Toggle label="Ripple" onChange={setRipple} value={ripple} />
        <Toggle label="Icon tile (iOS style)" onChange={handleTileToggle} value={Boolean(tileColor)} />
        {tileColor ? <Choice label="Tile color" onChange={setTileColor} options={TILE_COLORS} value={tileColor} /> : null}
        <Toggle label="Custom icon colour" onChange={setCustomIconColor} value={customIconColor} />
      </ControlCard>

      <View className="flex-row items-center gap-4">
        <IconButton {...live} onPress={handlePress} icon={args.icon} />
        <Note testID="story-press-count">{`Pressed ${count} times`}</Note>
      </View>

      <View className="h-3" />
      <Section title="Variants">
        <Variants>
          {VARIANTS.map((name) => (
            <Sample key={name} label={name}>
              <IconButton {...args} size={size} variant={name} />
            </Sample>
          ))}
        </Variants>
      </Section>

      <Section title="Sizes">
        <Variants align="center">
          {SIZES.map((name) => (
            <IconButton {...args} key={name} size={name} variant={variant} />
          ))}
        </Variants>
      </Section>

      <Section title="Shapes">
        <Variants align="center">
          <Sample label="rounded">
            <IconButton {...args} variant={variant} />
          </Sample>
          <Sample label="pill">
            <IconButton {...args} shape="pill" variant={variant} />
          </Sample>
        </Variants>
      </Section>

      <Section title="Icon tile (iconBackgroundColor)">
        <Variants align="center">
          {TILE_COLORS.map((color) => (
            <Sample key={color} label={color}>
              <IconButton {...args} icon={Settings} variant="ghost" iconBackgroundColor={color} />
            </Sample>
          ))}
        </Variants>
      </Section>

      <Section title="States">
        <Variants align="center">
          <Sample label="loading (neutral)">
            <IconButton {...args} icon={Download} loading={true} variant="neutral" />
          </Sample>
          <Sample label="loading (ghost)">
            <IconButton {...args} icon={Download} loading={true} variant="ghost" />
          </Sample>
          <Sample label="disabled">
            <IconButton {...args} disabled={true} variant="neutral" />
          </Sample>
          <Sample label="disabled ghost">
            <IconButton {...args} disabled={true} variant="ghost" />
          </Sample>
        </Variants>
      </Section>
    </Playground>
  );
}

export default meta;

/** Every variant, size, shape and state in one place: drive the top button with
 *  the controls, or read the rows below for the full catalogue. */
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

/** All eight variants at the default md size, with a secondary icon for visual
 *  variety. */
export const AllVariants: Story = {
  render: (args) => (
    <Variants>
      {VARIANTS.map((name) => (
        <Sample key={name} label={name}>
          <IconButton {...args} icon={ArrowRight} variant={name} accessibilityLabel={name} />
        </Sample>
      ))}
    </Variants>
  ),
};

/** The three sizes side by side for the neutral variant. */
export const AllSizes: Story = {
  render: (args) => (
    <Variants align="center">
      {SIZES.map((name) => (
        <Sample key={name} label={SIZE_LABELS[name]}>
          <IconButton {...args} size={name} variant="neutral" accessibilityLabel={SIZE_LABELS[name]} />
        </Sample>
      ))}
    </Variants>
  ),
};
