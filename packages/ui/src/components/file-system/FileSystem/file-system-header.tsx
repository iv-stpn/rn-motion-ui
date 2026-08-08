// The toolbar row: back/forward, the folder name, and the view-mode switcher.
// Sort, filter and search have been moved to the headless `renderFilters` slot
// so consumers can supply their own controls without losing the built-in
// filtering logic. Nothing is drilled in: each cluster reads the slice it
// needs from the store context.

import { View } from 'react-native';
import { ArrowLeftLine as ArrowLeft } from 'rn-motion-ui-icons/icons/arrow-left-line';
import { ArrowRightLine as ArrowRight } from 'rn-motion-ui-icons/icons/arrow-right-line';
import { cn } from '../../../lib/cn';
import { ThemedIcon } from '../../icon/themed-icon';
import { Text } from '../../typography/Text/text';
import {
  useFileSystemConsumer,
  useFileSystemEntries,
  useFileSystemEntriesActions,
  useFileSystemLayout,
  useFileSystemNavigation,
  useFileSystemNavigationActions,
} from './file-system-context';
import { FileSystemViewSwitcher, ToolbarIconButton } from './file-system-toolbar-parts';
import { FileSystemViewSelect } from './file-system-view-select';

const BACK_LABEL = 'Back';
const FORWARD_LABEL = 'Forward';
const NAV_ICON_SIZE = 18;

/** Back/forward pair plus the current folder's name. */
function HeaderNav() {
  const { canGoBack, canGoForward, currentFolderName } = useFileSystemNavigation();
  const { goBack, goForward } = useFileSystemNavigationActions();
  const { layout } = useFileSystemLayout();
  return (
    <View className="min-w-0 flex-1 flex-row items-center gap-0.5">
      <ToolbarIconButton accessibilityLabel={BACK_LABEL} disabled={!canGoBack} onPress={goBack}>
        <ThemedIcon icon={ArrowLeft} variant="ghost" size={NAV_ICON_SIZE} />
      </ToolbarIconButton>
      <ToolbarIconButton accessibilityLabel={FORWARD_LABEL} disabled={!canGoForward} onPress={goForward}>
        <ThemedIcon icon={ArrowRight} variant="ghost" size={NAV_ICON_SIZE} />
      </ToolbarIconButton>
      {layout === 'minimal' ? null : (
        <Text className="ml-1.5 shrink" numberOfLines={1} size="sm" weight="semibold">
          {currentFolderName}
        </Text>
      )}
    </View>
  );
}

type FileSystemHeaderProps = { className?: string };

export function FileSystemHeader({ className }: FileSystemHeaderProps) {
  const { isCompact } = useFileSystemLayout();
  const { view } = useFileSystemEntries();
  const { setView } = useFileSystemEntriesActions();
  const { testID } = useFileSystemConsumer();
  const headerTestID = testID ? `${testID}-header` : undefined;
  return (
    <View className={cn('h-12 shrink-0 flex-row items-center gap-2 bg-surface-2 px-2', className)} testID={headerTestID}>
      <HeaderNav />
      {isCompact ? (
        <FileSystemViewSelect onViewChange={setView} view={view} />
      ) : (
        <FileSystemViewSwitcher onViewChange={setView} view={view} />
      )}
    </View>
  );
}
