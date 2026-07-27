import type { Meta, StoryObj } from '@storybook/react';
import { type ComponentProps, useCallback, useState } from 'react';
import { View } from 'react-native';
import { expect, fn, userEvent, within } from 'storybook/test';
import { Choice, Controls, Note, Playground, Sample, Section, Toggle, Variants } from '../../__stories__/story-harness';
import { ArrowRight, Download, Trash2 } from '../../lib/icons';
import { useThemeColors } from '../../theme/use-theme-color';
import { Button, type ButtonVariant } from './button';

const meta = {
  title: 'Components/Button',
  component: Button,
  parameters: { layout: 'centered' },
  args: { children: 'Continue', variant: 'primary', size: 'md', onPress: fn() },
  argTypes: {
    variant: {
      control: 'select',
      options: [
        'primary',
        'secondary',
        'ghost',
        'outline',
        'danger',
        'special',
        'inverse',
        'outlineDanger',
        'ghostDanger',
        'ghostPrimary',
      ],
    },
    size: { control: 'select', options: ['sm', 'md', 'lg', 'icon'] },
    shape: { control: 'select', options: ['rounded', 'pill'] },
  },
} satisfies Meta<typeof Button>;

type Story = StoryObj<typeof meta>;

const VARIANTS = [
  'primary',
  'secondary',
  'ghost',
  'outline',
  'danger',
  'special',
  'inverse',
  'outlineDanger',
  'ghostDanger',
  'ghostPrimary',
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
  if (variant === 'primary' || variant === 'danger') return colors['primary-foreground'];
  if (variant === 'special') return colors['special-foreground'];
  if (variant === 'inverse') return colors['surface-1'];
  if (variant === 'outlineDanger' || variant === 'ghostDanger') return colors.danger;
  if (variant === 'ghostPrimary') return colors.primary;
  return colors.foreground;
}

// biome-ignore lint/style/useComponentExportOnlyModules: story helper
function ButtonPlayground(args: ComponentProps<typeof Button>) {
  const [variant, setVariant] = useState<ButtonVariant>('primary');
  const [size, setSize] = useState<(typeof SIZES)[number]>('md');
  const [pill, setPill] = useState(false);
  const [loading, setLoading] = useState(false);
  const [disabled, setDisabled] = useState(false);
  const [ripple, setRipple] = useState(false);
  const [iconSide, setIconSide] = useState<IconSide>('none');
  const [count, setCount] = useState(0);

  const colors = useThemeColors();
  const iconColor = iconColorFor(variant, colors);
  const handlePress = useCallback(() => {
    setCount((n) => n + 1);
    args.onPress?.();
  }, [args.onPress]);

  const live = { ...args, variant, size, shape: pill ? ('pill' as const) : ('rounded' as const), loading, disabled, ripple };
  const icon = <ArrowRight color={iconColor} size={16} />;

  return (
    <Playground>
      <Controls>
        <Choice label="Variant" onChange={setVariant} options={VARIANTS} value={variant} />
        <Choice label="Size" onChange={setSize} options={SIZES} value={size} />
        <Choice label="Icon" onChange={setIconSide} options={ICON_SIDES} value={iconSide} />
        <Toggle label="Pill" onChange={setPill} value={pill} />
        <Toggle label="Loading" onChange={setLoading} value={loading} />
        <Toggle label="Disabled" onChange={setDisabled} value={disabled} />
        <Toggle label="Ripple" onChange={setRipple} value={ripple} />
      </Controls>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
        <Button {...live} onPress={handlePress}>
          {iconSide === 'left' ? icon : null}
          {CONTINUE_LABEL}
          {iconSide === 'right' ? icon : null}
        </Button>
        <Note testID="story-press-count">{pressedLabel(count)}</Note>
      </View>

      <View style={{ height: 12 }} />
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
          <Button {...args} accessibilityLabel="Delete" size="icon" variant="secondary">
            <Trash2 color={colors.foreground} size={16} />
          </Button>
        </Variants>
      </Section>

      <Section title="States">
        <Variants align="center">
          <Sample label="leading icon">
            <Button {...args} variant="secondary">
              <Download color={colors.foreground} size={16} />
              {DOWNLOAD_LABEL}
            </Button>
          </Sample>
          <Sample label="loading">
            <Button {...args} loading={true} variant="primary">
              {CONTINUE_LABEL}
            </Button>
          </Sample>
          <Sample label="disabled">
            <Button {...args} disabled={true} variant="primary">
              {CONTINUE_LABEL}
            </Button>
          </Sample>
          <Sample label="pill">
            <Button {...args} shape="pill" variant="primary">
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
 *  (`bg-special`, `text-special-foreground`, `bg-foreground`, `text-surface-1`)
 *  aren't used anywhere else in the library, so a scanner miss would fail open:
 *  the class would simply not exist and the chip would render transparent with
 *  inherited text. This pins each one to the custom property it must resolve to. */
export const TokenFillsResolve: Story = {
  render: () => (
    <View style={{ flexDirection: 'row', gap: 16 }}>
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
      expect(getComputedStyle(labelOf(inverseKey)).color).toBe(resolveToken('--color-surface-1'));
    } finally {
      probe.remove();
    }
  },
};
