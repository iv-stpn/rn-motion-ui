import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    backgroundColor: '#fff',
  },
  headerRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
    backgroundColor: '#f9fafb',
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
    color: '#6b7280',
    flex: 1,
  },
  headerTextActive: {
    color: '#111827',
  },
  headerRenameInput: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6b7280',
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
    backgroundColor: '#3b82f6',
    zIndex: 20,
  },
  row: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.07)',
    overflow: 'hidden',
    position: 'relative',
  },
  selectedBg: {
    backgroundColor: 'rgba(59,130,246,0.05)',
  },
  cell: {
    justifyContent: 'center',
    paddingHorizontal: 16,
    overflow: 'hidden',
  },
  cellText: {
    fontSize: 13,
    color: '#111827',
  },
  editableInput: {
    fontSize: 13,
    color: '#111827',
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
    color: '#6b7280',
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
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnDestructive: {
    backgroundColor: '#ef4444',
  },
  card: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.07)',
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
    backgroundColor: 'rgba(0,0,0,0.02)',
  },
  // ── Footer ───────────────────────────────────────────────────────────────
  footer: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  footerLoadMore: {
    alignItems: 'stretch',
  },
  loadMoreBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.15)',
    alignItems: 'center',
  },
  footerPagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  paginationText: {
    fontSize: 13,
    color: '#6b7280',
  },
  paginationBtn: {
    width: 32,
    height: 32,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.12)',
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
    borderTopColor: 'rgba(0,0,0,0.07)',
  },
  // ── Rich empty state ──────────────────────────────────────────────────────
  emptyIcon: {
    marginBottom: 10,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 4,
  },
  emptyDescription: {
    fontSize: 13,
    color: '#6b7280',
    textAlign: 'center',
  },
});
