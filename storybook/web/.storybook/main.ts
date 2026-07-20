import type { StorybookConfig } from '@storybook/react-native-web-vite';
import tailwindcss from '@tailwindcss/vite';
import { uniwind } from 'uniwind/vite';
import type { PluginOption } from 'vite';

const config: StorybookConfig = {
  stories: ['../../../packages/ui/src/**/*.stories.@(ts|tsx)'],
  addons: ['@storybook/addon-docs', '@storybook/addon-vitest'],
  framework: {
    name: '@storybook/react-native-web-vite',
    // The framework runs `rnw` (vite-plugin-rnw) with `babelrc:false, configFile:false`,
    // so the root `babel.config.js` — and its `react-native-reanimated/plugin` — never
    // runs on the web build. Without the plugin, Reanimated can't transform worklets to
    // auto-detect their dependencies, so every `useAnimatedStyle`/`useDerivedValue` warns.
    // Feed the plugin to the rnw Babel pass so worklets get transformed here too.
    options: {
      pluginReactOptions: {
        babel: {
          plugins: ['react-native-reanimated/plugin'],
        },
      },
    },
  },
  // Uniwind resolves `className` on RN components at build time; it composes with
  // the framework's react-native-web aliasing. `@tailwindcss/vite` processes the
  // `@import 'tailwindcss'` in global.css.
  viteFinal: (viteConfig) => {
    viteConfig.plugins ??= [];
    // `@storybook/react-native-web-vite`'s preset injects `vite-tsconfig-paths`
    // into the plugin chain. On Vite 8 that plugin is redundant — Vite resolves
    // tsconfig paths natively — and its `resolve.alias { customResolver }` shim
    // is deprecated (removed in Vite 9). That alias is also part of the config
    // the dep-optimizer hashes, so it adds a variable to the cold-cache
    // re-optimization path where WSL2/CI races the browser's fetch of the setup
    // file ("Failed to fetch dynamically imported module …/vitest.setup.ts").
    // Drop the plugin and enable native resolution. This project uses no
    // tsconfig path aliases, so native resolution is a no-op today and stays
    // forward-compatible if any are added later.
    const flattenPlugins = (plugins: PluginOption[]): PluginOption[] =>
      plugins.flatMap((p) => {
        if (Array.isArray(p)) return flattenPlugins(p);
        return p ? [p] : [];
      });
    viteConfig.plugins = flattenPlugins(viteConfig.plugins).filter(
      (p) => !(typeof p === 'object' && p !== null && !Array.isArray(p) && p.name === 'vite-tsconfig-paths'),
    );
    viteConfig.resolve ??= {};
    viteConfig.resolve.tsconfigPaths = true;
    viteConfig.plugins.push(tailwindcss(), uniwind({ cssEntryFile: './global.css', dtsFile: './uniwind-types.d.ts' }));
    // Uniwind excludes `react-native` from dep optimization, which otherwise stops Vite
    // from pre-bundling react-native-web as a unit — leaving its CJS transitive dep
    // `@react-native/normalize-colors` served without a synthesized `default` export.
    // Force-optimize react-native-web so esbuild/rolldown inlines those CJS deps again.
    viteConfig.optimizeDeps ??= {};
    viteConfig.optimizeDeps.include = [
      ...(viteConfig.optimizeDeps.include ?? []),
      'react-native-web',
      // The setup file imports `setProjectAnnotations` from
      // `@storybook/react-native-web-vite` (its runtime entry re-exports
      // `@storybook/react` — no build-time vite plugins, so it bundles
      // cleanly). Pre-bundle it so the optimizer bundles the framework graph
      // in its initial pass instead of discovering it on-demand when the
      // browser loads the setup file — that on-demand discovery races the
      // setup-file fetch on a cold/re-optimizing cache.
      '@storybook/react-native-web-vite',
      // Pre-bundle addon-docs so Vite's dep-optimizer doesn't race with
      // Storybook's own cache writes. Without this, a cold or concurrent run
      // can fail with "Failed to fetch dynamically imported module …/
      // node_modules/.cache/storybook/…/@storybook_addon-docs…".
      '@storybook/addon-docs',
    ];
    viteConfig.plugins.push({
      name: 'debug-alias',
      enforce: 'post',
      config(resolved) {
        console.error('DEBUG_RESOLVED_ALIAS=' + JSON.stringify(resolved.resolve?.alias, (_k, v) => (typeof v === 'function' ? '[Function]' : v)));
      },
    });
    return viteConfig;
  },
};

export default config;
