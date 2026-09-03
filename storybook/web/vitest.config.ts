import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  // Pre-transform the setup file and every story up front, while the Vite
  // server is still starting. Without this the browser's first burst of dynamic
  // `import()`s hits Vite's on-demand transform pipeline cold; on slow
  // filesystems (WSL2/CI) the `vite-plugin-rnw` babel transforms back up enough
  // that a module fetch is dropped — "Failed to fetch dynamically imported
  // module". Warming the graph removes the cold-start transform waterfall, so
  // the browser reads already-transformed modules instead of racing the
  // transformer. The setup file alone is not enough: the preview loads stories
  // through a dynamic glob, so warming each story is what pulls the component
  // graph through the transform cache ahead of time.
  //
  // Note: each story logs a non-fatal "Pre-transform error" here, because
  // @storybook/addon-vitest injects `@storybook/addon-vitest/internal/test-utils`
  // (a dep-optimizer virtual module) into every story, and that id only resolves
  // once the browser's real import phase runs. The warmup of the story's own
  // component graph still succeeds, so the transform cache is warm and the run
  // is unaffected — the errors are noise, not failures.
  server: {
    warmup: {
      clientFiles: ['./.storybook/vitest.setup.ts', '../../packages/ui/src/components/**/*.stories.tsx'],
    },
  },
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
    // Run story files one at a time. With every story file fetching modules from
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
