import type { ReactNode } from 'react';
import { useCallback } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { Pressable, View } from 'react-native';
import { RightLine as ChevronRight } from 'rn-motion-ui-icons/icons/right-line';
import { cn } from '../../../lib/cn';
import { useThemeColor } from '../../../theme/use-theme-color';
import { Button } from '../../form/Button/button';
import { Checkbox } from '../../form/Checkbox/checkbox';
import { ThemedIcon } from '../../icon/themed-icon';
import { Text } from '../../typography/Text/text';
import { Loader } from '../Loader/loader';

// ── Card row (small-screen mode) ──────────────────────────────────────────────

export type TableCardProps<T> = {
  row: T;
  id: string;
  isSelected: boolean;
  selectable: boolean;
  cardStyle?: StyleProp<ViewStyle>;
  /** UniWind classes merged onto the card (alongside `cardStyle`). */
  cardClassName?: string;
  /** UniWind classes merged onto the selected-card background. */
  selectedClassName?: string;
  toggleRow: (id: string) => void;
  renderSmallScreen: (row: T, selected: boolean) => ReactNode;
  testID?: string;
};

export function TableCard<T>({
  row,
  id,
  isSelected,
  selectable,
  cardStyle,
  cardClassName,
  selectedClassName,
  toggleRow,
  renderSmallScreen,
  testID,
}: TableCardProps<T>) {
  const handlePress = useCallback(() => toggleRow(id), [toggleRow, id]);
  const handleCheckedChange = useCallback(() => toggleRow(id), [toggleRow, id]);
  return (
    <Pressable
      onPress={selectable ? handlePress : undefined}
      className={cn('px-4 py-3', isSelected && selectedClassName, cardClassName)}
      style={cardStyle}
      testID={testID ? `${testID}-card-${id}` : undefined}
    >
      <View className="flex-row items-start gap-3">
        {selectable ? (
          <View className="pt-0.5">
            <Checkbox checked={isSelected} onCheckedChange={handleCheckedChange} />
          </View>
        ) : null}
        <View className="min-w-0 flex-1">{renderSmallScreen(row, isSelected)}</View>
      </View>
    </Pressable>
  );
}

// ── Skeleton footer (appended while loading more rows) ────────────────────────

export type SkeletonFooterProps = {
  loading: boolean;
  hasRows: boolean;
  isCardMode: boolean;
  renderSkeletonCards: (rows: number) => ReactNode;
  renderSkeletonRows: (rows: number) => ReactNode;
  skeletonRows: number;
};

/** Renders skeleton rows/cards appended after existing data during a follow-up load. */
export function SkeletonFooter({
  loading,
  hasRows,
  isCardMode,
  renderSkeletonCards,
  renderSkeletonRows,
  skeletonRows,
}: SkeletonFooterProps) {
  if (!(loading && hasRows)) return null;
  return isCardMode ? renderSkeletonCards(skeletonRows) : renderSkeletonRows(skeletonRows);
}

// ── Pagination footer ─────────────────────────────────────────────────────────

export type PaginationFooterProps = {
  page: number;
  totalPages: number;
  paginationLabel?: (page: number, totalPages: number) => string;
  goToPreviousPage: () => void;
  goToNextPage: () => void;
  /** UniWind classes merged onto the footer container. */
  footerClassName?: string;
  /** Replace the previous-page icon. Default: rotated `<ChevronRight size={16} />`. */
  prevIcon?: ReactNode;
  /** Replace the next-page icon. Default: `<ChevronRight size={16} />`. */
  nextIcon?: ReactNode;
};

export function PaginationFooter({
  page,
  totalPages,
  paginationLabel,
  goToPreviousPage,
  goToNextPage,
  footerClassName,
  prevIcon,
  nextIcon,
}: PaginationFooterProps) {
  const label = paginationLabel?.(page, totalPages) ?? `${page} / ${totalPages}`;
  const prevDisabled = page <= 1;
  const nextDisabled = page >= totalPages;
  return (
    <View className={cn('flex-row items-center justify-center gap-3 px-4 py-2.5', footerClassName)}>
      <Pressable
        onPress={prevDisabled ? undefined : goToPreviousPage}
        className={cn('h-8 w-8 items-center justify-center rounded-md', prevDisabled && 'opacity-35')}
        accessibilityLabel="Previous page"
        accessibilityRole="button"
        disabled={prevDisabled}
      >
        {/* Rotated ChevronRight stands in for missing ChevronLeft */}
        <View className="rotate-180">{prevIcon ?? <ThemedIcon icon={ChevronRight} variant="secondary" size={16} />}</View>
      </Pressable>
      <Text className="text-[13px]">{label}</Text>
      <Pressable
        onPress={nextDisabled ? undefined : goToNextPage}
        className={cn('h-8 w-8 items-center justify-center rounded-md', nextDisabled && 'opacity-35')}
        accessibilityLabel="Next page"
        accessibilityRole="button"
        disabled={nextDisabled}
      >
        {nextIcon ?? <ThemedIcon icon={ChevronRight} variant="secondary" size={16} />}
      </Pressable>
    </View>
  );
}

// ── Load-more button footer ───────────────────────────────────────────────────

export type LoadMoreFooterProps = {
  onLoadMore?: () => void;
  loadMoreLabel: string;
  /** UniWind classes merged onto the footer container. */
  footerClassName?: string;
};

export function LoadMoreFooter({ onLoadMore, loadMoreLabel, footerClassName }: LoadMoreFooterProps) {
  return (
    <View className={cn('items-stretch px-4 py-2.5', footerClassName)}>
      <Button variant="ghost" size="sm" onPress={onLoadMore} fitWidth={true} accessibilityLabel={loadMoreLabel}>
        {loadMoreLabel}
      </Button>
    </View>
  );
}

// ── Loading-more spinner footer ───────────────────────────────────────────────

export type LoadingMoreFooterProps = { footerClassName?: string };

/** Renders a centered Loader row while a follow-up page/batch is fetching. */
export function LoadingMoreFooter({ footerClassName }: LoadingMoreFooterProps) {
  const mutedForeground = useThemeColor('muted-foreground');
  return (
    <View className={cn('items-center justify-center py-4', footerClassName)}>
      <Loader variant="spinner" size={20} color={mutedForeground} label="Loading more" />
    </View>
  );
}
