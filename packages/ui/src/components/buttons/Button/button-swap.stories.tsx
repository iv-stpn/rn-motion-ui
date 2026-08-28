import type { Meta, StoryObj } from '@storybook/react';
import { type ComponentProps, useState } from 'react';
import { View } from 'react-native';
import { CheckLine as Check } from 'rn-motion-ui-icons/icons/check-line';
import { CopyLine as Copy } from 'rn-motion-ui-icons/icons/copy-line';
import { MoonLine as Moon } from 'rn-motion-ui-icons/icons/moon-line';
import { SendPlaneLine as Send } from 'rn-motion-ui-icons/icons/send-plane-line';
import { SparklesLine as Sparkles } from 'rn-motion-ui-icons/icons/sparkles-line';
import { SunLine as Sun } from 'rn-motion-ui-icons/icons/sun-line';
import { expect, fn, userEvent, within } from 'storybook/test';
import { ELEVATION_KEYS, ELEVATIONS, type ElevationKey } from '../../../__stories__/story-elevations';
import { Choice, ControlCard, Note, Playground, Sample, Section, Toggle, Variants } from '../../../__stories__/story-harness';
import { SURFACE_LEVELS } from '../../../lib/elevated';
import { useThemeColors } from '../../../theme/use-theme-color';
import {
  type ButtonShape,
  type ButtonSize,
  ButtonSwap,
  type ButtonSwapAnimation,
  type ButtonSwapItem,
  type ButtonVariant,
} from './button-swap';

// Icons default to the `foreground` theme token when no `color` is passed, which
// only reads on the transparent/surface plates. The filled variants punch a
// vivid or dark background under the icon, so each one resolves the same
// `*-foreground` token its label wears (see iconColorFor).
const COPY_ITEMS: ButtonSwapItem[] = [
  { id: 'copy', label: 'Copy link', icon: <Copy size={16} />, ariaLabel: 'Copy link' },
  { id: 'copied', label: 'Copied', icon: <Check size={16} />, ariaLabel: 'Copied' },
];

const THEME_ITEMS: ButtonSwapItem[] = [
  { id: 'light', label: 'Light', icon: <Sun size={16} />, ariaLabel: 'Use light theme' },
  { id: 'dark', label: 'Dark', icon: <Moon size={16} />, ariaLabel: 'Use dark theme' },
];

const ANIMATIONS = ['blur', 'roll', 'cascade'] as const satisfies readonly ButtonSwapAnimation[];
const VARIANTS = [
  'neutral',
  'inverse',
  'ghost',
  'outline',
  'danger',
  'success',
  'warning',
  'info',
  'special',
  'outlineDanger',
  'ghostDanger',
] as const satisfies readonly ButtonVariant[];
const SIZES = ['sm', 'md', 'lg', 'icon'] as const satisfies readonly ButtonSize[];
const SHAPES = ['pill', 'rounded'] as const satisfies readonly ButtonShape[];

// The variant whose label class the styled sample overrides, and what it
// overrides it with — pinned in StylingPropsApply.
const STYLED_LABEL_CLASS = 'text-info';
const STYLED_KEY = 'styled-key';

/** Icon stroke per variant — the same mapping the label colours make (Button's
 *  `iconColorFor`), so the icon and the label read as one unit on every plate. */
function iconColorFor(variant: ButtonVariant, colors: ReturnType<typeof useThemeColors>): string {
  if (variant === 'danger') return colors['primary-foreground'];
  if (variant === 'success') return colors['success-foreground'];
  if (variant === 'warning') return colors['warning-foreground'];
  if (variant === 'info') return colors['info-foreground'];
  if (variant === 'special') return colors['special-foreground'];
  if (variant === 'inverse') return colors['surface-1'];
  if (variant === 'outlineDanger' || variant === 'ghostDanger') return colors.danger;
  return colors.foreground;
}

/** Item sets whose icons are tinted for whatever the button fills itself with. */
function useItems(kind: 'send' | 'copy', variant: ButtonVariant): ButtonSwapItem[] {
  const colors = useThemeColors();
  const color = iconColorFor(variant, colors);
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
  animation: ButtonSwapAnimation;
  variant: ButtonVariant;
  size?: ButtonSize;
  shape?: ButtonShape;
  kind?: 'send' | 'copy';
  iconOnly?: boolean;
  elevation?: ComponentProps<typeof ButtonSwap>['elevation'];
  floating?: boolean;
  ripple?: boolean;
};

// Resolves its own tinted items, so the sample rows can vary variant freely.
function Swap({ animation, variant, size = 'md', shape, kind = 'copy', iconOnly, ...rest }: SwapProps) {
  const items = useItems(kind, variant);
  return (
    <ButtonSwap animation={animation} iconOnly={iconOnly} items={items} shape={shape} size={size} variant={variant} {...rest} />
  );
}

function ButtonSwapPlayground(args: ComponentProps<typeof ButtonSwap>) {
  const [animation, setAnimation] = useState<ButtonSwapAnimation>('blur');
  const [variant, setVariant] = useState<ButtonVariant>('neutral');
  const [size, setSize] = useState<ButtonSize>('md');
  const [shape, setShape] = useState<ButtonShape>('pill');
  const [elevationKey, setElevationKey] = useState<ElevationKey>('0');
  const [floating, setFloating] = useState(false);
  const [iconOnly, setIconOnly] = useState(false);
  const [cycle, setCycle] = useState(true);
  const [ripple, setRipple] = useState(false);
  const [disabled, setDisabled] = useState(false);
  const [value, setValue] = useState('copy');
  const items = useItems('copy', variant);

  return (
    <Playground>
      <ControlCard title="Display">
        <Choice label="Animation" onChange={setAnimation} options={ANIMATIONS} value={animation} />
        <Choice label="Variant" onChange={setVariant} options={VARIANTS} value={variant} />
        <Choice label="Size" onChange={setSize} options={SIZES} value={size} />
        <Choice label="Shape" onChange={setShape} options={SHAPES} value={shape} />
        <Choice label="Elevation" onChange={setElevationKey} options={ELEVATION_KEYS} value={elevationKey} />
      </ControlCard>

      <ControlCard title="Options">
        <Toggle label="Floating" onChange={setFloating} value={floating} />
        <Toggle label="Icon only" onChange={setIconOnly} value={iconOnly} />
        <Toggle label="Cycle" onChange={setCycle} value={cycle} />
        <Toggle label="Ripple" onChange={setRipple} value={ripple} />
        <Toggle label="Disabled" onChange={setDisabled} value={disabled} />
      </ControlCard>

      {/* With `cycle` off the button stops at the last item — the one-way
          "Copy → Copied" case. With it on the press wraps back round. */}
      <View className="items-start gap-2">
        <ButtonSwap
          {...args}
          animation={animation}
          cycle={cycle}
          disabled={disabled}
          elevation={ELEVATIONS[elevationKey]}
          floating={floating}
          iconOnly={iconOnly}
          items={items}
          onValueChange={setValue}
          ripple={ripple}
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
            <Swap animation="blur" variant="neutral" />
          </Sample>
          <Sample label="roll">
            <Swap animation="roll" kind="send" variant="inverse" />
          </Sample>
          <Sample label="cascade">
            <Swap animation="cascade" variant="outline" />
          </Sample>
        </Variants>
      </Section>

      {/* The same colour table `Button` paints from, so a swapping button sits in
          a row of Buttons at the same variant without a seam. */}
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
              <Swap animation={animation} shape={option} variant="neutral" />
            </Sample>
          ))}
        </Variants>
      </Section>

      {/* `elevation` drives the shadow only — the fill still comes from the
          variant — so the ladder reads best on a flat plate. `floating` swaps
          whichever rung resolved for the input field's diffuse halo. */}
      <Section title="Elevation ladder">
        <Variants align="center">
          <Sample label="flat (0)">
            <Swap animation={animation} elevation={0} variant="neutral" />
          </Sample>
          {SURFACE_LEVELS.map((level) => (
            <Sample key={level} label={`${level}`}>
              <Swap animation={animation} elevation={level} variant="neutral" />
            </Sample>
          ))}
          <Sample label="floating">
            <Swap animation={animation} floating={true} variant="neutral" />
          </Sample>
        </Variants>
      </Section>

      {/* Button's class overrides land on the same three layers here: `className`
          on the outer box the press spring animates, `contentClassName` on the
          pressable plate, `labelClassName` on the swapping label. */}
      <Section title="Styling">
        <Variants align="center">
          <Sample label="ripple">
            <Swap animation={animation} ripple={true} variant="inverse" />
          </Sample>
          <Sample label="contentClassName">
            <ButtonSwap animation={animation} contentClassName="border-[1.5px] border-info" items={COPY_ITEMS} variant="ghost" />
          </Sample>
          <Sample label="labelClassName">
            <ButtonSwap animation={animation} items={COPY_ITEMS} labelClassName={STYLED_LABEL_CLASS} variant="ghost" />
          </Sample>
          <Sample label="fitWidth">
            <View className="w-48">
              <ButtonSwap animation={animation} fitWidth={true} items={COPY_ITEMS} variant="neutral" />
            </View>
          </Sample>
        </Variants>
      </Section>
    </Playground>
  );
}

const meta = {
  title: 'Buttons/ButtonSwap',
  component: ButtonSwap,
  parameters: { layout: 'centered' },
  args: {
    items: COPY_ITEMS,
    animation: 'blur',
    variant: 'neutral',
    size: 'md',
    elevation: 0,
    floating: false,
    onValueChange: fn(),
  },
  argTypes: {
    animation: { control: 'select', options: ['blur', 'roll', 'cascade'] },
    variant: { control: 'select', options: VARIANTS },
    size: { control: 'select', options: ['sm', 'md', 'lg', 'icon'] },
    shape: { control: 'select', options: ['rounded', 'pill'] },
    elevation: { control: { type: 'range', min: 0, max: 8, step: 1 } },
    floating: { control: 'boolean' },
  },
} satisfies Meta<typeof ButtonSwap>;

type Story = StoryObj<typeof meta>;
export default meta;

/** One controlled button with a live value readout, then the animation, variant,
 *  size, elevation and styling ladders. `cycle` off is the common
 *  "Copy → Copied" one-way case. */
export const Interactive: Story = { render: (args) => <ButtonSwapPlayground {...args} /> };

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

/** `labelClassName` has to reach the swapping label — the swap slot renders its
 *  own <Text> rather than going through Button's shared label builder, so a
 *  consumer class could silently drop. It must land on BOTH copies: the hidden
 *  sizer measures the box the visible label paints in, and a class that changes
 *  the metrics on only one of them mis-sizes the button. */
export const StylingPropsApply: Story = {
  args: { labelClassName: STYLED_LABEL_CLASS, testID: STYLED_KEY },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = await canvas.findByTestId(STYLED_KEY);
    const labels = within(button).getAllByText('Copy link');
    // The sizer + the animated copy: both carry the override.
    await expect(labels.length).toBeGreaterThan(1);

    const probe = document.createElement('div');
    canvasElement.appendChild(probe);
    try {
      probe.style.color = 'var(--color-info)';
      const expected = getComputedStyle(probe).color;
      expect(expected).not.toBe('rgba(0, 0, 0, 0)');
      for (const el of labels) expect(getComputedStyle(el).color).toBe(expected);
    } finally {
      probe.remove();
    }
  },
};
