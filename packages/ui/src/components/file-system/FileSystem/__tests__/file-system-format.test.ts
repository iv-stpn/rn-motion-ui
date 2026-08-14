import { describe, expect, it } from 'vitest';
import { formatFileSystemStats } from '../logic/file-system-format';
import type { FileEntry, FolderEntry } from '../types/file-system.types';

function file(overrides: Partial<FileEntry> = {}): FileEntry {
  return { kind: 'file', key: 'report.pdf', name: 'report.pdf', parentPath: '', path: 'report.pdf', ...overrides };
}

function folder(overrides: Partial<FolderEntry> = {}): FolderEntry {
  return { kind: 'folder', name: 'docs', parentPath: '', path: 'docs/', ...overrides };
}

const UPDATED_AT = '2026-02-03T16:05:00.000Z';

describe('formatFileSystemStats', () => {
  it('formats a file as size then date, joined with a middle dot', () => {
    const result = formatFileSystemStats(file({ size: 1234, updatedAt: UPDATED_AT }));
    // The date is locale/timezone-dependent, but the byte size and the separator are not.
    expect(result.startsWith('1.23 KB · ')).toBe(true);
  });

  it('drops the date for a file with no timestamps', () => {
    expect(formatFileSystemStats(file({ size: 1234 }))).toBe('1.23 KB');
  });

  it('drops the size for a file with none, leaving just the date', () => {
    const result = formatFileSystemStats(file({ updatedAt: UPDATED_AT }));
    expect(result.includes('·')).toBe(false);
    expect(result).not.toContain('KB');
  });

  it('formats a folder as item count then date', () => {
    const result = formatFileSystemStats(folder({ updatedAt: UPDATED_AT }), 3);
    expect(result.startsWith('3 items · ')).toBe(true);
  });

  it('uses the singular for a single child', () => {
    const result = formatFileSystemStats(folder({}), 1);
    expect(result.startsWith('1 item')).toBe(true);
    expect(result).not.toContain('items');
  });

  it('drops the count for a folder with none, leaving just the date', () => {
    const result = formatFileSystemStats(folder({ updatedAt: UPDATED_AT }));
    expect(result.includes('·')).toBe(false);
    expect(result).not.toContain('item');
  });
});
