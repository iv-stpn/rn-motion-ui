import { useCallback, useState } from 'react';
import type { FileTreeGitStatusMap, FileTreeMoveEvent, FileTreeRenameEvent } from 'rn-motion-ui/file-tree';
import { FileTree } from 'rn-motion-ui/file-tree';
import { Caption, Panel } from './demo-chrome';

// A small, deterministic tree. Top-level directories sort before the root files,
// and every directory holds more than one child, so flattening single-child
// chains never collapses one unexpectedly.
const SAMPLE_PATHS = [
  'src/app/index.tsx',
  'src/app/router.tsx',
  'src/app/screens/home.tsx',
  'src/app/screens/profile.tsx',
  'src/components/button.tsx',
  'src/components/card.tsx',
  'src/hooks/use-theme.ts',
  'src/hooks/use-store.ts',
  'src/lib/format.ts',
  'src/lib/parse.ts',
  'src/index.ts',
  'docs/guide.md',
  'docs/api.md',
  'package.json',
  'README.md',
  'tsconfig.json',
];

// Per-path git status. `null` marks an ignored path (dimmed, no lane letter);
// directory rollups — `src/` showing the strongest status beneath it — are
// derived by the tree itself.
const SAMPLE_GIT_STATUS: FileTreeGitStatusMap = {
  'src/app/index.tsx': 'M',
  'src/app/router.tsx': 'A',
  'src/components/button.tsx': 'M',
  'src/hooks/use-store.ts': 'D',
  'src/lib/format.ts': null,
  'README.md': 'M',
};

const HINT =
  'Type to filter, tap a row to select (⌘/shift for more), and drag one onto a folder to move it — hold first on touch, so the same downstroke can still scroll. Double-click a name to rename it.';
const IDLE_NOTE = 'No selection yet.';
const EMPTY_LABEL = 'No files yet';
const TREE_HEIGHT = 380;

/**
 * The path-first source tree. Unlike <FileSystem>, this one owns its paths: a
 * move or a rename is committed inside the tree and reported afterwards, so the
 * demo only has to read the events back.
 */
export function FileTreeDemo() {
  const [note, setNote] = useState(IDLE_NOTE);

  const handleSelection = useCallback((paths: string[]) => {
    setNote(paths.length > 0 ? `Selected: ${paths.join(', ')}` : IDLE_NOTE);
  }, []);
  const handleMove = useCallback((event: FileTreeMoveEvent) => {
    setNote(`Moved ${event.sources.join(', ')} → ${event.destination || '(root)'}`);
  }, []);
  const handleRename = useCallback((event: FileTreeRenameEvent) => {
    setNote(`Renamed ${event.path} → ${event.newPath}`);
  }, []);

  return (
    <Panel>
      <Caption>{HINT}</Caption>
      <FileTree
        draggable={true}
        emptyState={EMPTY_LABEL}
        gitStatus={SAMPLE_GIT_STATUS}
        height={TREE_HEIGHT}
        initialExpansion={1}
        onMove={handleMove}
        onRename={handleRename}
        onSelectionChange={handleSelection}
        paths={SAMPLE_PATHS}
        renamable={true}
        selectionMode="multiple"
        showSearch={true}
      />
      <Caption emphasis={note !== IDLE_NOTE}>{note}</Caption>
    </Panel>
  );
}
