// Pure file-type → icon-name resolution. RN-free so it can be unit-tested; the
// render layer maps the returned name to a concrete icon component. Names are a
// subset of lib/icons.tsx exports.

import { isDirectoryPath, leafName } from './file-tree-paths';

/** Icon identifiers the render layer knows how to draw. */
export type FileTreeIconName =
  | 'FolderClosed'
  | 'FileCode2'
  | 'FileImage'
  | 'FileVideo'
  | 'FileAudio'
  | 'FileArchive'
  | 'FileSpreadsheet'
  | 'FileText'
  | 'FileIcon';

// Extension → icon. Extensions are matched lowercased, without the dot.
export const EXTENSION_ICONS: Record<string, FileTreeIconName> = {
  // code
  ts: 'FileCode2',
  tsx: 'FileCode2',
  js: 'FileCode2',
  jsx: 'FileCode2',
  mjs: 'FileCode2',
  cjs: 'FileCode2',
  json: 'FileCode2',
  jsonc: 'FileCode2',
  py: 'FileCode2',
  rb: 'FileCode2',
  go: 'FileCode2',
  rs: 'FileCode2',
  java: 'FileCode2',
  kt: 'FileCode2',
  swift: 'FileCode2',
  c: 'FileCode2',
  h: 'FileCode2',
  cpp: 'FileCode2',
  hpp: 'FileCode2',
  cc: 'FileCode2',
  cs: 'FileCode2',
  php: 'FileCode2',
  sh: 'FileCode2',
  bash: 'FileCode2',
  zsh: 'FileCode2',
  sql: 'FileCode2',
  html: 'FileCode2',
  htm: 'FileCode2',
  css: 'FileCode2',
  scss: 'FileCode2',
  sass: 'FileCode2',
  less: 'FileCode2',
  vue: 'FileCode2',
  svelte: 'FileCode2',
  yaml: 'FileCode2',
  yml: 'FileCode2',
  toml: 'FileCode2',
  xml: 'FileCode2',
  graphql: 'FileCode2',
  gql: 'FileCode2',
  // images
  png: 'FileImage',
  jpg: 'FileImage',
  jpeg: 'FileImage',
  gif: 'FileImage',
  svg: 'FileImage',
  webp: 'FileImage',
  bmp: 'FileImage',
  ico: 'FileImage',
  avif: 'FileImage',
  tiff: 'FileImage',
  // video
  mp4: 'FileVideo',
  mov: 'FileVideo',
  avi: 'FileVideo',
  mkv: 'FileVideo',
  webm: 'FileVideo',
  // audio
  mp3: 'FileAudio',
  wav: 'FileAudio',
  flac: 'FileAudio',
  ogg: 'FileAudio',
  m4a: 'FileAudio',
  // archives
  zip: 'FileArchive',
  tar: 'FileArchive',
  gz: 'FileArchive',
  tgz: 'FileArchive',
  rar: 'FileArchive',
  '7z': 'FileArchive',
  bz2: 'FileArchive',
  xz: 'FileArchive',
  // spreadsheets / data
  csv: 'FileSpreadsheet',
  tsv: 'FileSpreadsheet',
  xls: 'FileSpreadsheet',
  xlsx: 'FileSpreadsheet',
  // text / docs
  md: 'FileText',
  mdx: 'FileText',
  txt: 'FileText',
  pdf: 'FileText',
  doc: 'FileText',
  docx: 'FileText',
  rtf: 'FileText',
  log: 'FileText',
};

/** The lowercased extension of a file leaf, or '' when it has none. */
export function fileExtension(name: string): string {
  // A leading dot (dotfile) is not an extension: `.gitignore` → ''.
  const dot = name.lastIndexOf('.');
  if (dot <= 0) return '';
  return name.slice(dot + 1).toLowerCase();
}

/** Resolve the icon name for a canonical path. Directories are always folders. */
export function resolveFileTreeIcon(path: string): FileTreeIconName {
  if (isDirectoryPath(path)) return 'FolderClosed';
  const ext = fileExtension(leafName(path));
  return EXTENSION_ICONS[ext] ?? 'FileIcon';
}
