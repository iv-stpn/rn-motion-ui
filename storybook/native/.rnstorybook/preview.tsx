import type { Preview } from '@storybook/react';
import { useEffect } from 'react';
import { ScrollView } from 'react-native';
import { Uniwind } from 'uniwind';
import '../global.css';

// Seed the theme at module scope, before the first story renders, so the very
// first paint is already light rather than whatever the simulator's OS is set
// to. Uniwind.setTheme() also pins hasAdaptiveThemes = false, which stops an OS
// dark preference from overriding the story's own toggle.
Uniwind.setTheme('light');

const preview: Preview = {
  decorators: [
    (Story, context) => {
      const isDark = Boolean(context.args.darkMode);

      // In an effect, not in render: setTheme() calls UniwindListener.notify(),
      // which setStates every mounted className consumer. Doing that during
      // render tears down Storybook's in-flight render (the "cannot render when
      // not prepared" / "canvasElement is unset" rejections). setTheme is a
      // no-op when the theme already matches, so this only fires on a real
      // toggle.
      // biome-ignore lint/plugin: syncing an external non-React store (Uniwind's theme singleton, which notifies its own subscribers) to an arg is a genuine side effect — it must not run during render
      useEffect(() => {
        Uniwind.setTheme(isDark ? 'dark' : 'light');
      }, [isDark]);

      return (
        <ScrollView className="flex-1" contentContainerClassName="items-start p-4">
          <Story />
        </ScrollView>
      );
    },
  ],
  // Adds a "Dark Mode" boolean toggle to the Controls panel of every story.
  args: {
    darkMode: false,
  },
  argTypes: {
    darkMode: {
      name: 'Dark Mode',
      control: { type: 'boolean' },
    },
  },
  parameters: {
    backgrounds: {
      default: 'plain',
      values: [
        { name: 'plain', value: '#ffffff' },
        { name: 'dark', value: '#151515' },
      ],
    },
  },
};

export default preview;
