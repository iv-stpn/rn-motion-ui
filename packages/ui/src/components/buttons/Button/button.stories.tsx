import type { Meta, StoryObj } from '@storybook/react';
import { type ComponentProps, useCallback, useState } from 'react';
import { View } from 'react-native';
import { ArrowRightLine as ArrowRight } from 'rn-motion-ui-icons/icons/arrow-right-line';
import { Delete2Line as Trash2 } from 'rn-motion-ui-icons/icons/delete-2-line';
import { DownloadLine as Download } from 'rn-motion-ui-icons/icons/download-line';
import { expect, fn, userEvent, within } from 'storybook/test';
import { ELEVATION_KEYS, ELEVATIONS, type ElevationKey } from '../../../__stories__/story-elevations';
import {
  Choice,
  ControlCard,
  FrostedBackdrop,
  Note,
  Playground,
  Sample,
  Section,
  Toggle,
  Variants,
} from '../../../__stories__/story-harness';
import { SURFACE_LEVELS } from '../../../lib/elevated';
import { useThemeColors } from '../../../theme/use-theme-color';
import { Button, type ButtonVariant } from './button';

const meta = {
  title: 'Buttons/Button',
  component: Button,
  parameters: { layout: 'centered' },
  args: { children: 'Continue', variant: 'neutral', size: 'md', elevation: 0, floating: false, onPress: fn() },
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'neutral', 'ghost', 'danger', 'outlineDanger', 'ghostDanger'],
    },
    size: { control: 'select', options: ['sm', 'md', 'lg', 'icon'] },
    shape: { control: 'select', options: ['rounded', 'pill'] },
    elevation: { control: { type: 'range', min: 0, max: 8, step: 1 } },
    floating: { control: 'boolean' },
  },
} satisfies Meta<typeof Button>;

type Story = StoryObj<typeof meta>;

const VARIANTS = [
  'primary',
  'neutral',
  'ghost',
  'danger',
  'success',
  'warning',
  'info',
  'outlineDanger',
  'ghostDanger',
] as const satisfies readonly ButtonVariant[];
const SIZES = ['sm', 'md', 'lg'] as const;
const SIZE_LABELS = { sm: 'Small', md: 'Medium', lg: 'Large' } as const;
const ICON_SIDES = ['none', 'left', 'right'] as const;
const CONTINUE_LABEL = 'Continue';
const DOWNLOAD_LABEL = 'Download';
const pressedLabel = (n: number) => `Pressed ${n} times`;

// The one token-backed fill, probed in TokenFillsResolve.
const NEUTRAL_KEY = 'neutral-key';
// The raised filled button whose elevation shadow FilledElevationCastsFillAwareShadow pins.
const RAISED_KEY = 'raised-key';
// The raised neutral button whose elevation shadow NeutralElevationCastsSurfaceLadder pins.
const NEUTRAL_RAISED_KEY = 'neutral-raised-key';
// What the browser computes for both an unset custom property and an absent
// background utility — the collision TokenFillsResolve has to rule out.
const TRANSPARENT = 'rgba(0, 0, 0, 0)';

type IconSide = (typeof ICON_SIDES)[number];

// Icon colour per variant — filled variants carry their fill's foreground
// partner, the danger outlines carry the danger hue, everything else (including
// `neutral`'s light surface plate) the plain foreground.
function iconColorFor(variant: ButtonVariant, colors: ReturnType<typeof useThemeColors>): string {
  if (variant === 'primary' || variant === 'danger') return colors['primary-foreground'];
  if (variant === 'success') return colors['success-foreground'];
  if (variant === 'warning') return colors['warning-foreground'];
  if (variant === 'info') return colors['info-foreground'];
  if (variant === 'outlineDanger' || variant === 'ghostDanger') return colors.danger;
  return colors.foreground;
}

function ButtonPlayground(args: ComponentProps<typeof Button>) {
  const [variant, setVariant] = useState<ButtonVariant>('neutral');
  const [size, setSize] = useState<(typeof SIZES)[number]>('md');
  const [pill, setPill] = useState(false);
  const [loading, setLoading] = useState(false);
  const [disabled, setDisabled] = useState(false);
  const [ripple, setRipple] = useState(false);
  const [iconSide, setIconSide] = useState<IconSide>('none');
  const [floating, setFloating] = useState(false);
  const [elevationKey, setElevationKey] = useState<ElevationKey>('0');
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
    floating,
    elevation: ELEVATIONS[elevationKey],
  };
  const icon = <ArrowRight color={iconColor} size={16} />;

  return (
    <Playground>
      <ControlCard title="Options">
        <Choice label="Variant" onChange={setVariant} options={VARIANTS} value={variant} />
        <Choice label="Size" onChange={setSize} options={SIZES} value={size} />
        <Choice label="Icon" onChange={setIconSide} options={ICON_SIDES} value={iconSide} />
        <Toggle label="Floating" onChange={setFloating} value={floating} />
        <Choice label="Elevation" onChange={setElevationKey} options={ELEVATION_KEYS} value={elevationKey} />
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
          <Button {...args} accessibilityLabel="Delete" size="icon" variant="neutral">
            <Trash2 color={colors.foreground} size={16} />
          </Button>
        </Variants>
      </Section>

      {/* The shadow is the only thing `elevation` moves (a Button's fill comes
          from its variant), so the ladder is best read on a flat variant that
          has no resting shadow to mask it. */}
      <Section title="Elevation ladder">
        <Variants align="center">
          <Sample label="flat (0)">
            <Button {...args} elevation={0} floating={floating} shape={live.shape} size={size} variant="neutral">
              {CONTINUE_LABEL}
            </Button>
          </Sample>
          {SURFACE_LEVELS.map((level) => (
            <Sample key={level} label={`${level}`}>
              <Button {...args} elevation={level} floating={floating} shape={live.shape} size={size} variant="neutral">
                {CONTINUE_LABEL}
              </Button>
            </Sample>
          ))}
        </Variants>
      </Section>

      <Section title="States">
        <Variants align="center">
          <Sample label="leading icon">
            <Button {...args} variant="neutral">
              <Download color={colors.foreground} size={16} />
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

/** `neutral` rests on the light surface plate: `bg-surface-3` with `foreground`
 *  ink. It resolves through the same custom properties the surface ladder and the
 *  rest of the library use, so the comparison is sRGB-vs-sRGB and survives a
 *  retint of the token itself. */
export const TokenFillsResolve: Story = {
  render: () => (
    <View className="flex-row gap-4">
      <Button testID={NEUTRAL_KEY} variant="neutral">
        {CONTINUE_LABEL}
      </Button>
    </View>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const neutralKey = await canvas.findByTestId(NEUTRAL_KEY);
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
      expect(getComputedStyle(neutralKey).backgroundColor).toBe(resolveToken('--color-surface-3'));
      expect(getComputedStyle(labelOf(neutralKey)).color).toBe(resolveToken('--color-foreground'));
    } finally {
      probe.remove();
    }
  },
};

/**
 * A raised *filled* button casts a *fill-aware* shadow, not the surface ladder's
 * subtle drop. The ladder is tuned for surfaces resting on the page and reads as
 * "no elevation" on an opaque button fill (`primary`, the vivid status fills), so
 * those variants graduate a stronger drop plus a fill-coloured ring instead.
 * Asserting the two shadows differ is the point: identical would mean the
 * fill-aware recipe regressed back to the ladder.
 */
export const FilledElevationCastsFillAwareShadow: Story = {
  render: () => (
    <View className="flex-row gap-4">
      <Button testID={RAISED_KEY} variant="primary" elevation={3}>
        {CONTINUE_LABEL}
      </Button>
    </View>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const raised = await canvas.findByTestId(RAISED_KEY);
    // Probe the ladder's rung directly, like Card's ladder test does, so the
    // comparison is shadow-recipe vs shadow-recipe rather than against a literal.
    const probe = document.createElement('div');
    canvasElement.appendChild(probe);
    try {
      probe.className = 'shadow-elevated-3';
      const ladder = getComputedStyle(probe).boxShadow;
      const raisedShadow = getComputedStyle(raised).boxShadow;
      // A real shadow, and a *different* one than the surface ladder would cast.
      expect(raisedShadow).not.toBe('none');
      expect(raisedShadow).not.toBe(ladder);
    } finally {
      probe.remove();
    }
  },
};

/**
 * A raised `neutral` button is a *surface* — its `bg-surface-3` plate is the flat
 * resting surface, so raising `elevation` casts the surface ladder's
 * `shadow-elevated-N` (drop + rim), exactly like a Card at the same rung. The
 * regression this pins is a raised `neutral` button that swaps to the filled
 * variant's fill-aware ring instead. Asserting the two shadows match is the
 * point: different would mean the neutral plate drifted off the surface ladder.
 */
export const NeutralElevationCastsSurfaceLadder: Story = {
  render: () => (
    <View className="flex-row gap-4">
      <Button testID={NEUTRAL_RAISED_KEY} variant="neutral" elevation={3}>
        {CONTINUE_LABEL}
      </Button>
    </View>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const raised = await canvas.findByTestId(NEUTRAL_RAISED_KEY);
    // Probe the ladder's rung directly, like Card's ladder test does, so the
    // comparison is shadow-recipe vs shadow-recipe rather than against a literal.
    const probe = document.createElement('div');
    canvasElement.appendChild(probe);
    try {
      probe.className = 'shadow-elevated-3';
      const ladder = getComputedStyle(probe).boxShadow;
      const raisedShadow = getComputedStyle(raised).boxShadow;
      // The neutral plate keeps the surface ladder — the shadow is the ladder's own.
      expect(raisedShadow).not.toBe('none');
      expect(raisedShadow).toBe(ladder);
    } finally {
      probe.remove();
    }
  },
};

/**
 * A frosted button trades the variant's opaque fill (and its shadow) for the
 * glass backdrop — the blur is the depth, so neither the plate tint nor the
 * shadow survives. The shell goes fully transparent and shadowless while a
 * descendant still carries the `backdrop-filter`; the opaque `primary` sibling
 * keeps its fill for contrast.
 */
export const Frosted: Story = {
  name: 'Frosted',
  render: () => (
    <FrostedBackdrop className="p-6">
      <View className="flex-row items-center gap-4">
        <Button frosted={true} testID="button-frosted">
          {CONTINUE_LABEL}
        </Button>
        <Button variant="primary" testID="button-opaque">
          {CONTINUE_LABEL}
        </Button>
      </View>
    </FrostedBackdrop>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const frosted = await canvas.findByTestId('button-frosted');
    const opaque = canvas.getByTestId('button-opaque');

    // The opaque primary keeps its fill; the frosted shell drops it.
    expect(getComputedStyle(opaque).backgroundColor).not.toBe(TRANSPARENT);
    expect(getComputedStyle(frosted).backgroundColor).toBe(TRANSPARENT);
    expect(getComputedStyle(frosted).boxShadow).toBe('none');

    // The frost lives on the glass child, not the shell.
    const glass = Array.from(frosted.querySelectorAll('*')).find((el) => getComputedStyle(el).backdropFilter.includes('blur('));
    expect(glass).toBeTruthy();
  },
};
