import type { Decorator } from '@storybook/react';
import { View } from 'react-native';
import { fn } from 'storybook/test';
import { loadArchiveChildren, loadPreviewImageUrl, SAMPLE_ITEMS } from './file-system-story-data';

// ─── Shared meta pieces ──────────────────────────────────────────────────────
// Storybook's static CSF indexer reads each story file's default export from a
// literal `meta` object *in that file* — it cannot follow `import meta` across
// files. So the reusable pieces live here and each story file spreads them into
// its own local `meta` literal:
//
// - the 880px decorator (above the tablet breakpoint; search/sort/filter/view
//   switching are not in the header — they live in the headless `renderFilters`
//   and `renderHeader` slots, so the stories that drive them pass their own bars)
// - the default args every story inherits.

const widthDecorator: Decorator = (Story) => (
  <View className="w-[880px] max-w-full">
    <Story />
  </View>
);

const FILE_SYSTEM_DECORATORS = [widthDecorator];

const FILE_SYSTEM_ARGS = {
  items: SAMPLE_ITEMS,
  title: 'Files',
  height: 460,
  loadChildren: fn(loadArchiveChildren),
  loadPreviewImageUrl,
  onSelectionChange: fn(),
  onViewChange: fn(),
};

export { FILE_SYSTEM_ARGS, FILE_SYSTEM_DECORATORS };
