import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    // Turns every story into a vitest test; stories with a `play` function
    // are executed and asserted in a real browser.
    storybookTest({ configDir: path.join(dirname, '.storybook') }),
  ],
  test: {
    name: 'storybook',
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      instances: [{ browser: 'chromium' }],
    },
    // Run story files one at a time. With 45 files fetching modules from
    // Vite's on-demand transform pipeline concurrently, slower environments
    // (WSL2/CI) hit "Failed to fetch dynamically imported module" races as
    // the dep-optimizer and first-time transforms contend. Sequential runs
    // trade some speed for reliability.
    fileParallelism: false,
    setupFiles: ['./.storybook/vitest.setup.ts'],
  },
});
