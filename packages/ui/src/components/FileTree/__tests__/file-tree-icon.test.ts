import { describe, expect, it } from 'vitest';
import { resolveFileTreeIcon } from '../file-tree-icon';

describe('resolveFileTreeIcon', () => {
  it('resolves directories to a folder icon', () => {
    expect(resolveFileTreeIcon('src/')).toBe('FolderClosed');
    expect(resolveFileTreeIcon('src/components/')).toBe('FolderClosed');
  });

  it('resolves code, image, video, audio, archive, sheet, and text families', () => {
    expect(resolveFileTreeIcon('src/index.ts')).toBe('FileCode2');
    expect(resolveFileTreeIcon('a/logo.SVG')).toBe('FileImage');
    expect(resolveFileTreeIcon('a/clip.mp4')).toBe('FileVideo');
    expect(resolveFileTreeIcon('a/song.mp3')).toBe('FileAudio');
    expect(resolveFileTreeIcon('a/bundle.zip')).toBe('FileArchive');
    expect(resolveFileTreeIcon('a/data.csv')).toBe('FileSpreadsheet');
    expect(resolveFileTreeIcon('README.md')).toBe('FileText');
  });

  it('falls back to a generic file icon for unknown or extensionless names', () => {
    expect(resolveFileTreeIcon('a/mystery.qwerty')).toBe('FileIcon');
    expect(resolveFileTreeIcon('a/.env')).toBe('FileIcon');
    expect(resolveFileTreeIcon('LICENSE')).toBe('FileIcon');
  });
});
