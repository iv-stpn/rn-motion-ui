// Breadcrumb trail between the header and the file area. Each segment
// corresponds to a folder on the path to the current location; clicking it
// navigates there. The last segment (the current folder) is non-interactive.
// Hidden at the root — there is nothing to trail back to.

import { useCallback } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { ChevronRight } from '../../../lib/icons';
import { getPathParts } from '../../../lib/path';
import { useThemeColors } from '../../../theme/use-theme-color';
import { Text } from '../../typography/Text/text';
import { useFileSystemConsumer, useFileSystemNavigation, useFileSystemNavigationActions } from './file-system-context';

type BreadcrumbSegment = { label: string; path: string; isCurrent: boolean };

/** Build the ordered segment list from root down to `currentPath`. */
function buildSegments(currentPath: string, title: string): BreadcrumbSegment[] {
  // At the root there is nothing to trail; the title lives in the header.
  if (!currentPath) return [];

  const segments: BreadcrumbSegment[] = [{ isCurrent: false, label: title, path: '' }];
  const parts = getPathParts(currentPath);

  for (let i = 0; i < parts.length; i += 1) {
    const folderPath = `${parts.slice(0, i + 1).join('/')}/`;
    segments.push({ isCurrent: i === parts.length - 1, label: parts[i] ?? '', path: folderPath });
  }

  return segments;
}

type BreadcrumbItemProps = { label: string; onNavigate: (path: string) => void; path: string };
function BreadcrumbLink({ label, onNavigate, path }: BreadcrumbItemProps) {
  const handlePress = useCallback(() => onNavigate(path), [onNavigate, path]);
  return (
    <Pressable
      accessibilityLabel={`Go to ${label}`}
      accessibilityRole="button"
      onPress={handlePress}
      className="rounded px-1 py-0.5"
    >
      <Text className="text-muted-foreground" numberOfLines={1} size="sm">
        {label}
      </Text>
    </Pressable>
  );
}

function Separator() {
  const colors = useThemeColors();
  return <ChevronRight color={colors['muted-foreground']} size={12} />;
}

/**
 * Horizontal breadcrumb row rendered between the header and the file area.
 * Scrolls horizontally on deep paths rather than wrapping or truncating.
 * Returns `null` at the root — the title is already in the header.
 */
export function FileSystemBreadcrumbs() {
  const { currentPath } = useFileSystemNavigation();
  const { title } = useFileSystemConsumer();
  const { navigateTo } = useFileSystemNavigationActions();

  const segments = buildSegments(currentPath, title);
  if (segments.length === 0) return null;

  return (
    <View className="shrink-0 border-border border-b bg-surface-2">
      <ScrollView
        contentContainerClassName="flex-row items-center gap-0.5 px-3 py-1.5"
        horizontal={true}
        showsHorizontalScrollIndicator={false}
      >
        {segments.map((segment, index) => (
          <View className="flex-row items-center gap-0.5" key={segment.path}>
            {index > 0 ? <Separator /> : null}
            {segment.isCurrent ? (
              <Text className="px-1 py-0.5" numberOfLines={1} size="sm" weight="medium">
                {segment.label}
              </Text>
            ) : (
              <BreadcrumbLink label={segment.label} onNavigate={navigateTo} path={segment.path} />
            )}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
