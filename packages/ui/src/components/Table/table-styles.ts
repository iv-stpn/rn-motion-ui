// Color properties have been moved to useTableColors() in table-theme.ts — see each component for the merge pattern.
import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    borderWidth: 1,
    // color: tc.container (borderColor, backgroundColor)
  },
  headerRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    // color: tc.headerRow (borderBottomColor, backgroundColor)
    // Reorder drags start on the header grip; without this, a mouse drag selects
    // the header text and the native selection hijacks the pointer, so the
    // PanResponder never tracks the move. Suppress selection across the header.
    userSelect: 'none',
  },
  headerCell: {
    flexDirection: 'column',
    justifyContent: 'center',
    paddingHorizontal: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  headerLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 4,
  },
  headerText: {
    fontSize: 12,
    fontWeight: '500',
    // color: tc.headerText (color)
    flex: 1,
  },
  headerTextActive: {
    // color: tc.headerTextActive (color)
  },
  headerRenameInput: {
    fontSize: 12,
    fontWeight: '500',
    // color: tc.headerRenameInput (color)
    padding: 0,
    flex: 1,
  },
  headerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 4,
  },
  grip: {
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: -4,
    userSelect: 'none',
  },
  dropIndicator: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    // color: tc.dropIndicator (backgroundColor)
    zIndex: 20,
  },
  row: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    // color: tc.row (borderBottomColor)
    overflow: 'hidden',
    position: 'relative',
  },
  selectedBg: {
    // color: tc.selectedBg (backgroundColor)
  },
  cell: {
    justifyContent: 'center',
    paddingHorizontal: 16,
    overflow: 'hidden',
  },
  cellText: {
    fontSize: 13,
    // color: tc.cellText (color)
  },
  editableInput: {
    fontSize: 13,
    // color: tc.editableInput (color)
    padding: 4,
    borderRadius: 4,
    flex: 1,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 14,
    // color: tc.emptyText (color)
    textAlign: 'center',
  },
  rowActionBar: {
    position: 'absolute',
    right: 8,
    top: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  colActionBar: {
    position: 'absolute',
    top: 2,
    right: 2,
    flexDirection: 'row',
    gap: 2,
    zIndex: 10,
  },
  actionBtn: {
    width: 20,
    height: 20,
    borderRadius: 10,
    // color: tc.actionBtn (backgroundColor)
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnDestructive: {
    // color: tc.actionBtnDestructive (backgroundColor)
  },
  card: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    // color: tc.card (borderBottomColor)
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  cardCheckbox: {
    paddingTop: 2,
  },
  cardContent: {
    flex: 1,
    minWidth: 0,
  },
  // ── Striped rows ─────────────────────────────────────────────────────────
  stripedRow: {
    backgroundColor: 'rgba(0,0,0,0.02)', // exempt — too subtle to need theming
  },
  // ── Footer ───────────────────────────────────────────────────────────────
  footer: {
    borderTopWidth: 1,
    // color: tc.footer (borderTopColor)
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  footerLoadMore: {
    alignItems: 'stretch',
  },
  footerPagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  paginationText: {
    fontSize: 13,
    // color: tc.paginationText (color)
  },
  paginationBtn: {
    width: 32,
    height: 32,
    borderRadius: 6,
    borderWidth: 1,
    // color: tc.paginationBtn (borderColor)
    alignItems: 'center',
    justifyContent: 'center',
  },
  paginationBtnDisabled: {
    opacity: 0.35,
  },
  // ── loadingMore spinner ───────────────────────────────────────────────────
  loadingMoreContainer: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 1,
    // color: tc.loadingMoreContainer (borderTopColor)
  },
  // ── Rich empty state ──────────────────────────────────────────────────────
  emptyIcon: {
    marginBottom: 10,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '600',
    // color: tc.emptyTitle (color)
    textAlign: 'center',
    marginBottom: 4,
  },
  emptyDescription: {
    fontSize: 13,
    // color: tc.emptyDescription (color)
    textAlign: 'center',
  },
});
