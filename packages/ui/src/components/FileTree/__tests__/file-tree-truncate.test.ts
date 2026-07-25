import { describe, expect, it } from 'vitest';
import { fileExtension, splitForMiddleTruncation } from '../file-tree-truncate';

describe('fileExtension', () => {
  it('returns the extension with the leading dot', () => {
    expect(fileExtension('Button.tsx')).toBe('.tsx');
    expect(fileExtension('archive.tar.gz')).toBe('.gz');
  });

  it('returns empty for dotfiles and extensionless names', () => {
    expect(fileExtension('.env')).toBe('');
    expect(fileExtension('.gitignore')).toBe('');
    expect(fileExtension('Makefile')).toBe('');
  });
});

describe('splitForMiddleTruncation', () => {
  it('pins the extension in the tail', () => {
    const { head, tail } = splitForMiddleTruncation('VeryLongComponentName.tsx');
    expect(tail).toBe('.tsx');
    expect(head).toBe('VeryLongComponentName');
    expect(head + tail).toBe('VeryLongComponentName.tsx');
  });

  it('honors an explicit longer tail length', () => {
    const { head, tail } = splitForMiddleTruncation('component.stories.tsx', 8);
    expect(tail.length).toBe(8);
    expect(tail).toBe('ries.tsx');
    expect(head + tail).toBe('component.stories.tsx');
  });

  it('keeps the whole name in head when there is nothing to pin', () => {
    expect(splitForMiddleTruncation('Makefile')).toEqual({ head: 'Makefile', tail: '' });
    // an explicit tail longer than the whole name is pointless — keep it whole
    expect(splitForMiddleTruncation('a.ts', 10)).toEqual({ head: 'a.ts', tail: '' });
  });

  it('still splits a short name with an extension so the extension stays visible', () => {
    expect(splitForMiddleTruncation('a.tsx')).toEqual({ head: 'a', tail: '.tsx' });
  });
});
