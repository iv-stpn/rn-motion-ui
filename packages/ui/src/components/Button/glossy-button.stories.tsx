import type { Meta, StoryObj } from '@storybook/react';
import { type ComponentProps, useCallback, useState } from 'react';
import { View } from 'react-native';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { Choice, Controls, Note, Playground, Sample, Section, Toggle, Variants } from '../../__stories__/story-harness';
import { ArrowRight, Download } from '../../lib/icons';
import { useThemeColors } from '../../theme/use-theme-color';
import { GlossyButton, type GlossyVariant, glossyContentColor } from './glossy-button';

const meta = {
  title: 'Components/GlossyButton',
  component: GlossyButton,
  parameters: { layout: 'centered' },
  args: { children: 'Continue', variant: 'neutral', size: 'md', onPress: fn() },
  argTypes: {
    variant: {
      control: 'select',
      options: ['neutral', 'inverse', 'danger', 'success', 'warning', 'info', 'special', 'gray'],
      description:
        'Face colour from the built-in set. Every value keeps the glossy treatment; neutral is the translucent key, inverse fills with `foreground` so it flips with the page, status values fill with theme tokens, and gray is a fixed plate pinned in both themes.',
    },
    color: {
      control: 'color',
      description:
        'Paint the key any colour — the shadow, rim, sheen and hover tint are all re-derived from it in OKLCH, and the label picks the legible side automatically. Overrides `variant`.',
    },
    contentColor: { control: 'color', description: 'Override the derived label/icon colour.' },
    size: { control: 'select', options: ['sm', 'md', 'lg', 'icon'] },
    shape: { control: 'select', options: ['rounded', 'pill'] },
  },
} satisfies Meta<typeof GlossyButton>;

type Story = StoryObj<typeof meta>;

const VARIANTS = [
  'neutral',
  'inverse',
  'danger',
  'success',
  'warning',
  'info',
  'special',
  'gray',
] as const satisfies readonly GlossyVariant[];
const SIZES = ['sm', 'md', 'lg'] as const;
const SIZE_LABELS = { sm: 'Small', md: 'Medium', lg: 'Large' } as const;
const ICON_SIDES = ['none', 'left', 'right'] as const;
const CONTINUE_LABEL = 'Continue';
const DOWNLOAD_LABEL = 'Download';
const UPGRADE_LABEL = 'Upgrade';
const pressedLabel = (n: number) => `Pressed ${n} times`;

// The pinned `gray` plate and its pinned mid-grey label, both fixed Geist
// values. Neither may move on a theme swap; see GrayIsAlwaysGray.
const GRAY_KEY = 'gray-key';
const NEUTRAL_KEY = 'neutral-key';
const GRAY_FACE = 'rgb(242, 242, 242)';
const GRAY_LABEL_COLOR = 'rgb(112, 112, 112)';

// Arbitrary faces, none of which is a variant: each derives its own shadow,
// rim, sheen and hover tint from the hex below. The last two straddle the
// lightness threshold that flips the key between the light and dark treatment.
const CUSTOM_COLORS = [
  { label: 'violet', color: '#7c3aed' },
  { label: 'teal', color: '#0d9488' },
  { label: 'amber', color: '#f59e0b' },
  { label: 'rose', color: '#e11d48' },
  { label: 'ink', color: '#18181b' },
  { label: 'cream', color: '#fef3c7' },
] as const;

type IconSide = (typeof ICON_SIDES)[number];

// biome-ignore lint/style/useComponentExportOnlyModules: story helper
function GlossyButtonPlayground(args: ComponentProps<typeof GlossyButton>) {
  const [variant, setVariant] = useState<GlossyVariant>('neutral');
  const [size, setSize] = useState<(typeof SIZES)[number]>('md');
  const [pill, setPill] = useState(false);
  const [loading, setLoading] = useState(false);
  const [disabled, setDisabled] = useState(false);
  const [ripple, setRipple] = useState(false);
  const [iconSide, setIconSide] = useState<IconSide>('none');
  const [count, setCount] = useState(0);

  const colors = useThemeColors();
  const handlePress = useCallback(() => {
    setCount((n) => n + 1);
    args.onPress?.();
  }, [args.onPress]);

  const live = { ...args, variant, size, shape: pill ? ('pill' as const) : ('rounded' as const), loading, disabled, ripple };
  const icon = <ArrowRight color={glossyContentColor(variant, colors)} size={16} />;

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
        <GlossyButton {...live} onPress={handlePress}>
          {iconSide === 'left' ? icon : null}
          {CONTINUE_LABEL}
          {iconSide === 'right' ? icon : null}
        </GlossyButton>
        <Note testID="story-press-count">{pressedLabel(count)}</Note>
      </View>

      <View style={{ height: 12 }} />
      {/* Every variant keeps the glossy treatment — a face under a dome gradient +
          rim hairline, with an inset bevel and a cast shadow that snap to 0 while
          pressed so the key sinks. Hover tints the face on fine pointers; touch
          presses dim the whole key instead. The variant only picks the face the
          treatment derives from: neutral is the translucent key, inverse flips to
          the foreground colour, status values fill with theme tokens, and gray is
          a fixed plate. Because a plate that light opts out of the page's dark
          branch, gray looks identical in both themes — flip the Storybook theme
          and it keeps its plate and its mid-grey label, while neutral and inverse
          swap. */}
      <Section title="Variants">
        <Variants>
          {VARIANTS.map((name) => (
            <Sample key={name} label={name}>
              <GlossyButton {...args} size={size} variant={name}>
                {CONTINUE_LABEL}
              </GlossyButton>
            </Sample>
          ))}
        </Variants>
      </Section>

      {/* No variant is involved below: `color` takes any hex/rgb/oklch and the
          whole effect stack is re-derived from it in OKLCH — a violet key casts
          a violet shadow and hovers to a darker violet, with the label flipping
          between white and ink at the lightness threshold. Toggle the Storybook
          theme: these are pinned colours, so they look identical in both. */}
      <Section title="Custom colours">
        <Variants>
          {CUSTOM_COLORS.map(({ label, color }) => (
            <Sample key={label} label={label}>
              <GlossyButton {...args} color={color} size={size}>
                {UPGRADE_LABEL}
              </GlossyButton>
            </Sample>
          ))}
        </Variants>
      </Section>

      <Section title="Sizes">
        <Variants align="center">
          {SIZES.map((name) => (
            <GlossyButton {...args} key={name} size={name} variant={variant}>
              {SIZE_LABELS[name]}
            </GlossyButton>
          ))}
        </Variants>
      </Section>

      <Section title="States">
        <Variants align="center">
          <Sample label="with icon">
            <GlossyButton {...args}>
              <Download color={glossyContentColor('neutral', colors)} size={16} />
              {DOWNLOAD_LABEL}
            </GlossyButton>
          </Sample>
          <Sample label="loading">
            <GlossyButton {...args} loading={true} variant={variant}>
              {CONTINUE_LABEL}
            </GlossyButton>
          </Sample>
          <Sample label="disabled">
            <GlossyButton {...args} disabled={true} variant={variant}>
              {CONTINUE_LABEL}
            </GlossyButton>
          </Sample>
        </Variants>
      </Section>
    </Playground>
  );
}

export default meta;

/** Every face, size, shape and state in one place: drive the top key with the
 *  controls, or read the rows below for the full catalogue. */
export const Interactive: Story = {
  render: (args) => <GlossyButtonPlayground {...args} />,
};

export const Default: Story = {
  name: 'Demo: Press to confirm',
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const button = await canvas.findByRole('button');
    await userEvent.click(button);
    await expect(args.onPress).toHaveBeenCalled();
  },
};

/**
 * The `gray` key is pinned: the same light plate and mid-grey label in both
 * themes. Nothing about it may read the page — not the fill, and not the label,
 * which is the failure mode a themed token would produce (a "gray" key turning
 * into a charcoal plate on a dark page). The `neutral` key beside it is the
 * control — it *should* follow the page, and the play function waits on it to
 * know the theme swap landed before checking that the gray key ignored it.
 */
export const GrayIsAlwaysGray: Story = {
  render: () => (
    <View style={{ flexDirection: 'row', gap: 16 }}>
      <GlossyButton testID={GRAY_KEY} variant="gray">
        {CONTINUE_LABEL}
      </GlossyButton>
      <GlossyButton testID={NEUTRAL_KEY} variant="neutral">
        {CONTINUE_LABEL}
      </GlossyButton>
    </View>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const grayKey = await canvas.findByTestId(GRAY_KEY);
    const neutralKey = await canvas.findByTestId(NEUTRAL_KEY);
    const labelOf = (key: HTMLElement) => within(key).getByText(CONTINUE_LABEL);
    const root = document.documentElement;
    const initialTheme = root.className;

    try {
      root.classList.add('light');
      root.classList.remove('dark');
      await waitFor(() => expect(getComputedStyle(grayKey).backgroundColor).toBe(GRAY_FACE));
      expect(getComputedStyle(labelOf(grayKey)).color).toBe(GRAY_LABEL_COLOR);
      const neutralOnLight = getComputedStyle(neutralKey).backgroundColor;

      root.classList.remove('light');
      root.classList.add('dark');
      // useThemeColors re-renders off a MutationObserver on <html>, so wait for
      // the neutral key — which does track the page — to prove the swap landed.
      await waitFor(() => expect(getComputedStyle(neutralKey).backgroundColor).not.toBe(neutralOnLight));

      expect(getComputedStyle(grayKey).backgroundColor).toBe(GRAY_FACE);
      expect(getComputedStyle(labelOf(grayKey)).color).toBe(GRAY_LABEL_COLOR);
    } finally {
      root.className = initialTheme;
    }
  },
};
