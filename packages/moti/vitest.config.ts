import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/__tests__/setup.ts'],
    include: ['src/__tests__/**/*.test.ts', 'src/__tests__/**/*.test.tsx'],
  },
  resolve: {
    alias: {
      'react-native-reanimated': path.resolve(__dirname, './src/__tests__/mocks/reanimated.ts'),
      'react-native-worklets': path.resolve(__dirname, './src/__tests__/mocks/worklets.ts'),
      '@rn-motion-ui/utils/typeguards': path.resolve(__dirname, '../utils/src/typeguards.ts'),
    },
  },
});
