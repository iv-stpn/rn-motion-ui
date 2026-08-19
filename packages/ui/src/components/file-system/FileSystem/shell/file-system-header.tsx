// The toolbar row: back/forward and the folder name. Sort, filter, search and
// the view switcher have been moved out to headless slots — `renderFilters` and
// `renderHeader` (via `view`/`setView`) — so consumers supply their own controls
// without losing the built-in logic. Nothing is drilled in: each cluster reads
// the slice it needs from the store context.

import { View } from 'react-native';
import { ArrowLeftLine as ArrowLeft } from 'rn-motion-ui-icons/icons/arrow-left-line';
import { ArrowRightLine as ArrowRight } from 'rn-motion-ui-icons/icons/arrow-right-line';
import { cn } from '../../../../lib/cn';
import { ThemedIcon } from '../../../icon/themed-icon';
import { Text } from '../../../typography/Text/text';
import {
  useFileSystemConsumer,
  useFileSystemLayout,
  useFileSystemNavigation,
  useFileSystemNavigationActions,
} from '../store/file-system-context';
import { ToolbarIconButton } from './file-system-toolbar-parts';

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
  const { testID } = useFileSystemConsumer();
  const headerTestID = testID ? `${testID}-header` : undefined;
  return (
    <View className={cn('h-12 shrink-0 flex-row items-center gap-2 px-2', className)} testID={headerTestID}>
      <HeaderNav />
    </View>
  );
}
