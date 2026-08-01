import { StatusBar } from 'expo-status-bar';
import { ScrollView, Text, View } from 'react-native';
import { GlossyButton } from 'rn-motion-ui/glossy-button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from 'rn-motion-ui/tabs';
import { type ThemeName, Uniwind, useUniwind } from 'uniwind';
import { Row } from './demos/demo-chrome';
import { FileSystemDemo } from './demos/file-system-demo';
import { GlossyButtonDemo } from './demos/glossy-button-demo';
import './global.css';

const THEMES = ['light', 'dark'] as const satisfies readonly ThemeName[];

// Handlers hoisted to module scope so each button gets a stable onPress
// reference (no closure recreated per render, nothing to memoize).
const SET_THEME: Record<(typeof THEMES)[number], () => void> = {
  light: () => Uniwind.setTheme('light'),
  dark: () => Uniwind.setTheme('dark'),
};

// Hoisted so no bare string literals land in JSX (the repo's noJsxLiterals rule).
const TITLE = 'rn-motion-ui';
const SUBTITLE = 'Three components, one Expo app — web and native off the same source.';
const THEME_LABEL = 'Theme';
const THEME_LABELS = { light: 'Light', dark: 'Dark' } as const;

/** One tab per component. `value` also names the panel it shows. */
const TABS = [
  { value: 'button', label: 'GlossyButton' },
  { value: 'file-system', label: 'FileSystem' },
] as const;

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
  return (
    <View className="flex-1 bg-surface-1">
      <StatusBar style="auto" />
      <ScrollView contentContainerClassName="gap-8 px-6 pb-16 pt-24">
        <View className="gap-1">
          <Text className="font-semibold text-2xl text-foreground">{TITLE}</Text>
          <Text className="text-muted-foreground text-sm">{SUBTITLE}</Text>
        </View>

        <ThemeSwitcher />

        {/* The tab panels are unmounted while hidden, so each component starts
            fresh on a switch — a FileSystem manifest rewritten by a drop resets
            when you come back to it. */}
        <Tabs defaultValue="button" variant="segment">
          <TabsList>
            {TABS.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value="button">
            <GlossyButtonDemo />
          </TabsContent>
          <TabsContent value="file-system">
            <FileSystemDemo />
          </TabsContent>
        </Tabs>
      </ScrollView>
    </View>
  );
}
