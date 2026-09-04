import type { Preview } from '@storybook/react';
import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Switch } from 'rn-motion-ui/switch';
import { Uniwind } from 'uniwind';
import '../global.css';
import { GlobalErrorReporter, StoryErrorBoundary } from './error-reporter';

// Seed the theme at module scope, before the first story renders, so the very
// first paint is already light rather than whatever the simulator's OS is set
// to. Uniwind.setTheme() also pins hasAdaptiveThemes = false, which stops an OS
// dark preference from overriding the story's own toggle.
Uniwind.setTheme('light');

// Hoisted like App.tsx's labels so the string never lands as a JSX text literal.
const DARK_MODE_LABEL = 'Dark mode';

const preview: Preview = {
  decorators: [
    (Story) => {
      // Local state rather than an `args` control: the on-device Controls panel
      // is the wrong home for theme, so a dark-mode switch sits at the top of
      // every story's harness instead. It resets to light on each story mount,
      // matching the module-scope seed above.
      const [isDark, setIsDark] = useState(false);

      // In an effect, not in render: setTheme() calls UniwindListener.notify(),
      // which setStates every mounted className consumer. Doing that during
      // render tears down Storybook's in-flight render (the "cannot render when
      // not prepared" / "canvasElement is unset" rejections). setTheme is a
      // no-op when the theme already matches, so this only fires on a real
      // toggle.
      // biome-ignore lint/plugin: syncing an external non-React store (Uniwind's theme singleton, which notifies its own subscribers) to state is a genuine side effect — it must not run during render
      useEffect(() => {
        Uniwind.setTheme(isDark ? 'dark' : 'light');
      }, [isDark]);

      return (
        /* `flex-1` sits on a wrapper View, not the ScrollView itself: a native
           ScrollView reports its content size to Yoga, so `flex: 1` (flexBasis:
           0) directly on it can let it grow to its content height and stop
           scrolling. Bounding the wrapper first gives the ScrollView a definite
           height to scroll within — the same shape the demo app uses. */
        <View className="flex-1 bg-background">
          <ScrollView contentContainerClassName="items-start p-4" nestedScrollEnabled={true}>
            <View className="mb-4 self-start">
              <Switch label={DARK_MODE_LABEL} isSelected={isDark} onSelectedChange={setIsDark} />
            </View>
            {/* StoryErrorBoundary renders the real error + stack when a story
                crashes, so a white canvas explains itself on the device. */}
            <StoryErrorBoundary>
              <Story />
            </StoryErrorBoundary>
            {/* GlobalErrorReporter shows uncaught effect/async JS errors. */}
            <GlobalErrorReporter />
          </ScrollView>
        </View>
      );
    },
  ],
  parameters: {
    options: {
      // Explicit group order for the story list, matching the web sidebar:
      // `Buttons` sits first, ahead of `File System`. `*` keeps any future group
      // in alphabetical fallback.
      storySort: {
        order: [
          'Buttons',
          'Display',
          'File System',
          'Form',
          'Gestures',
          'Menus',
          'Navigation',
          'Rows',
          'Scroll',
          'Typography',
          '*',
        ],
      },
    },
  },
};

export default preview;
