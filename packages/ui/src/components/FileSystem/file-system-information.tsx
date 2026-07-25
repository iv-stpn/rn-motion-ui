// The metadata block under a file preview: created/modified timestamps plus
// size for files or a child count for folders. Rows a manifest doesn't carry
// are skipped, and the block disappears entirely when nothing is known.

import { View } from 'react-native';
import { Text } from '../Text/text';
import type { FileSystemEntry, FileSystemIndex } from './file-system.types';
import { formatByteSize, formatTimestamp } from './file-system-format';

const INFORMATION_LABEL = 'Information';
const CREATED_LABEL = 'Created';
const MODIFIED_LABEL = 'Modified';
const SIZE_LABEL = 'Size';
const ITEMS_LABEL = 'Items';

type InformationRow = { label: string; value: string };

function entryInformationRows(entry: FileSystemEntry, index: FileSystemIndex): InformationRow[] {
  const rows: InformationRow[] = [];
  const created = formatTimestamp(entry.createdAt);
  const updated = formatTimestamp(entry.updatedAt);

  if (created) rows.push({ label: CREATED_LABEL, value: created });
  if (updated) rows.push({ label: MODIFIED_LABEL, value: updated });

  if (entry.kind === 'file') {
    const size = formatByteSize(entry.size);
    if (size) rows.push({ label: SIZE_LABEL, value: size });
    return rows;
  }

  const childCount = index.children.get(entry.path)?.length;
  if (childCount !== undefined) rows.push({ label: ITEMS_LABEL, value: String(childCount) });
  return rows;
}

export type FileSystemInformationProps = { entry: FileSystemEntry; index: FileSystemIndex };

/** Label/value metadata rows for an entry, or nothing when there are none. */
export function FileSystemInformation({ entry, index }: FileSystemInformationProps) {
  const rows = entryInformationRows(entry, index);
  if (rows.length === 0) return null;

  return (
    <View className="border-border border-t pt-3">
      <Text className="mb-1.5" size="xs" weight="semibold">
        {INFORMATION_LABEL}
      </Text>
      <View className="gap-1">
        {rows.map((row) => (
          <View className="flex-row items-baseline justify-between gap-3" key={row.label}>
            <Text className="shrink-0 text-muted-foreground" size="xs">
              {row.label}
            </Text>
            <Text className="flex-1 text-right" size="xs">
              {row.value}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
