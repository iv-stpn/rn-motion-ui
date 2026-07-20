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
    // Reuse a single browser page across files instead of recreating the
    // context per file. On WSL2 the per-file context teardown/recreate races
    // the orchestrator's iframe reconnect, dropping ~1 random file's dynamic
    // import per run ("Cannot connect to the iframe … CORS"). Sharing the
    // page removes that churn; stories still isolate in Storybook's own
    // canvas iframe, so cross-file bleed isn't a concern.
    isolate: false,
    setupFiles: ['./.storybook/vitest.setup.ts'],
  },
});
