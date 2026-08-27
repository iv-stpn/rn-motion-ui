/** biome-ignore-all lint/style/useExportsLast: exported tables and module-private resolvers interleave by concern */
// File-type icon + colour resolution. Maps extensions to a glyph name — a
// tintable category badge drawn over the shared paper, or a fixed-colour brand
// logo (PDF, MS Office, Flash, AI, Video) — plus the per-category colour token
// the render layer tints the badge with.
//
// RN-free: returns a name plus a light/dark colour pair, and the render layer
// (file-icons.tsx) turns that into react-native-svg.

import { fileExtension } from '../FileSystem/logic/file-system-paths';
import { FILE_BADGE_SHEET, FILE_BRAND_INK, FILE_PAPER_INK, FILE_PAPER_SHEET } from './file-icon-metrics';

/** Category glyphs the render layer draws as a tintable badge over the paper. */
export type FileIconCategory =
  | 'FileAudio'
  | 'FileApk'
  | 'FileArchive'
  | 'FileCertificate'
  | 'FileCode'
  | 'FileConfig'
  | 'FileDatabase'
  | 'FileDiskImage'
  | 'FileDocument'
  | 'FileExecutable'
  | 'FileFont'
  | 'FileImage'
  | 'FileLibrary'
  | 'FileScript'
  | 'FileTerminal'
  | 'File3d';

/** Brand glyphs drawn in their own fixed colours (no tinting). */
export type FileIconBrand =
  | 'FilePdf'
  | 'FileWord'
  | 'FileExcel'
  | 'FilePowerPoint'
  | 'FileOneNote'
  | 'FileFlash'
  | 'FileAi'
  | 'FileVideo';

/** Icon identifiers the render layer knows how to draw. */
export type FileIconName = FileIconCategory | FileIconBrand;

/** The brand names, as a lookup. Typed against the union, so neither half can drift. */
const BRAND_NAMES: Record<FileIconBrand, true> = {
  FilePdf: true,
  FileWord: true,
  FileExcel: true,
  FilePowerPoint: true,
  FileOneNote: true,
  FileFlash: true,
  FileAi: true,
  FileVideo: true,
};

/** Whether a resolved name is a full-bleed brand logo rather than a page + badge. */
export function isFileIconBrand(name: FileIconName): name is FileIconBrand {
  return Object.hasOwn(BRAND_NAMES, name);
}

// Extension → icon. Extensions are matched lowercased, without the dot.
export const EXTENSION_ICONS: Record<string, FileIconName> = {
  // code
  ts: 'FileCode',
  tsx: 'FileCode',
  js: 'FileCode',
  jsx: 'FileCode',
  mjs: 'FileCode',
  cjs: 'FileCode',
  go: 'FileCode',
  rs: 'FileCode',
  java: 'FileCode',
  kt: 'FileCode',
  swift: 'FileCode',
  c: 'FileCode',
  h: 'FileCode',
  cpp: 'FileCode',
  hpp: 'FileCode',
  cc: 'FileCode',
  cs: 'FileCode',
  php: 'FileCode',
  html: 'FileCode',
  htm: 'FileCode',
  css: 'FileCode',
  scss: 'FileCode',
  sass: 'FileCode',
  less: 'FileCode',
  vue: 'FileCode',
  svelte: 'FileCode',
  xml: 'FileCode',
  graphql: 'FileCode',
  gql: 'FileCode',
  // scripts
  py: 'FileScript',
  rb: 'FileScript',
  sh: 'FileScript',
  bash: 'FileScript',
  zsh: 'FileScript',
  ps1: 'FileScript',
  // terminal
  command: 'FileTerminal',
  bat: 'FileTerminal',
  cmd: 'FileTerminal',
  // config
  json: 'FileConfig',
  jsonc: 'FileConfig',
  yaml: 'FileConfig',
  yml: 'FileConfig',
  toml: 'FileConfig',
  ini: 'FileConfig',
  conf: 'FileConfig',
  cfg: 'FileConfig',
  env: 'FileConfig',
  // data
  sql: 'FileDatabase',
  sqlite: 'FileDatabase',
  db: 'FileDatabase',
  mdb: 'FileDatabase',
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
  heic: 'FileImage',
  // audio
  mp3: 'FileAudio',
  wav: 'FileAudio',
  flac: 'FileAudio',
  ogg: 'FileAudio',
  m4a: 'FileAudio',
  aac: 'FileAudio',
  // archives
  zip: 'FileArchive',
  tar: 'FileArchive',
  gz: 'FileArchive',
  tgz: 'FileArchive',
  rar: 'FileArchive',
  '7z': 'FileArchive',
  bz2: 'FileArchive',
  xz: 'FileArchive',
  jar: 'FileArchive',
  deb: 'FileArchive',
  rpm: 'FileArchive',
  // documents
  txt: 'FileDocument',
  md: 'FileDocument',
  mdx: 'FileDocument',
  rtf: 'FileDocument',
  log: 'FileDocument',
  csv: 'FileDocument',
  tsv: 'FileDocument',
  // fonts
  otf: 'FileFont',
  ttf: 'FileFont',
  woff: 'FileFont',
  woff2: 'FileFont',
  eot: 'FileFont',
  // executables & packages
  exe: 'FileExecutable',
  msi: 'FileExecutable',
  bin: 'FileExecutable',
  app: 'FileExecutable',
  apk: 'FileApk',
  aab: 'FileApk',
  // disk images
  dmg: 'FileDiskImage',
  iso: 'FileDiskImage',
  img: 'FileDiskImage',
  vhd: 'FileDiskImage',
  // certificates
  cer: 'FileCertificate',
  crt: 'FileCertificate',
  pem: 'FileCertificate',
  p12: 'FileCertificate',
  pfx: 'FileCertificate',
  // libraries
  dll: 'FileLibrary',
  dylib: 'FileLibrary',
  so: 'FileLibrary',
  a: 'FileLibrary',
  lib: 'FileLibrary',
  // 3d
  blend: 'File3d',
  obj: 'File3d',
  fbx: 'File3d',
  stl: 'File3d',
  gltf: 'File3d',
  glb: 'File3d',
  // brands — PDF / office / flash / ai / video
  pdf: 'FilePdf',
  doc: 'FileWord',
  docx: 'FileWord',
  xls: 'FileExcel',
  xlsx: 'FileExcel',
  ppt: 'FilePowerPoint',
  pptx: 'FilePowerPoint',
  one: 'FileOneNote',
  onepkg: 'FileOneNote',
  swf: 'FileFlash',
  fla: 'FileFlash',
  flv: 'FileFlash',
  ai: 'FileAi',
  mp4: 'FileVideo',
  mov: 'FileVideo',
  avi: 'FileVideo',
  mkv: 'FileVideo',
  webm: 'FileVideo',
};

/** Colour identities the palette below covers. */
export type FileIconColorToken =
  | 'audio'
  | 'apk'
  | 'archive'
  | 'certificate'
  | 'code'
  | 'config'
  | 'database'
  | 'diskImage'
  | 'document'
  | 'executable'
  | 'font'
  | 'image'
  | 'library'
  | 'script'
  | 'terminal'
  | 'threeD'
  | 'default';

/**
 * `[light, dark]` hex pairs. `light` is the generator's badge colour (sized to
 * sit on the white paper); `dark` is a brighter tint for dark themes. Both are
 * fixed sRGB values rather than theme tokens: a file-type colour identifies the
 * language, so it must survive on paper-white thumbnail tiles and on the
 * primary-filled selected label alike.
 */
export const FILE_ICON_COLORS: Record<FileIconColorToken, [light: string, dark: string]> = {
  audio: ['#a63d9f', '#cb8ec7'],
  apk: ['#2d9a58', '#85c49e'],
  archive: ['#bd6a21', '#d9a97e'],
  certificate: ['#b68a19', '#d5bb7a'],
  code: ['#2877a8', '#82b0cd'],
  config: ['#667085', '#a6acb8'],
  database: ['#256c9b', '#81aac5'],
  diskImage: ['#6c7785', '#aab0b8'],
  document: ['#5273b8', '#9baed6'],
  executable: ['#c24d37', '#dc988b'],
  font: ['#7952a1', '#b19bc8'],
  image: ['#218f85', '#7ebeb8'],
  library: ['#7652a6', '#b09bcb'],
  script: ['#b36c18', '#d3aa79'],
  terminal: ['#35475d', '#536375'],
  threeD: ['#5c7cbe', '#a0b3d9'],
  default: ['#84848a', '#adadb1'],
};

/** Colour token implied by each category glyph; brands have none and fall back. */
const CATEGORY_COLOR_TOKENS: Partial<Record<FileIconName, FileIconColorToken>> = {
  FileAudio: 'audio',
  FileApk: 'apk',
  FileArchive: 'archive',
  FileCertificate: 'certificate',
  FileCode: 'code',
  FileConfig: 'config',
  FileDatabase: 'database',
  FileDiskImage: 'diskImage',
  FileDocument: 'document',
  FileExecutable: 'executable',
  FileFont: 'font',
  FileImage: 'image',
  FileLibrary: 'library',
  FileScript: 'script',
  FileTerminal: 'terminal',
  File3d: 'threeD',
};

export type ResolvedFileIcon = { name: FileIconName; token: FileIconColorToken };

/** Glyph + colour token for a file name (folders are handled by the glyph). */
export function resolveFileIcon(fileName: string): ResolvedFileIcon {
  const extension = fileExtension(fileName);
  const name = EXTENSION_ICONS[extension];
  if (!name) return { name: 'FileDocument', token: 'default' };
  return { name, token: CATEGORY_COLOR_TOKENS[name] ?? 'default' };
}

/**
 * Width ÷ height of what a glyph draws — its ink, not the canvas it was authored
 * on. A file icon is laid out by width alone, so this is what turns that one
 * shared width into the height each glyph actually needs.
 *
 * The spread is wide enough to matter: the paper is a portrait page (0.78), the
 * Office logos lean landscape (1.07).
 */
export function fileIconAspectRatio(name: FileIconName): number {
  const ink = isFileIconBrand(name) ? FILE_BRAND_INK[name] : FILE_PAPER_INK;
  return ink.width / ink.height;
}

/** The centre of a box, per axis. */
const centre = (start: number, extent: number) => start + extent / 2;

/**
 * Where a category badge sits on the paper, as an SVG `transform`.
 *
 * The badges are authored over the retired 512-square raster template and the
 * paper is now vector art in its own 128-square, so the two pages sit at
 * different coordinates and different scales. This maps one onto the other.
 *
 * The scale is uniform and taken from the width — a badge is a symbol, so
 * squaring the two boxes off against each other axis-by-axis would visibly
 * squash it, and the two pages differ in proportion by about a percent. The
 * leftover on the vertical is split by centring the sheets on each other, which
 * is also what keeps a badge optically centred on the page it is drawn on.
 */
export const FILE_BADGE_TRANSFORM = ((): string => {
  const scale = FILE_PAPER_SHEET.width / FILE_BADGE_SHEET.width;
  const x = centre(FILE_PAPER_SHEET.x, FILE_PAPER_SHEET.width) - scale * centre(FILE_BADGE_SHEET.x, FILE_BADGE_SHEET.width);
  const y = centre(FILE_PAPER_SHEET.y, FILE_PAPER_SHEET.height) - scale * centre(FILE_BADGE_SHEET.y, FILE_BADGE_SHEET.height);
  // Trimmed: the full float expansions are noise in a rendered attribute, and
  // four places is a thousandth of a paper unit.
  const trim = (n: number) => Number(n.toFixed(4));
  return `translate(${trim(x)} ${trim(y)}) scale(${trim(scale)})`;
})();

/**
 * The narrowest glyph in the set — the portrait page. A width that fits a box at
 * this ratio fits it for every other glyph too, which is what lets one width be
 * handed to all of them without measuring the file first.
 */
const NARROWEST_ASPECT_RATIO = Math.min(
  FILE_PAPER_INK.width / FILE_PAPER_INK.height,
  ...Object.values(FILE_BRAND_INK).map((ink) => ink.width / ink.height),
);

/**
 * The width to draw *any* file icon at so it fills a `width`×`height` slot.
 *
 * Deliberately blind to the file: icons in one grid or one row lane must share a
 * width, so the slot has to be solved for the tallest glyph that could land in
 * it, not for the one that did. Each glyph then takes the height its own ratio
 * asks for, and a page ends up taller than the PDF beside it — same width, its
 * own proportions.
 */
export function fileIconWidthForBox(width: number, height: number): number {
  // Rounded down, never up: half a pixel over is what would let a page graze the
  // edge of a tile that clips, or a neighbouring one that does not.
  return Math.floor(Math.min(width, height * NARROWEST_ASPECT_RATIO));
}

/**
 * Aspect ratio of the folder glyph's ink (54×43) — the one landscape shape in a
 * set of portrait pages, which is why a box the two share can only ever be
 * filled by one of them on both axes.
 */
export const FOLDER_GLYPH_ASPECT_RATIO = 54 / 43;

/**
 * The width to draw the folder glyph at so it fills a `width`×`height` slot.
 *
 * The counterpart of `fileIconWidthForBox`, and the same rule read the other way
 * round: a box tall enough for a page leaves the folder room to spread sideways,
 * so sizing it by the height it may fill — rather than by a nominal size the
 * width happens to allow — is what stops a folder reading as the runt of a grid
 * of files.
 */
export function folderGlyphWidthForBox(width: number, height: number): number {
  return Math.floor(Math.min(width, height * FOLDER_GLYPH_ASPECT_RATIO));
}

/**
 * The colour a category badge is drawn in. Always the light half of the pair:
 * the badge sits on the icon's white paper, whatever the theme behind it, so it
 * is the colour the icon generator sized its contrast against.
 */
export function fileIconBadgeColor(token: FileIconColorToken): string {
  return FILE_ICON_COLORS[token][0];
}

/**
 * A file type's colour for anything *other* than the icon — a kind label, a
 * chart series, a tinted chip.
 *
 * `surface` names what that colour is read against, not the app theme: white
 * tiles stay on the light half in dark mode (`'light'`), a primary-filled
 * selected row is the inverse of the current mode (`'inverted'`), and everything
 * else follows the theme (`'theme'`).
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
