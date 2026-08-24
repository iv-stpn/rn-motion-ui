import type { Meta, StoryObj } from '@storybook/react';
import { type ComponentProps, useCallback, useState } from 'react';
import { View } from 'react-native';
import { ArrowRightLine as ArrowRight } from 'rn-motion-ui-icons/icons/arrow-right-line';
import { Delete2Line as Trash2 } from 'rn-motion-ui-icons/icons/delete-2-line';
import { DownloadLine as Download } from 'rn-motion-ui-icons/icons/download-line';
import { expect, fn, userEvent, within } from 'storybook/test';
import { Choice, ControlCard, Note, Playground, Sample, Section, Toggle, Variants } from '../../../__stories__/story-harness';
import { useThemeColors } from '../../../theme/use-theme-color';
import { Button, type ButtonVariant } from './button';

const meta = {
  title: 'Form/Button',
  component: Button,
  parameters: { layout: 'centered' },
  args: { children: 'Continue', variant: 'neutral', size: 'md', onPress: fn() },
  argTypes: {
    variant: {
      control: 'select',
      options: ['neutral', 'inverse', 'ghost', 'danger', 'special', 'outlineDanger', 'ghostDanger'],
    },
    size: { control: 'select', options: ['sm', 'md', 'lg', 'icon'] },
    shape: { control: 'select', options: ['rounded', 'pill'] },
  },
} satisfies Meta<typeof Button>;

type Story = StoryObj<typeof meta>;

const VARIANTS = [
  'neutral',
  'inverse',
  'ghost',
  'danger',
  'success',
  'warning',
  'info',
  'special',
  'outlineDanger',
  'ghostDanger',
] as const satisfies readonly ButtonVariant[];
const SIZES = ['sm', 'md', 'lg'] as const;
const SIZE_LABELS = { sm: 'Small', md: 'Medium', lg: 'Large' } as const;
const ICON_SIDES = ['none', 'left', 'right'] as const;
const CONTINUE_LABEL = 'Continue';
const DOWNLOAD_LABEL = 'Download';
const pressedLabel = (n: number) => `Pressed ${n} times`;

// The two token-backed fills, probed in TokenFillsResolve.
const SPECIAL_KEY = 'special-key';
const INVERSE_KEY = 'inverse-key';
// What the browser computes for both an unset custom property and an absent
// background utility — the collision TokenFillsResolve has to rule out.
const TRANSPARENT = 'rgba(0, 0, 0, 0)';

type IconSide = (typeof ICON_SIDES)[number];

// Icon colour per variant — filled variants carry their fill's foreground
// partner (`inverse` the page, so it punches through the slab), the danger
// outlines carry the danger hue, everything else the plain foreground.
function iconColorFor(variant: ButtonVariant, colors: ReturnType<typeof useThemeColors>): string {
  if (variant === 'neutral' || variant === 'danger') return colors['primary-foreground'];
  if (variant === 'success') return colors['success-foreground'];
  if (variant === 'warning') return colors['warning-foreground'];
  if (variant === 'info') return colors['info-foreground'];
  if (variant === 'special') return colors['special-foreground'];
  if (variant === 'inverse') return colors['surface-1'];
  if (variant === 'outlineDanger' || variant === 'ghostDanger') return colors.danger;
  return colors.foreground;
}

// `elevated` is tri-state, so it needs three chips rather than a Toggle: unset
// defers to the variant's own resting float (the filled plates float, the flat
// ones don't), and `flat`/`raised` override it in either direction.
const ELEVATED_MODES = ['auto', 'flat', 'raised'] as const;
type ElevatedMode = (typeof ELEVATED_MODES)[number];
const ELEVATED_MODE: Record<ElevatedMode, boolean | undefined> = { auto: undefined, flat: false, raised: true };

function ButtonPlayground(args: ComponentProps<typeof Button>) {
  const [variant, setVariant] = useState<ButtonVariant>('neutral');
  const [size, setSize] = useState<(typeof SIZES)[number]>('md');
  const [pill, setPill] = useState(false);
  const [loading, setLoading] = useState(false);
  const [disabled, setDisabled] = useState(false);
  const [ripple, setRipple] = useState(false);
  const [iconSide, setIconSide] = useState<IconSide>('none');
  const [elevatedMode, setElevatedMode] = useState<ElevatedMode>('auto');
  const [count, setCount] = useState(0);

  const colors = useThemeColors();
  const iconColor = iconColorFor(variant, colors);
  const handlePress = useCallback(() => {
    setCount((n) => n + 1);
    args.onPress?.();
  }, [args.onPress]);

  const live = {
    ...args,
    variant,
    size,
    shape: pill ? ('pill' as const) : ('rounded' as const),
    loading,
    disabled,
    ripple,
    elevated: ELEVATED_MODE[elevatedMode],
  };
  const icon = <ArrowRight color={iconColor} size={16} />;

  return (
    <Playground>
      <ControlCard title="Options">
        <Choice label="Variant" onChange={setVariant} options={VARIANTS} value={variant} />
        <Choice label="Size" onChange={setSize} options={SIZES} value={size} />
        <Choice label="Icon" onChange={setIconSide} options={ICON_SIDES} value={iconSide} />
        <Choice label="Elevated" onChange={setElevatedMode} options={ELEVATED_MODES} value={elevatedMode} />
        <Toggle label="Pill" onChange={setPill} value={pill} />
        <Toggle label="Loading" onChange={setLoading} value={loading} />
        <Toggle label="Disabled" onChange={setDisabled} value={disabled} />
        <Toggle label="Ripple" onChange={setRipple} value={ripple} />
      </ControlCard>

      <View className="flex-row items-center gap-4">
        <Button {...live} onPress={handlePress}>
          {iconSide === 'left' ? icon : null}
          {CONTINUE_LABEL}
          {iconSide === 'right' ? icon : null}
        </Button>
        <Note testID="story-press-count">{pressedLabel(count)}</Note>
      </View>

      <View className="h-3" />
      <Section title="Variants">
        <Variants>
          {VARIANTS.map((name) => (
            <Sample key={name} label={name}>
              <Button {...args} size={size} variant={name}>
                {CONTINUE_LABEL}
              </Button>
            </Sample>
          ))}
        </Variants>
      </Section>

      <Section title="Sizes">
        <Variants align="center">
          {SIZES.map((name) => (
            <Button {...args} key={name} size={name} variant={variant}>
              {SIZE_LABELS[name]}
            </Button>
          ))}
          <Button {...args} accessibilityLabel="Delete" size="icon" variant="inverse">
            <Trash2 color={colors['surface-1']} size={16} />
          </Button>
        </Variants>
      </Section>

      <Section title="States">
        <Variants align="center">
          <Sample label="leading icon">
            <Button {...args} variant="inverse">
              <Download color={colors['surface-1']} size={16} />
              {DOWNLOAD_LABEL}
            </Button>
          </Sample>
          <Sample label="loading">
            <Button {...args} loading={true} variant="neutral">
              {CONTINUE_LABEL}
            </Button>
          </Sample>
          <Sample label="disabled">
            <Button {...args} disabled={true} variant="neutral">
              {CONTINUE_LABEL}
            </Button>
          </Sample>
          <Sample label="pill">
            <Button {...args} shape="pill" variant="neutral">
              {CONTINUE_LABEL}
            </Button>
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
  render: (args) => <ButtonPlayground {...args} />,
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

/** `special` and `inverse` are the only variants whose fill/label utilities
 *  (`bg-special`, `text-special-foreground`, `bg-foreground`, `text-background`)
 *  aren't used anywhere else in the library, so a scanner miss would fail open:
 *  the class would simply not exist and the chip would render transparent with
 *  inherited text. This pins each one to the custom property it must resolve to. */
export const TokenFillsResolve: Story = {
  render: () => (
    <View className="flex-row gap-4">
      <Button testID={SPECIAL_KEY} variant="special">
        {CONTINUE_LABEL}
      </Button>
      <Button testID={INVERSE_KEY} variant="inverse">
        {CONTINUE_LABEL}
      </Button>
    </View>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const specialKey = await canvas.findByTestId(SPECIAL_KEY);
    const inverseKey = await canvas.findByTestId(INVERSE_KEY);
    const labelOf = (key: HTMLElement) => within(key).getByText(CONTINUE_LABEL);

    // Resolve each token the same way the browser resolved the class, so the
    // comparison is sRGB-vs-sRGB and survives a retint of the token itself.
    const probe = document.createElement('div');
    canvasElement.appendChild(probe);
    const resolveToken = (token: string) => {
      probe.style.backgroundColor = `var(${token})`;
      const resolved = getComputedStyle(probe).backgroundColor;
      // An undefined custom property leaves the declaration invalid, so the probe
      // falls back to transparent — which is also what a missing utility class
      // yields on the button. Asserting the token is opaque keeps the comparisons
      // below from passing vacuously when both sides are "nothing".
      expect(resolved).not.toBe(TRANSPARENT);
      return resolved;
    };

    try {
      expect(getComputedStyle(specialKey).backgroundColor).toBe(resolveToken('--color-special'));
      expect(getComputedStyle(labelOf(specialKey)).color).toBe(resolveToken('--color-special-foreground'));
      expect(getComputedStyle(inverseKey).backgroundColor).toBe(resolveToken('--color-foreground'));
      expect(getComputedStyle(labelOf(inverseKey)).color).toBe(resolveToken('--color-background'));
    } finally {
      probe.remove();
    }
  },
};
