/** biome-ignore-all lint/style/useExportsLast: props types sit with their components */
// Small toolbar primitives shared by the header and the status bar: the ghost
// icon button. Search and the view switcher are now fully headless — consumers
// supply their own input via the `renderFilters` and `renderHeader` slots.

import { type ReactNode, useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';
import { cn } from '../../../../lib/cn';
import { Text } from '../../../typography/Text/text';
import {
  useFileSystemConsumer,
  useFileSystemEntries,
  useFileSystemSearch,
  useFileSystemSelection,
  useFileSystemSelectionActions,
} from '../store/file-system-context';

/** Width band the header lays itself out for. */
export type HeaderLayout = 'full' | 'compact' | 'minimal';

export type ToolbarIconButtonProps = {
  accessibilityLabel: string;
  onPress: () => void;
  children: ReactNode;
  disabled?: boolean;
  /** Draws the primary dot marker in the top-right (an active filter/query). */
  marked?: boolean;
  className?: string;
};

/** 28px ghost square used by every toolbar affordance. */
export function ToolbarIconButton({
  accessibilityLabel,
  children,
  className,
  disabled,
  marked,
  onPress,
}: ToolbarIconButtonProps) {
  const [hovered, setHovered] = useState(false);
  const handleHoverIn = useCallback(() => setHovered(true), []);
  const handleHoverOut = useCallback(() => setHovered(false), []);
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      onHoverIn={handleHoverIn}
      onHoverOut={handleHoverOut}
      onPress={onPress}
      className={cn(
        'relative size-7 shrink-0 items-center justify-center rounded-md',
        hovered && !disabled && 'bg-surface-hover',
        disabled && 'opacity-40',
        className,
      )}
    >
      {children}
      {marked ? <View className="absolute top-1 right-1 size-1.5 rounded-full bg-primary" /> : null}
    </Pressable>
  );
}

const COUNT_NOUNS = { result: { one: 'result', other: 'results' }, row: { one: 'item', other: 'items' } };
const CLEAR_SELECTION_LABEL = 'Clear selection';
const CLEAR_SELECTION_TEXT = 'Clear';

/**
 * What the status bar says about the selection: the name while it is one entry,
 * a count once it is more. A name per entry would not fit, and the count is what
 * a multi-selection is actually about.
 */
function selectionLabel(selectedCount: number, selectedName: string | undefined): string | null {
  if (selectedCount > 1) return `· ${selectedCount} selected`;
  return selectedName ? `· “${selectedName}” selected` : null;
}

type FileSystemStatusBarProps = { className?: string };

/** Status-bar text: item/result count plus the current selection. */
export function FileSystemStatusBar({ className }: FileSystemStatusBarProps) {
  const { entries } = useFileSystemEntries();
  const { isSearching } = useFileSystemSearch();
  const { selectedEntry, selectedPaths } = useFileSystemSelection();
  const { clearSelection } = useFileSystemSelectionActions();
  const { testID } = useFileSystemConsumer();
  const count = entries.length;
  const selectedCount = selectedPaths.size;
  const footerTestID = testID ? `${testID}-footer` : undefined;
  const nouns = isSearching ? COUNT_NOUNS.result : COUNT_NOUNS.row;
  const noun = count === 1 ? nouns.one : nouns.other;
  const selection = selectionLabel(selectedCount, selectedEntry?.name);
  return (
    <View
      accessibilityLiveRegion="polite"
      className={cn(
        'h-7 shrink-0 flex-row items-center justify-center gap-1 border-border border-t bg-surface-2 px-3',
        className,
      )}
      testID={footerTestID}
    >
      <Text size="xs" className="text-muted-foreground">
        {`${count} ${noun}`}
      </Text>
      {selection ? (
        <Text size="xs" numberOfLines={1} className="text-muted-foreground">
          {selection}
        </Text>
      ) : null}
      {/* The way out of a multi-selection on touch, where there may be no
          background left to tap: the columns and gallery views fill their area,
          so tapping "nothing" is not always available. */}
      {selectedCount > 1 ? (
        <Pressable
          accessibilityLabel={CLEAR_SELECTION_LABEL}
          accessibilityRole="button"
          className="ml-1 rounded-sm px-1 py-0.5"
          onPress={clearSelection}
        >
          <Text size="xs" className="text-muted-foreground underline">
            {CLEAR_SELECTION_TEXT}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
