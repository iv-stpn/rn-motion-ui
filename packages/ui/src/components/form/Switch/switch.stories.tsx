import type { Meta, StoryObj } from '@storybook/react';
import { type ComponentProps, useState } from 'react';
import { View } from 'react-native';
import { expect, fn, userEvent, within } from 'storybook/test';
import { Choice, ControlCard, Playground, Sample, Section, Toggle, Variants } from '../../../__stories__/story-harness';
import { Switch, type SwitchSize } from './switch';
import type { SwitchThemeName } from './switch-theme';

const meta = {
  title: 'Form/Switch',
  component: Switch,
  parameters: { layout: 'centered' },
  args: { isSelected: false, label: 'Enable notifications', onSelectedChange: fn() },
} satisfies Meta<typeof Switch>;

type Story = StoryObj<typeof meta>;

const noop = () => {
  /* static sample */
};

/** Every built-in theme, in the order the docs list them. */
const THEMES: readonly SwitchThemeName[] = ['info', 'primary', 'success', 'warning', 'danger', 'special'];

/** All size variants. */
const SIZES: readonly SwitchSize[] = ['sm', 'md', 'lg'];

/**
 * Shared props for a bare colour swatch: static, and with the meta's `label`
 * cleared so the track sits alone under its `Sample` caption. Each call site adds
 * its own `accessibilityLabel`, which is what names the switch once `label` is gone.
 */
const SWATCH = { label: undefined, onSelectedChange: noop } as const;

// ── ThemeFillsResolve probes ────────────────────────────────────────────────
const ON_KEY = 'switch-theme-on';
const OFF_KEY = 'switch-theme-off';
const TRANSPARENT = 'rgba(0, 0, 0, 0)';
// The off-track is a token at 60% alpha, so it resolves to an rgba() string.
const RGBA_RE = /^rgba\(/;
/** Every number in a colour string, whatever the notation wrapping them. */
const NUMBER_RE = /-?[\d.]+/g;
/** `color(srgb …)` states its channels as 0–1 floats; `rgb()`/`rgba()` as bytes. */
const SRGB_FN_RE = /^color\(\s*srgb/;

/**
 * A colour string as `[r, g, b, a]`, with r/g/b in bytes and a in 0–1.
 *
 * `getComputedStyle` hands back whichever notation the browser picked: `rgb()` /
 * `rgba()` for a value set in those terms, but `color(srgb …)` — float channels —
 * for one it converted from another space. Both arrive here, so the channels are
 * compared instead of the strings.
 */
function channelsOf(color: string): [number, number, number, number] {
  const parts = (color.match(NUMBER_RE) ?? []).map(Number);
  const scale = SRGB_FN_RE.test(color) ? 255 : 1;
  const [r = 0, g = 0, b = 0, a = 1] = parts;
  return [r * scale, g * scale, b * scale, a];
}

/**
 * Assert two colours are the same fill, comparing r/g/b within one byte. The
 * library quantises to 8-bit sRGB while the browser keeps float channels, so the
 * two agree to within a rounding step rather than exactly.
 */
function expectSameColor(actual: readonly number[], expected: readonly number[]) {
  const drift = [0, 1, 2].map((i) => Math.abs((actual[i] ?? 0) - (expected[i] ?? 0)));
  expect(Math.max(...drift)).toBeLessThanOrEqual(1);
}

// biome-ignore lint/style/useComponentExportOnlyModules: story helper
function SwitchPlayground(args: ComponentProps<typeof Switch>) {
  const [on, setOn] = useState(true);
  const [disabled, setDisabled] = useState(false);
  const [theme, setTheme] = useState<SwitchThemeName>('info');
  const [size, setSize] = useState<SwitchSize>('md');

  return (
    <Playground>
      <ControlCard title="Options">
        <Toggle label="Disabled" onChange={setDisabled} value={disabled} />
        <Choice label="Theme" onChange={setTheme} options={THEMES} value={theme} />
        <Choice label="Size" onChange={setSize} options={SIZES} value={size} />
      </ControlCard>

      <Switch
        {...args}
        isSelected={on}
        isDisabled={disabled}
        label="Enable notifications"
        onSelectedChange={setOn}
        theme={theme}
        size={size}
      />

      <Section title="States">
        <Variants direction="column">
          <Sample label="Off">
            <Switch {...args} isSelected={false} label="Off" onSelectedChange={noop} theme={theme} size={size} />
          </Sample>
          <Sample label="On">
            <Switch {...args} isSelected={true} label="On" onSelectedChange={noop} theme={theme} size={size} />
          </Sample>
          {/* Pressing a disabled switch runs a short 2px shake instead of toggling. */}
          <Sample label="Disabled, off">
            <Switch
              {...args}
              isSelected={false}
              isDisabled={true}
              label="Disabled"
              onSelectedChange={noop}
              theme={theme}
              size={size}
            />
          </Sample>
          <Sample label="Disabled, on">
            <Switch
              {...args}
              isSelected={true}
              isDisabled={true}
              label="Disabled"
              onSelectedChange={noop}
              theme={theme}
              size={size}
            />
          </Sample>
        </Variants>
      </Section>

      <Section title="Sizes">
        <Variants direction="column">
          {SIZES.map((s) => (
            <Sample key={s} label={s}>
              <Variants>
                <Switch {...args} {...SWATCH} accessibilityLabel={`${s}, off`} isSelected={false} size={s} theme={theme} />
                <Switch {...args} {...SWATCH} accessibilityLabel={`${s}, on`} isSelected={true} size={s} theme={theme} />
              </Variants>
            </Sample>
          ))}
        </Variants>
      </Section>

      {/* Off-track is one shared grey across every theme — only the on-track and
          the thumb change, so a row of mixed themes reads as one family. The
          swatches carry no visible label (the Sample caption names the theme), so
          each passes an accessibilityLabel to keep an accessible name. */}
      <Section title="Themes">
        <Variants direction="column">
          {THEMES.map((name) => (
            <Sample key={name} label={name}>
              <Variants>
                <Switch {...args} {...SWATCH} accessibilityLabel={`${name}, off`} isSelected={false} theme={name} />
                <Switch {...args} {...SWATCH} accessibilityLabel={`${name}, on`} isSelected={true} theme={name} />
              </Variants>
            </Sample>
          ))}
        </Variants>
      </Section>

      {/* A theme object overrides slots on top of `info`, so anything left out
          keeps the default — the first sample still has the grey off-track and
          the white thumb. */}
      <Section title="Custom themes">
        <Variants direction="column">
          <Sample label="track only — a literal colour">
            <Switch
              {...args}
              {...SWATCH}
              accessibilityLabel="Custom literal track"
              isSelected={true}
              theme={{ track: '#0ea5e9' }}
            />
          </Sample>
          <Sample label="all three slots, from tokens">
            <Switch
              {...args}
              {...SWATCH}
              accessibilityLabel="Custom token theme"
              isSelected={true}
              theme={{ track: 'accent', trackOff: 'muted', thumb: 'accent-foreground' }}
            />
          </Sample>
          <Sample label="token with an alpha suffix">
            <Switch
              {...args}
              {...SWATCH}
              accessibilityLabel="Custom alpha-suffixed track"
              isSelected={true}
              theme={{ track: 'special/70' }}
            />
          </Sample>
        </Variants>
      </Section>
    </Playground>
  );
}

export default meta;

/** Toggle the live switch, flip it to disabled, and compare every track/thumb
 *  state below. */
export const Interactive: Story = {
  render: (args) => <SwitchPlayground {...args} />,
};

export const Default: Story = {
  name: 'Demo: Toggle on',
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const toggle = await canvas.findByRole('switch');
    await userEvent.click(toggle);
    await expect(args.onSelectedChange).toHaveBeenCalledWith(true);
  },
};

/** The theme's three fills are set through `style` from resolved token values,
 *  not by a utility class, so no class scanner covers them — a mis-resolved slot
 *  would fail open (transparent track, invisible thumb) rather than loudly. This
 *  pins the default theme to the custom properties it must resolve to: `info`
 *  on-track, white thumb, and a grey off-track distinct from both. */
export const ThemeFillsResolve: Story = {
  name: 'Test: Theme fills resolve',
  render: () => (
    <View className="flex-row gap-4">
      <Switch {...SWATCH} accessibilityLabel="On" isSelected={true} testID={ON_KEY} />
      <Switch {...SWATCH} accessibilityLabel="Off" isSelected={false} testID={OFF_KEY} />
    </View>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const onTrack = await canvas.findByTestId(`${ON_KEY}-track`);
    const offTrack = await canvas.findByTestId(`${OFF_KEY}-track`);
    const onThumb = await canvas.findByTestId(`${ON_KEY}-thumb`);

    // Resolve each token through a probe so the comparison survives a retint of
    // the token itself. `rgb(from …)` asks the browser for the sRGB form, so the
    // conversion from the authored oklch is the browser's — this stays
    // independent of the library's own oklch→sRGB code (covered by
    // lib/__tests__/color.test.ts).
    const probe = document.createElement('div');
    canvasElement.appendChild(probe);
    const resolveToken = (token: string) => {
      probe.style.backgroundColor = `rgb(from var(${token}) r g b)`;
      const resolved = getComputedStyle(probe).backgroundColor;
      // A missing custom property leaves the declaration invalid and the probe
      // transparent — which is also what an unresolved slot paints. Asserting the
      // token is opaque keeps the comparisons below from passing vacuously.
      expect(resolved).not.toBe(TRANSPARENT);
      expect(resolved).not.toMatch(RGBA_RE);
      return channelsOf(resolved);
    };

    try {
      // Compared as channels, not strings: the probe comes back in whichever
      // notation the browser picks for a converted colour (`color(srgb …)`, with
      // float channels) while the component paints 8-bit `rgb()`, so an exact
      // string match would fail on notation alone. One byte of tolerance covers
      // that quantisation.
      expectSameColor(channelsOf(getComputedStyle(onTrack).backgroundColor), resolveToken('--color-info'));
      expectSameColor(channelsOf(getComputedStyle(onThumb).backgroundColor), resolveToken('--color-white'));

      // The off-track is `muted-foreground/60` — a translucent grey, so it is
      // neither transparent nor the on-track fill, and its alpha is the 0.6 the
      // slash suffix asked for.
      const off = getComputedStyle(offTrack).backgroundColor;
      expect(off).not.toBe(TRANSPARENT);
      expect(off).toMatch(RGBA_RE);
      const offChannels = channelsOf(off);
      expect(offChannels[3]).toBeCloseTo(0.6, 2);
      expect(offChannels.slice(0, 3)).not.toEqual(resolveToken('--color-info').slice(0, 3));
    } finally {
      probe.remove();
    }
  },
};
