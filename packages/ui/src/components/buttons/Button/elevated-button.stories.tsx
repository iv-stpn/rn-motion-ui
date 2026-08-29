import type { Meta, StoryObj } from '@storybook/react';
import { type ComponentProps, useCallback, useState } from 'react';
import { View } from 'react-native';
import { ArrowRightLine as ArrowRight } from 'rn-motion-ui-icons/icons/arrow-right-line';
import { DownloadLine as Download } from 'rn-motion-ui-icons/icons/download-line';
import { expect, fn, userEvent, within } from 'storybook/test';
import { Choice, ControlCard, Note, Playground, Sample, Section, Toggle, Variants } from '../../../__stories__/story-harness';
import { useThemeColors } from '../../../theme/use-theme-color';
import { ElevatedButton, type ElevatedVariant, elevatedContentColor } from './elevated-button';

const meta = {
  title: 'Buttons/ElevatedButton',
  component: ElevatedButton,
  parameters: { layout: 'centered' },
  args: { children: 'Continue', variant: 'neutral', size: 'md', onPress: fn() },
  argTypes: {
    variant: {
      control: 'select',
      options: ['neutral', 'inverse', 'danger', 'success', 'warning', 'info', 'white', 'gray'],
      description: 'Fill colour. Coloured fills get the gloss + rim + shadow; white/gray are flat plates.',
    },
    size: { control: 'select', options: ['sm', 'md', 'lg', 'icon'] },
    shape: { control: 'select', options: ['rounded', 'pill'] },
  },
} satisfies Meta<typeof ElevatedButton>;

type Story = StoryObj<typeof meta>;

const VARIANTS = [
  'neutral',
  'inverse',
  'danger',
  'success',
  'warning',
  'info',
  'white',
  'gray',
] as const satisfies readonly ElevatedVariant[];
const SIZES = ['sm', 'md', 'lg'] as const;
const SIZE_LABELS = { sm: 'Small', md: 'Medium', lg: 'Large' } as const;
const ICON_SIDES = ['none', 'left', 'right'] as const;
const CONTINUE_LABEL = 'Continue';
const DOWNLOAD_LABEL = 'Download';
const pressedLabel = (n: number) => `Pressed ${n} times`;

type IconSide = (typeof ICON_SIDES)[number];

function ElevatedButtonPlayground(args: ComponentProps<typeof ElevatedButton>) {
  const [variant, setVariant] = useState<ElevatedVariant>('neutral');
  const [size, setSize] = useState<(typeof SIZES)[number]>('md');
  const [pill, setPill] = useState(false);
  const [loading, setLoading] = useState(false);
  const [disabled, setDisabled] = useState(false);
  const [ripple, setRipple] = useState(false);
  const [iconSide, setIconSide] = useState<IconSide>('none');
  const [count, setCount] = useState(0);

  const colors = useThemeColors();
  const iconColor = elevatedContentColor(variant, Boolean(disabled), colors);
  const handlePress = useCallback(() => {
    setCount((n) => n + 1);
    args.onPress?.();
  }, [args.onPress]);

  const live = { ...args, variant, size, shape: pill ? ('pill' as const) : ('rounded' as const), loading, disabled, ripple };
  const icon = <ArrowRight color={iconColor} size={16} />;

  return (
    <Playground>
      <ControlCard title="Options">
        <Choice label="Variant" onChange={setVariant} options={VARIANTS} value={variant} />
        <Choice label="Size" onChange={setSize} options={SIZES} value={size} />
        <Choice label="Icon" onChange={setIconSide} options={ICON_SIDES} value={iconSide} />
        <Toggle label="Pill" onChange={setPill} value={pill} />
        <Toggle label="Loading" onChange={setLoading} value={loading} />
        <Toggle label="Disabled" onChange={setDisabled} value={disabled} />
        <Toggle label="Ripple" onChange={setRipple} value={ripple} />
      </ControlCard>

      <View className="flex-row items-center gap-4">
        <ElevatedButton {...live} onPress={handlePress}>
          {iconSide === 'left' ? icon : null}
          {CONTINUE_LABEL}
          {iconSide === 'right' ? icon : null}
        </ElevatedButton>
        <Note testID="story-press-count">{pressedLabel(count)}</Note>
      </View>

      <View className="h-3" />
      {/* Coloured fills get the white sheen + 1px rim highlight + a drop shadow whose
          ring is the fill darkened toward black; hover lifts the gloss (.16 → .24).
          `white` is a stroke plate that darkens on hover, `gray` a fixed Geist-style
          secondary plate with a hairline top sheen and no hover shift. */}
      <Section title="Variants">
        <Variants>
          {VARIANTS.map((name) => (
            <Sample key={name} label={name}>
              <ElevatedButton {...args} size={size} variant={name}>
                {CONTINUE_LABEL}
              </ElevatedButton>
            </Sample>
          ))}
        </Variants>
      </Section>

      <Section title="Sizes">
        <Variants align="center">
          {SIZES.map((name) => (
            <ElevatedButton {...args} key={name} size={name} variant={variant}>
              {SIZE_LABELS[name]}
            </ElevatedButton>
          ))}
        </Variants>
      </Section>

      <Section title="States">
        <Variants align="center">
          <Sample label="with icon">
            <ElevatedButton {...args} variant="white">
              <Download color={elevatedContentColor('white', false, colors)} size={16} />
              {DOWNLOAD_LABEL}
            </ElevatedButton>
          </Sample>
          <Sample label="loading">
            <ElevatedButton {...args} loading={true} variant={variant}>
              {CONTINUE_LABEL}
            </ElevatedButton>
          </Sample>
          <Sample label="disabled">
            <ElevatedButton {...args} disabled={true} variant={variant}>
              {CONTINUE_LABEL}
            </ElevatedButton>
          </Sample>
        </Variants>
      </Section>
    </Playground>
  );
}

export default meta;

/** Every fill, size, shape and state in one place: drive the top chip with the
 *  controls, or read the rows below for the full catalogue. */
export const Interactive: Story = {
  render: (args) => <ElevatedButtonPlayground {...args} />,
};

export const Neutral: Story = {
  name: 'Demo: Press to confirm',
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const button = await canvas.findByRole('button');
    await userEvent.click(button);
    await expect(args.onPress).toHaveBeenCalled();
  },
};
