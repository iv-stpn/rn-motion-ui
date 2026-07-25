/** biome-ignore-all lint/style/useExportsLast: exports and defines multiple utils */
// One rendered tree row: indent guides, disclosure chevron, file/folder icon,
// a middle-truncated label (or inline rename input), and an optional git-status
// letter. Presentational — all state lives in the controller; interactions are
// forwarded to the handlers from useSyncedFileTree via the callback props.

import React, { type ReactNode, useCallback, useRef, useState } from 'react';
import { type GestureResponderEvent, Pressable, TextInput, View } from 'react-native';
import { cn } from '../../lib/cn';
import { ChevronRight } from '../../lib/icons';
import { MotiView } from '../../moti/components/view';
import { Text } from '../Text/text';
import type { FileTreeGitStatusCode, FileTreeVisibleRow } from './file-tree.types';
import type { ClickModifiers } from './file-tree-click-plan';
import { type FileTreeDensityMetrics, indentForLevel } from './file-tree-density';
import { gitStatusPresentation } from './file-tree-git';
import { resolveFileTreeIcon } from './file-tree-icon';
import { FileTreeIcon } from './file-tree-icons';
import { splitForMiddleTruncation } from './file-tree-truncate';
import { webRowIdentity } from './file-tree-web-dom';

const CHEVRON_TRANSITION = { type: 'timing', duration: 140 } as const;
const SELECT_TRANSITION = { type: 'spring', stiffness: 300, damping: 30 } as const;
const NO_MOTION = { type: 'timing', duration: 0 } as const;
const LONG_PRESS_DELAY = 300;

/** Theme colors resolved once by the parent and shared across every row. */
export type FileTreeRowColors = { icon: string; folder: string; chevron: string; placeholder: string };

/** Git-status token → the static text-color class the letter renders in. */
const GIT_TEXT_CLASS: Record<string, string> = {
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
  info: 'text-info',
};

export type FileTreeRowProps = {
  row: FileTreeVisibleRow;
  metrics: FileTreeDensityMetrics;
  colors: FileTreeRowColors;
  gitCode: FileTreeGitStatusCode | null;
  /** Explicitly git-ignored (`null` in the git map) — rendered dimmed. */
  dimmed: boolean;
  showIcons: boolean;
  showIndentGuides: boolean;
  reduce: boolean;
  /** This row is the inline-rename target: swap the label for a TextInput. */
  renaming: boolean;
  /** This row is the current drop target during a drag. */
  dropTarget: boolean;
  /** This row is being dragged (dimmed while it floats under the finger). */
  dragging: boolean;
  rowClassName?: string;
  testID?: string;
  onActivate: (row: FileTreeVisibleRow, modifiers: ClickModifiers, x?: number, y?: number) => void;
  onToggleExpand: (path: string) => void;
  onLongPress: (row: FileTreeVisibleRow, x?: number, y?: number) => void;
  onRenameSubmit: (path: string, nextName: string) => void;
  onRenameCancel: () => void;
};

/** Read web pointer modifiers off a press event; all undefined on native. */
function readModifiers(event: GestureResponderEvent): ClickModifiers {
  // biome-ignore lint/plugin: RNW forwards DOM modifier keys on nativeEvent; RN's types omit them, so a cast is the documented way to read them.
  const native = event.nativeEvent as unknown as {
    ctrlKey?: boolean;
    metaKey?: boolean;
    shiftKey?: boolean;
    button?: number;
  };
  return {
    ctrl: Boolean(native.ctrlKey),
    meta: Boolean(native.metaKey),
    shift: Boolean(native.shiftKey),
    secondary: native.button === 2,
  };
}

// ─── Indent guides ──────────────────────────────────────────────────────────
// Vertical hairlines, one per ancestor level, centred under each parent's
// chevron column. Non-interactive; sits behind the content row.

type IndentGuidesProps = { level: number; metrics: FileTreeDensityMetrics };

function IndentGuides({ level, metrics }: IndentGuidesProps) {
  if (level <= 0) return null;
  const half = metrics.chevronSize / 2;
  const guides: ReactNode[] = [];
  for (let i = 0; i < level; i += 1) {
    const left = i * metrics.indentPerLevel + half;
    guides.push(<View key={i} className="absolute top-0 bottom-0 w-px bg-border" style={{ left }} pointerEvents="none" />);
  }
  return <>{guides}</>;
}

// ─── Disclosure chevron ─────────────────────────────────────────────────────
// Its own press target (pure expansion toggle) so tapping it never runs the
// selection plan. Leaf rows render an equal-width spacer to keep icons aligned.

type RowChevronProps = {
  row: FileTreeVisibleRow;
  metrics: FileTreeDensityMetrics;
  color: string;
  reduce: boolean;
  onToggleExpand: (path: string) => void;
};

function RowChevron({ row, metrics, color, reduce, onToggleExpand }: RowChevronProps) {
  const handlePress = useCallback(() => onToggleExpand(row.path), [onToggleExpand, row.path]);
  if (!row.hasChildren) return <View style={{ width: metrics.chevronSize }} pointerEvents="none" />;
  return (
    <Pressable
      onPress={handlePress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={`${row.isExpanded ? 'Collapse' : 'Expand'} ${row.name}`}
      style={{ width: metrics.chevronSize, height: metrics.chevronSize, alignItems: 'center', justifyContent: 'center' }}
    >
      <MotiView animate={{ rotate: row.isExpanded ? '90deg' : '0deg' }} transition={reduce ? NO_MOTION : CHEVRON_TRANSITION}>
        <ChevronRight size={metrics.chevronSize} color={color} strokeWidth={2} />
      </MotiView>
    </Pressable>
  );
}

// ─── Row label ──────────────────────────────────────────────────────────────
// Middle truncation: the head shrinks + ellipsizes while the tail (always ≥ the
// extension) stays pinned, so the file extension never clips off the right edge.

type RowLabelProps = { name: string; fontSize: number };

function RowLabel({ name, fontSize }: RowLabelProps) {
  const { head, tail } = splitForMiddleTruncation(name);
  if (!tail)
    return (
      <Text numberOfLines={1} ellipsizeMode="tail" className="min-w-0 flex-1 text-foreground" style={{ fontSize }}>
        {name}
      </Text>
    );
  return (
    <View className="min-w-0 flex-1 flex-row items-center">
      <Text numberOfLines={1} ellipsizeMode="tail" className="shrink text-foreground" style={{ fontSize }}>
        {head}
      </Text>
      <Text numberOfLines={1} className="shrink-0 text-foreground" style={{ fontSize }}>
        {tail}
      </Text>
    </View>
  );
}

// ─── Git-status letter ────────────────────────────────────────────────────────
// The single lane letter (A/M/R/D/U) tinted by its status token. Rendered only
// for a changed, non-ignored row (the caller gates on `gitCode && !dimmed`).

type RowGitLetterProps = { code: FileTreeGitStatusCode; fontSize: number };

function RowGitLetter({ code, fontSize }: RowGitLetterProps) {
  const { letter, token, label } = gitStatusPresentation(code);
  return (
    <Text
      weight="semibold"
      accessibilityLabel={label}
      className={cn('shrink-0 text-center', GIT_TEXT_CLASS[token] ?? 'text-muted-foreground')}
      style={{ fontSize, width: fontSize + 4 }}
    >
      {letter}
    </Text>
  );
}

// ─── Inline rename input ──────────────────────────────────────────────────────
// Replaces the label while a row is being renamed. Commits on Enter/blur, cancels
// on Escape. A `done` ref guards the blur that Escape triggers from re-committing.

type RowRenameInputProps = {
  initialName: string;
  fontSize: number;
  placeholderColor: string;
  onSubmit: (nextName: string) => void;
  onCancel: () => void;
};

/** Minimal shape of the key-press event we read (RN + RNW both provide `key`). */
type KeyPressEvent = { nativeEvent: { key: string } };

function RowRenameInput({ initialName, fontSize, placeholderColor, onSubmit, onCancel }: RowRenameInputProps) {
  const [draft, setDraft] = useState(initialName);
  const done = useRef(false);
  const submit = useCallback(() => {
    if (done.current) return;
    done.current = true;
    onSubmit(draft);
  }, [draft, onSubmit]);
  const cancel = useCallback(() => {
    if (done.current) return;
    done.current = true;
    onCancel();
  }, [onCancel]);
  const handleKeyPress = useCallback((e: KeyPressEvent) => e.nativeEvent.key === 'Escape' && cancel(), [cancel]);

  return (
    <TextInput
      value={draft}
      onChangeText={setDraft}
      onSubmitEditing={submit}
      onBlur={submit}
      onKeyPress={handleKeyPress}
      autoFocus={true}
      selectTextOnFocus={true}
      autoCapitalize="none"
      autoCorrect={false}
      spellCheck={false}
      blurOnSubmit={true}
      placeholder={initialName}
      placeholderTextColor={placeholderColor}
      className="min-w-0 flex-1 rounded-sm bg-surface-3 px-1 py-0 text-foreground"
      style={{ fontSize }}
      accessibilityLabel={`Rename ${initialName}`}
    />
  );
}

// ─── Selection / focus / drop overlays ────────────────────────────────────────
// Absolute layers that fill the row. Selection fades via Moti; the focus ring and
// drop-target border sit on top, non-interactive, so they never block presses.

type RowOverlaysProps = { selected: boolean; focused: boolean; dropTarget: boolean; reduce: boolean };

function RowOverlays({ selected, focused, dropTarget, reduce }: RowOverlaysProps) {
  return (
    <>
      <MotiView
        animate={{ opacity: selected ? 1 : 0 }}
        transition={reduce ? NO_MOTION : SELECT_TRANSITION}
        className="absolute inset-0 bg-surface-selected"
        style={{ pointerEvents: 'none' }}
      />
      {focused ? <View className="absolute inset-0 rounded-sm border border-primary" pointerEvents="none" /> : null}
      {dropTarget ? <View className="absolute inset-0 rounded-sm border-2 border-primary" pointerEvents="none" /> : null}
    </>
  );
}

// ─── The row ──────────────────────────────────────────────────────────────────
// Ties the pieces together: absolute overlays, then a content Pressable whose left
// padding encodes the indent. Chevron is a sibling press target (pure disclosure);
// the body forwards taps/long-presses (with web modifiers) to the controller.

function FileTreeRowImpl(props: FileTreeRowProps) {
  const { row, metrics, colors, gitCode, dimmed, showIcons, showIndentGuides, reduce, renaming } = props;
  const { dropTarget, dragging, rowClassName, testID } = props;
  const { onActivate, onToggleExpand, onLongPress, onRenameSubmit, onRenameCancel } = props;

  const handlePress = useCallback(
    (event: GestureResponderEvent) => {
      const { pageX, pageY } = event.nativeEvent;
      onActivate(row, readModifiers(event), pageX, pageY);
    },
    [onActivate, row],
  );
  const handleLongPress = useCallback(
    (event: GestureResponderEvent) => {
      const { pageX, pageY } = event.nativeEvent;
      onLongPress(row, pageX, pageY);
    },
    [onLongPress, row],
  );
  const handleRenameSubmit = useCallback((next: string) => onRenameSubmit(row.path, next), [onRenameSubmit, row.path]);

  const iconColor = row.kind === 'directory' ? colors.folder : colors.icon;
  const contentOpacity = dimmed || dragging ? 0.45 : 1;

  return (
    <View
      role="treeitem"
      accessibilityState={{ expanded: row.hasChildren ? row.isExpanded : undefined, selected: row.isSelected }}
      accessibilityLabel={row.name}
      testID={testID}
      className={cn('relative flex-row items-stretch overflow-hidden', rowClassName)}
      style={{ height: metrics.itemHeight }}
      {...webRowIdentity(row.path)}
    >
      <RowOverlays selected={row.isSelected} focused={row.isFocused} dropTarget={dropTarget} reduce={reduce} />
      {showIndentGuides ? <IndentGuides level={row.level} metrics={metrics} /> : null}
      <Pressable
        onPress={renaming ? undefined : handlePress}
        onLongPress={renaming ? undefined : handleLongPress}
        delayLongPress={LONG_PRESS_DELAY}
        className="min-w-0 flex-1 flex-row items-center pr-2"
        style={{ paddingLeft: indentForLevel(row.level, metrics), columnGap: metrics.gap, opacity: contentOpacity }}
      >
        <RowChevron row={row} metrics={metrics} color={colors.chevron} reduce={reduce} onToggleExpand={onToggleExpand} />
        {showIcons ? <FileTreeIcon name={resolveFileTreeIcon(row.path)} size={metrics.iconSize} color={iconColor} /> : null}
        {renaming ? (
          <RowRenameInput
            initialName={row.name}
            fontSize={metrics.fontSize}
            placeholderColor={colors.placeholder}
            onSubmit={handleRenameSubmit}
            onCancel={onRenameCancel}
          />
        ) : (
          <>
            <RowLabel name={row.name} fontSize={metrics.fontSize} />
            {gitCode && !dimmed ? <RowGitLetter code={gitCode} fontSize={metrics.statusFontSize} /> : null}
          </>
        )}
      </Pressable>
    </View>
  );
}

/** One virtualized FileTree row. Memoized — re-renders only when its props change. */
export const FileTreeRow = React.memo(FileTreeRowImpl);
