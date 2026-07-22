import { useThemeColors } from '../../theme/use-theme-color';

export function useTableColors() {
  const c = useThemeColors();
  return {
    container: { borderColor: c.border, backgroundColor: c.surface },
    headerRow: { borderBottomColor: c.border, backgroundColor: c.muted },
    headerText: { color: c['muted-foreground'] },
    headerTextActive: { color: c.foreground },
    headerRenameInput: { color: c['muted-foreground'] },
    dropIndicator: { backgroundColor: c.primary },
    row: { borderBottomColor: c.border },
    selectedBg: { backgroundColor: c.border }, // very subtle primary tint ≈ border opacity
    cellText: { color: c.foreground },
    editableInput: { color: c.foreground },
    emptyText: { color: c['muted-foreground'] },
    actionBtn: { backgroundColor: c.primary },
    actionBtnDestructive: { backgroundColor: c.destructive },
    card: { borderBottomColor: c.border },
    stripedRow: {}, // exempt — too subtle
    footer: { borderTopColor: c.border },
    loadMoreBtn: { borderColor: c.border },
    paginationText: { color: c['muted-foreground'] },
    paginationBtn: { borderColor: c.border },
    loadingMoreContainer: { borderTopColor: c.border },
    emptyTitle: { color: c.foreground },
    emptyDescription: { color: c['muted-foreground'] },
    skeletonBar: { backgroundColor: c.border },
  };
}
