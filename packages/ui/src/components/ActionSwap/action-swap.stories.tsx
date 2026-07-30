import type { Meta, StoryObj } from '@storybook/react';
import { type ComponentProps, useState } from 'react';
import { View } from 'react-native';
import { expect, fn, userEvent, within } from 'storybook/test';
import { Choice, Controls, Note, Playground, Sample, Section, Toggle, Variants } from '../../__stories__/story-harness';
import { Check, Copy, Moon, Send, Sparkles, Sun } from '../../lib/icons';
import { useThemeColor } from '../../theme/use-theme-color';
import {
  type ActionSwapAnimation,
  ActionSwapButton,
  type ActionSwapButtonShape,
  type ActionSwapButtonSize,
  type ActionSwapButtonVariant,
  type ActionSwapItem,
} from './action-swap';

// Icons default to the `foreground` theme token when no `color` is passed, so
// leaving these uncoloured keeps them legible on the secondary/outline variants
// in both light and dark mode. The `primary` variant fills the button with
// `primary`, which equals `foreground` in both themes — a default-coloured icon
// would vanish against it — so anything primary-filled resolves
// `primary-foreground` (the same token the label uses) instead.
const COPY_ITEMS: ActionSwapItem[] = [
  { id: 'copy', label: 'Copy link', icon: <Copy size={16} />, ariaLabel: 'Copy link' },
  { id: 'copied', label: 'Copied', icon: <Check size={16} />, ariaLabel: 'Copied' },
];

const THEME_ITEMS: ActionSwapItem[] = [
  { id: 'light', label: 'Light', icon: <Sun size={16} />, ariaLabel: 'Use light theme' },
  { id: 'dark', label: 'Dark', icon: <Moon size={16} />, ariaLabel: 'Use dark theme' },
];

const ANIMATIONS = ['blur', 'roll', 'cascade'] as const satisfies readonly ActionSwapAnimation[];
const VARIANTS = ['primary', 'secondary', 'outline', 'ghost'] as const satisfies readonly ActionSwapButtonVariant[];
const SIZES = ['sm', 'md', 'lg', 'icon'] as const satisfies readonly ActionSwapButtonSize[];
const SHAPES = ['pill', 'rounded'] as const satisfies readonly ActionSwapButtonShape[];

/** Item sets whose icons are tinted for whatever the button fills itself with. */
function useItems(kind: 'send' | 'copy', variant: ActionSwapButtonVariant): ActionSwapItem[] {
  const onPrimary = useThemeColor('primary-foreground');
  const color = variant === 'primary' ? onPrimary : undefined;
  if (kind === 'send')
    return [
      { id: 'send', label: 'Send', icon: <Send color={color} size={16} />, ariaLabel: 'Send' },
      { id: 'sent', label: 'Sent', icon: <Sparkles color={color} size={16} />, ariaLabel: 'Sent' },
    ];
  return [
    { id: 'copy', label: 'Copy link', icon: <Copy color={color} size={16} />, ariaLabel: 'Copy link' },
    { id: 'copied', label: 'Copied', icon: <Check color={color} size={16} />, ariaLabel: 'Copied' },
  ];
}

type SwapProps = {
  animation: ActionSwapAnimation;
  variant: ActionSwapButtonVariant;
  size?: ActionSwapButtonSize;
  shape?: ActionSwapButtonShape;
  kind?: 'send' | 'copy';
  iconOnly?: boolean;
};

// Resolves its own tinted items, so the sample rows can vary variant freely.
// biome-ignore lint/style/useComponentExportOnlyModules: story helper
function Swap({ animation, variant, size = 'md', shape, kind = 'copy', iconOnly }: SwapProps) {
  const items = useItems(kind, variant);
  return <ActionSwapButton animation={animation} iconOnly={iconOnly} items={items} shape={shape} size={size} variant={variant} />;
}

// biome-ignore lint/style/useComponentExportOnlyModules: story helper
function ActionSwapPlayground(args: ComponentProps<typeof ActionSwapButton>) {
  const [animation, setAnimation] = useState<ActionSwapAnimation>('blur');
  const [variant, setVariant] = useState<ActionSwapButtonVariant>('secondary');
  const [size, setSize] = useState<ActionSwapButtonSize>('md');
  const [shape, setShape] = useState<ActionSwapButtonShape>('pill');
  const [iconOnly, setIconOnly] = useState(false);
  const [cycle, setCycle] = useState(true);
  const [disabled, setDisabled] = useState(false);
  const [value, setValue] = useState('copy');
  const items = useItems('copy', variant);

  return (
    <Playground>
      <Controls>
        <Choice label="Animation" onChange={setAnimation} options={ANIMATIONS} value={animation} />
        <Choice label="Variant" onChange={setVariant} options={VARIANTS} value={variant} />
        <Choice label="Size" onChange={setSize} options={SIZES} value={size} />
        <Choice label="Shape" onChange={setShape} options={SHAPES} value={shape} />
        <Toggle label="Icon only" onChange={setIconOnly} value={iconOnly} />
        <Toggle label="Cycle" onChange={setCycle} value={cycle} />
        <Toggle label="Disabled" onChange={setDisabled} value={disabled} />
      </Controls>

      {/* With `cycle` off the button stops at the last item — the one-way
          "Copy → Copied" case. With it on the press wraps back round. */}
      <View className="items-start gap-2">
        <ActionSwapButton
          {...args}
          animation={animation}
          cycle={cycle}
          disabled={disabled}
          iconOnly={iconOnly}
          items={items}
          onValueChange={setValue}
          shape={shape}
          size={size}
          value={value}
          variant={variant}
        />
        <Note testID="story-value">{value}</Note>
      </View>

      <View className="h-3" />
      {/* The three animations differ in how the outgoing label leaves: blur
          cross-fades it, roll slides both layers vertically, cascade rolls each
          letter on its own delay. */}
      <Section title="Animations">
        <Variants>
          <Sample label="blur">
            <Swap animation="blur" variant="secondary" />
          </Sample>
          <Sample label="roll">
            <Swap animation="roll" kind="send" variant="primary" />
          </Sample>
          <Sample label="cascade">
            <Swap animation="cascade" variant="outline" />
          </Sample>
        </Variants>
      </Section>

      <Section title="Variants">
        <Variants>
          {VARIANTS.map((option) => (
            <Sample key={option} label={option}>
              <Swap animation={animation} variant={option} />
            </Sample>
          ))}
        </Variants>
      </Section>

      {/* `icon` is a square size preset; it pairs with `iconOnly` to drop the label. */}
      <Section title="Sizes">
        <Variants align="center">
          {SIZES.map((option) => (
            <Sample align="center" key={option} label={option}>
              <Swap animation={animation} iconOnly={option === 'icon'} size={option} variant="outline" />
            </Sample>
          ))}
        </Variants>
      </Section>

      {/* The same shape axis the rest of the button family carries. `pill` is the
          default here; `rounded` takes the family's radius ramp, so a swapping
          button can sit in a row of Buttons with the same corner. */}
      <Section title="Shapes">
        <Variants align="center">
          {SHAPES.map((option) => (
            <Sample align="center" key={option} label={option}>
              <Swap animation={animation} shape={option} variant="secondary" />
            </Sample>
          ))}
        </Variants>
      </Section>
    </Playground>
  );
}

const meta = {
  title: 'Components/ActionSwap',
  component: ActionSwapButton,
  parameters: { layout: 'centered' },
  args: { items: COPY_ITEMS, animation: 'blur', variant: 'secondary', size: 'md', onValueChange: fn() },
  argTypes: {
    animation: { control: 'select', options: ['blur', 'roll', 'cascade'] },
    variant: { control: 'select', options: ['primary', 'secondary', 'outline', 'ghost'] },
    size: { control: 'select', options: ['sm', 'md', 'lg', 'icon'] },
  },
} satisfies Meta<typeof ActionSwapButton>;

type Story = StoryObj<typeof meta>;
export default meta;

/** One controlled button with a live value readout, then the animation, variant
 *  and size ladders. `cycle` off is the common "Copy → Copied" one-way case. */
export const Interactive: Story = { render: (args) => <ActionSwapPlayground {...args} /> };

export const Blur: Story = {
  name: 'Demo: Copy to clipboard',
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const button = await canvas.findByRole('button');
    // Pressing cycles to the next item and reports it.
    await userEvent.click(button);
    await expect(args.onValueChange).toHaveBeenCalledWith('copied', expect.objectContaining({ id: 'copied' }));
  },
};

export const IconOnly: Story = {
  name: 'Demo: Toggle theme',
  args: { items: THEME_ITEMS, variant: 'outline', size: 'icon', iconOnly: true },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const button = await canvas.findByRole('button');
    await userEvent.click(button);
    await expect(args.onValueChange).toHaveBeenCalledWith('dark', expect.objectContaining({ id: 'dark' }));
  },
};
