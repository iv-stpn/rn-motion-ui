import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/moti/__tests__/setup.ts'],
    include: ['src/moti/__tests__/**/*.test.ts', 'src/moti/__tests__/**/*.test.tsx'],
  },
  resolve: {
    alias: {
      'react-native-reanimated': path.resolve(__dirname, './src/moti/__tests__/mocks/reanimated.ts'),
      'react-native-worklets': path.resolve(__dirname, './src/moti/__tests__/mocks/worklets.ts'),
    },
  },
});
