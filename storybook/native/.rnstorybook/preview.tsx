import type { Preview } from '@storybook/react';
import { Appearance, ScrollView } from 'react-native';
import '../global.css';

const preview: Preview = {
  decorators: [
    (Story, context) => {
      // Set the RN Appearance scheme synchronously before the story renders so
      // every useColorScheme() caller (NativeWind dark: classes, useThemeColor,
      // etc.) already sees the right scheme on the first paint.
      Appearance.setColorScheme(context.args.darkMode ? 'dark' : 'light');

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
