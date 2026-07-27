import { StatusBar } from 'expo-status-bar';
import { type ReactNode, useCallback, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { GlossyButton, type GlossyVariant } from 'rn-motion-ui/glossy-button';
import { type ThemeName, Uniwind, useUniwind } from 'uniwind';
import './global.css';

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

const THEMES = ['light', 'dark'] as const satisfies readonly ThemeName[];

// Handlers hoisted to module scope so each button gets a stable onPress
// reference (no closure recreated per render, nothing to memoize).
const SET_THEME: Record<(typeof THEMES)[number], () => void> = {
  light: () => Uniwind.setTheme('light'),
  dark: () => Uniwind.setTheme('dark'),
};

// Hoisted so no bare string literals land in JSX (the repo's noJsxLiterals rule).
const TITLE = 'GlossyButton';
const THEME_LABEL = 'Theme';
const THEME_LABELS = { light: 'Light', dark: 'Dark' } as const;
const CONTINUE_LABEL = 'Continue';
const PILL_LABEL = 'Pill';
const RIPPLE_LABEL = 'Ripple';
const LOADING_LABEL = 'Loading';
const DISABLED_LABEL = 'Disabled';
const pressedLabel = (n: number) => `Pressed ${n} ${n === 1 ? 'time' : 'times'}`;

type RowProps = { label: string; children: ReactNode };

function Row({ label, children }: RowProps) {
  return (
    <View className="gap-3">
      <Text className="text-muted-foreground text-xs uppercase tracking-wider">{label}</Text>
      <View className="flex-row flex-wrap items-center gap-3">{children}</View>
    </View>
  );
}

/**
 * Light/dark switcher.
 *
 * `Uniwind.setTheme` is the one call that flips both platforms: on web it swaps
 * the `.light`/`.dark` class on `<html>` (which tokens.css treats as an absolute
 * override of the OS `prefers-color-scheme`, so picking light sticks even on a
 * dark OS), and on native it sets the RN `Appearance` color scheme, which is
 * what `useThemeColor` inside the library reads. `useUniwind()` re-renders this
 * row on the swap so the active button stays in sync.
 *
 * Only the two explicit themes are offered — `setTheme('system')` exists, but a
 * demo wants to *hold* a theme, and on native the reset to the OS value only
 * lands on the next appearance change.
 */
function ThemeSwitcher() {
  const { theme } = useUniwind();
  return (
    <Row label={THEME_LABEL}>
      {THEMES.map((name) => (
        <GlossyButton
          key={name}
          size="sm"
          variant={theme === name ? 'inverse' : 'neutral'}
          accessibilityLabel={THEME_LABELS[name]}
          onPress={SET_THEME[name]}
        >
          {THEME_LABELS[name]}
        </GlossyButton>
      ))}
    </Row>
  );
}

export default function App() {
  const [count, setCount] = useState(0);
  const bump = useCallback(() => setCount((n) => n + 1), []);

  return (
    <View className="flex-1 bg-surface-1">
      <StatusBar style="auto" />
      <ScrollView contentContainerClassName="gap-8 px-6 pb-16 pt-24">
        <View className="gap-1">
          <Text className="font-semibold text-2xl text-foreground">{TITLE}</Text>
          <Text className="text-muted-foreground text-sm">{pressedLabel(count)}</Text>
        </View>

        <ThemeSwitcher />

        <Row label="Variants">
          {VARIANTS.map((variant) => (
            <GlossyButton key={variant} variant={variant} onPress={bump}>
              {variant}
            </GlossyButton>
          ))}
        </Row>

        <Row label="Sizes">
          {SIZES.map((size) => (
            <GlossyButton key={size} size={size} onPress={bump}>
              {CONTINUE_LABEL}
            </GlossyButton>
          ))}
        </Row>

        <Row label="Shape / ripple">
          <GlossyButton shape="pill" onPress={bump}>
            {PILL_LABEL}
          </GlossyButton>
          <GlossyButton ripple={true} pressScale={0.97} onPress={bump}>
            {RIPPLE_LABEL}
          </GlossyButton>
        </Row>

        <Row label="States">
          <GlossyButton loading={true}>{LOADING_LABEL}</GlossyButton>
          <GlossyButton disabled={true}>{DISABLED_LABEL}</GlossyButton>
        </Row>
      </ScrollView>
    </View>
  );
}
