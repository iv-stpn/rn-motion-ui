/** biome-ignore-all lint/style/useExportsLast: props types sit with their components */
// The `FileSystemViewProps` contract every view receives now lives in
// `types/file-system.types.ts` so it stays RN-free (vitest can import it); this
// module re-exports it and holds the empty/loading placeholder the views share.

import { View } from 'react-native';
import { Loader } from '../../../display/Loader/loader';
import { Text } from '../../../typography/Text/text';

export type { FileSystemViewProps } from '../types/file-system.types';

export type FileSystemEmptyStateProps = { isLoading?: boolean; label: string };

/** Fills the file area when there is nothing to show, or nothing yet. */
export function FileSystemEmptyState({ isLoading = false, label }: FileSystemEmptyStateProps) {
  return (
    <View className="size-full flex-1 items-center justify-center gap-2">
      {isLoading ? <Loader size={20} variant="spinner" /> : null}
      <Text className="text-muted-foreground" size="sm">
        {label}
      </Text>
    </View>
  );
}
