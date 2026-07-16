import type { Preview } from '@storybook/react';
import { View } from 'react-native';
import '../global.css';

const preview: Preview = {
  decorators: [
    (Story) => (
      <View className="flex-1 items-start p-4">
        <Story />
      </View>
    ),
  ],
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
