// biome-ignore-all lint/style/noCommonJs: exception for metro config

const path = require('node:path');
const { withStorybook } = require('@storybook/react-native/metro/withStorybook');
const { getDefaultConfig } = require('expo/metro-config');
const { withUniwindConfig } = require('uniwind/metro');

// biome-ignore lint/correctness/noGlobalDirnameFilename: necessary for metro config
const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Monorepo: watch the whole workspace and resolve hoisted dependencies.
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [path.resolve(projectRoot, 'node_modules'), path.resolve(workspaceRoot, 'node_modules')];

// Uniwind rewrites `react-native` imports to className-aware components at bundle
// time. It must be the outermost Metro wrapper. `cssEntryFile` must stay a plain
// relative string (not path.resolve). The generated dtsFile is gitignored.
module.exports = withUniwindConfig(
  withStorybook(config, {
    enabled: true,
    configPath: path.resolve(projectRoot, '.rnstorybook'),
  }),
  {
    cssEntryFile: './global.css',
    dtsFile: './uniwind-types.d.ts',
  },
);
