/** biome-ignore-all lint/style/useExportsLast: props type sits with its component */
// The built-in search field rendered above the tree when `showSearch` is set.
// A leading magnifier, a controlled TextInput, and a trailing clear button that
// appears once there's a query. Presentational — the query lives in the
// controller; edits are forwarded up via `onChangeQuery`.

import React, { useCallback } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { Search, X } from '../../lib/icons';
import { useThemeColor } from '../../theme/use-theme-color';

export type FileTreeSearchInputProps = {
  query: string;
  onChangeQuery: (query: string) => void;
  placeholder?: string;
  testID?: string;
};

function FileTreeSearchInputImpl({ query, onChangeQuery, placeholder = 'Search files', testID }: FileTreeSearchInputProps) {
  const mutedForeground = useThemeColor('muted-foreground');
  const clear = useCallback(() => onChangeQuery(''), [onChangeQuery]);

  return (
    <View className="flex-row items-center gap-2 border-border border-b px-3" style={{ height: 40 }}>
      <Search size={16} color={mutedForeground} />
      <TextInput
        value={query}
        onChangeText={onChangeQuery}
        placeholder={placeholder}
        placeholderTextColor={mutedForeground}
        accessibilityLabel={placeholder}
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        className="h-full min-w-0 flex-1 text-foreground text-sm"
        testID={testID ? `${testID}-search` : undefined}
      />
      {query.length > 0 ? (
        <Pressable onPress={clear} hitSlop={8} accessibilityRole="button" accessibilityLabel="Clear search" className="shrink-0">
          <X size={16} color={mutedForeground} />
        </Pressable>
      ) : null}
    </View>
  );
}

/** Search field for `<FileTree showSearch>`. Memoized — driven only by its props. */
export const FileTreeSearchInput = React.memo(FileTreeSearchInputImpl);
