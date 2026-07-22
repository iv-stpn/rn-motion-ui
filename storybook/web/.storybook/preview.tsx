import { withThemeByClassName } from '@storybook/addon-themes';
import type { Decorator, Preview } from '@storybook/react';
import { View } from 'react-native';
import { useGlobals } from 'storybook/preview-api';
import '../global.css';

// Toggle the `.light` / `.dark` classes on <html> from the
// @storybook/addon-themes toolbar. This replaces storybook-dark-mode. Both
// classes are applied explicitly so the toolbar is an ABSOLUTE override of the
// OS prefers-color-scheme: tokens.css gates its @media (prefers-color-scheme:
// dark) block on `:root:not(.light)`, so `.light` opts out of automatic dark
// (falling back to the light defaults) even when the OS is dark, and `.dark`
// forces dark over an OS-light preference. Mapping light to a real `.light`
// class — rather than '' — is what makes the light selection authoritative;
// with no class, the @media block would keep the tokens dark under a dark OS.
//
// Wrap every story in a surface-coloured background that tracks the theme
// toolbar. The View fills the Storybook canvas so the story content sits on the
// correct theme surface instead of the default white/transparent backdrop.
// globals.theme is read directly (rather than useThemeColor, which reads the CSS
// var via getComputedStyle during render and would lag one frame behind the
// class-swap effect) so the backdrop flips in the same render as the toggle.
// Surface hex values mirror tokens.css / use-theme-color.ts (light: #fafafa ≈
// oklch(99% 0 0), dark: #111111 ≈ oklch(9% 0 0)).
// biome-ignore lint/style/useComponentExportOnlyModules: Storybook decorator — internal to preview.tsx, not a public component
const ThemeDecorator: Decorator = (Story) => {
  const [globals] = useGlobals();
  const isDark = globals.theme === 'dark';
  return (
    <View style={{ flex: 1, backgroundColor: isDark ? '#111111' : '#fafafa', padding: 24 }}>
      <Story />
    </View>
  );
};

const preview: Preview = {
  decorators: [
    withThemeByClassName({
      themes: { light: 'light', dark: 'dark' },
      defaultTheme: 'light',
      parentSelector: 'html',
    }),
    ThemeDecorator,
  ],
  parameters: {
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },
  },
};

export default preview;
