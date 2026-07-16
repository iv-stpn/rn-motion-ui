import type { StorybookConfig } from '@storybook/react-native-web-vite';
import tailwindcss from '@tailwindcss/vite';
import { uniwind } from 'uniwind/vite';

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
    viteConfig.plugins.push(tailwindcss(), uniwind({ cssEntryFile: './global.css', dtsFile: './uniwind-types.d.ts' }));
    // Uniwind excludes `react-native` from dep optimization, which otherwise stops Vite
    // from pre-bundling react-native-web as a unit — leaving its CJS transitive dep
    // `@react-native/normalize-colors` served without a synthesized `default` export.
    // Force-optimize react-native-web so esbuild/rolldown inlines those CJS deps again.
    viteConfig.optimizeDeps ??= {};
    viteConfig.optimizeDeps.include = [...(viteConfig.optimizeDeps.include ?? []), 'react-native-web'];
    return viteConfig;
  },
};

export default config;
