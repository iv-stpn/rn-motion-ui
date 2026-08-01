/** biome-ignore-all lint/style/useExportsLast: exported tables and module-private resolvers interleave by concern */
// File-type icon + colour resolution. Maps extensions to a glyph name and a
// per-language colour token so the icon, columns and gallery views draw the
// same tinted icon.
//
// RN-free: returns a name plus a light/dark colour pair, and the render layer
// (file-system-icons.tsx) turns that into a react-native-svg component.

import { fileExtension } from './file-system-paths';

/** Icon identifiers the render layer knows how to draw. */
export type FileIconName =
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
export const EXTENSION_ICONS: Record<string, FileIconName> = {
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

/** Colour identities the palette below covers. */
export type FileIconColorToken =
  | 'archive'
  | 'code'
  | 'css'
  | 'data'
  | 'default'
  | 'document'
  | 'go'
  | 'html'
  | 'image'
  | 'javascript'
  | 'json'
  | 'markdown'
  | 'media'
  | 'pdf'
  | 'python'
  | 'ruby'
  | 'rust'
  | 'shell'
  | 'spreadsheet'
  | 'text'
  | 'typescript'
  | 'yml';

/**
 * `[light, dark]` hex pairs. Both are fixed sRGB values rather than theme
 * tokens: a file-type colour identifies the language, so it must survive on
 * paper-white thumbnail tiles and on the primary-filled selected label alike.
 */
export const FILE_ICON_COLORS: Record<FileIconColorToken, [light: string, dark: string]> = {
  archive: ['#d47628', '#ffa359'],
  code: ['#1a85d4', '#69b1ff'],
  css: ['#693acf', '#9d6afb'],
  data: ['#a631be', '#d568ea'],
  default: ['#84848a', '#adadb1'],
  document: ['#1a85d4', '#69b1ff'],
  go: ['#1ca1c7', '#68cdf2'],
  html: ['#d47628', '#ffa359'],
  image: ['#d32a61', '#ff678d'],
  javascript: ['#d5a910', '#ffd452'],
  json: ['#d47628', '#ffa359'],
  markdown: ['#199f43', '#5ecc71'],
  media: ['#a631be', '#d568ea'],
  pdf: ['#d52c36', '#ff6762'],
  python: ['#1a85d4', '#69b1ff'],
  ruby: ['#d52c36', '#ff6762'],
  rust: ['#d47628', '#ffa359'],
  shell: ['#199f43', '#5ecc71'],
  spreadsheet: ['#17a5af', '#64d1db'],
  text: ['#84848a', '#adadb1'],
  typescript: ['#1a85d4', '#69b1ff'],
  yml: ['#d52c36', '#ff6762'],
};

// Extension → colour token. Extensions absent here fall back to a token
// derived from the resolved icon name (see `colorTokenForIcon`).
const EXTENSION_COLOR_TOKENS: Record<string, FileIconColorToken> = {
  '7z': 'archive',
  bash: 'shell',
  c: 'code',
  cc: 'code',
  cpp: 'code',
  cs: 'code',
  css: 'css',
  csv: 'spreadsheet',
  doc: 'document',
  docx: 'document',
  gql: 'data',
  graphql: 'data',
  gz: 'archive',
  h: 'code',
  hpp: 'code',
  htm: 'html',
  html: 'html',
  go: 'go',
  js: 'javascript',
  json: 'json',
  jsx: 'javascript',
  less: 'css',
  log: 'text',
  md: 'markdown',
  mdx: 'markdown',
  mjs: 'javascript',
  cjs: 'javascript',
  pdf: 'pdf',
  php: 'code',
  ppt: 'document',
  pptx: 'document',
  py: 'python',
  rar: 'archive',
  rb: 'ruby',
  rs: 'rust',
  rtf: 'document',
  sass: 'css',
  scss: 'css',
  sh: 'shell',
  sql: 'data',
  svelte: 'code',
  tar: 'archive',
  tgz: 'archive',
  toml: 'yml',
  ts: 'typescript',
  tsv: 'spreadsheet',
  tsx: 'typescript',
  txt: 'text',
  vue: 'code',
  xls: 'spreadsheet',
  xlsx: 'spreadsheet',
  xml: 'code',
  yaml: 'yml',
  yml: 'yml',
  zip: 'archive',
  zsh: 'shell',
};

/** Colour token implied by the glyph, for extensions without an explicit one. */
// Return type left inferred: it narrows to the subset of tokens a glyph can imply.
function colorTokenForIcon(icon: FileIconName) {
  switch (icon) {
    case 'FileCode2':
      return 'code';
    case 'FileImage':
      return 'image';
    case 'FileVideo':
    case 'FileAudio':
      return 'media';
    case 'FileArchive':
      return 'archive';
    case 'FileSpreadsheet':
      return 'spreadsheet';
    case 'FileText':
      return 'text';
    default:
      return 'default';
  }
}

export type ResolvedFileIcon = { name: FileIconName; token: FileIconColorToken };

/** Glyph + colour token for a file name (folders are handled by the glyph). */
export function resolveFileIcon(fileName: string): ResolvedFileIcon {
  const extension = fileExtension(fileName);
  const name = EXTENSION_ICONS[extension] ?? 'FileIcon';
  return { name, token: EXTENSION_COLOR_TOKENS[extension] ?? colorTokenForIcon(name) };
}

/**
 * The colour to paint a resolved icon in.
 *
 * `surface` names what the icon sits on, not the app theme: thumbnail tiles keep
 * a paper-white face in dark mode (`'light'`), the primary-filled selected label
 * is the inverse of the current mode (`'inverted'`), and everything else follows
 * the theme (`'theme'`).
 */
export function fileIconColor(
  token: FileIconColorToken,
  isDark: boolean,
  surface: 'theme' | 'light' | 'inverted' = 'theme',
): string {
  const [light, dark] = FILE_ICON_COLORS[token];
  if (surface === 'light') return light;
  const useDark = surface === 'inverted' ? !isDark : isDark;
  return useDark ? dark : light;
}
