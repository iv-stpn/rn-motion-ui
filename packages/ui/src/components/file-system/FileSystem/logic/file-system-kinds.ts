/** biome-ignore-all lint/style/useExportsLast: exported tables and module-private lookup sets interleave by concern */
// Kind labels, MIME inference and viewer routing. Every table is keyed by the
// lowercased extension so a manifest without `contentType` still classifies.

import type {
  FileEntry,
  FileSystemEntry,
  FileSystemFileItem,
  FileSystemViewerKind,
  FileTypeFilterGroup,
} from '../types/file-system.types';
import { fileExtension } from './file-system-paths';

/** Human "Kind" column labels, keyed by extension. */
export const FILE_KIND_LABELS: Record<string, string> = {
  css: 'CSS Stylesheet',
  csv: 'CSV Document',
  doc: 'Word Document',
  docx: 'Word Document',
  gif: 'GIF Image',
  go: 'Go Source',
  jpeg: 'JPEG Image',
  jpg: 'JPEG Image',
  js: 'JavaScript Source',
  json: 'JSON Document',
  jsx: 'JavaScript Source',
  md: 'Markdown Document',
  mdx: 'MDX Document',
  pdf: 'PDF Document',
  png: 'PNG Image',
  ppt: 'PowerPoint Presentation',
  pptx: 'PowerPoint Presentation',
  py: 'Python Script',
  rs: 'Rust Source',
  sh: 'Shell Script',
  sql: 'SQL Script',
  svg: 'SVG Image',
  ts: 'TypeScript Source',
  tsv: 'TSV Document',
  tsx: 'TypeScript Source',
  txt: 'Plain Text',
  webp: 'WebP Image',
  xls: 'Excel Workbook',
  xlsx: 'Excel Workbook',
  yaml: 'YAML Document',
  yml: 'YAML Document',
  zip: 'ZIP Archive',
};

export function fileKindLabel(file: FileEntry): string {
  const byExtension = FILE_KIND_LABELS[fileExtension(file.name)];
  if (byExtension) return byExtension;
  if (file.contentType?.startsWith('image/')) return 'Image';
  return file.contentType ?? 'Document';
}

/**
 * Folders sort under the "Folder" kind alphabetically among the file kinds,
 * like Finder's Kind sort.
 */
export function entryKindLabel(entry: FileSystemEntry): string {
  return entry.kind === 'folder' ? 'Folder' : fileKindLabel(entry);
}

/**
 * MIME types inferred from the extension when a file carries no `contentType`,
 * so the file-type filter can classify every manifest entry.
 */
export const EXTENSION_MIME_TYPES: Record<string, string> = {
  css: 'text/css',
  csv: 'text/csv',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  gif: 'image/gif',
  go: 'text/x-go',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  js: 'text/javascript',
  json: 'application/json',
  jsx: 'text/jsx',
  md: 'text/markdown',
  mdx: 'text/mdx',
  pdf: 'application/pdf',
  png: 'image/png',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  py: 'text/x-python',
  rs: 'text/x-rust',
  sh: 'application/x-sh',
  sql: 'application/sql',
  svg: 'image/svg+xml',
  ts: 'text/x-typescript',
  tsv: 'text/tab-separated-values',
  tsx: 'text/x-typescript',
  txt: 'text/plain',
  webp: 'image/webp',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  yaml: 'text/yaml',
  yml: 'text/yaml',
  zip: 'application/zip',
};

export const FALLBACK_MIME_TYPE = 'application/octet-stream';

/** Below this width the toolbar collapses to the tablet/phone layout. */
export const IPAD_MIN_WIDTH = 768;

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const PPTX_MIME = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Short labels for the file-type filter checklist and its pills. */
export const MIME_TYPE_LABELS: Record<string, string> = {
  [FALLBACK_MIME_TYPE]: 'Binary',
  'application/json': 'JSON',
  'application/msword': 'Word document (legacy)',
  'application/pdf': 'PDF',
  'application/sql': 'SQL',
  'application/vnd.ms-excel': 'Excel workbook (legacy)',
  'application/vnd.ms-powerpoint': 'PowerPoint (legacy)',
  [PPTX_MIME]: 'PowerPoint',
  [XLSX_MIME]: 'Excel workbook',
  [DOCX_MIME]: 'Word document',
  'application/x-sh': 'Shell script',
  'application/zip': 'ZIP archive',
  'image/gif': 'GIF image',
  'image/jpeg': 'JPEG image',
  'image/png': 'PNG image',
  'image/svg+xml': 'SVG image',
  'image/webp': 'WebP image',
  'text/css': 'CSS',
  'text/csv': 'CSV',
  'text/javascript': 'JavaScript',
  'text/jsx': 'JSX',
  'text/markdown': 'Markdown',
  'text/mdx': 'MDX',
  'text/plain': 'Plain text',
  'text/tab-separated-values': 'TSV',
  'text/x-go': 'Go',
  'text/x-python': 'Python',
  'text/x-rust': 'Rust',
  'text/x-typescript': 'TypeScript',
  'text/yaml': 'YAML',
};

export function mimeTypeForFile(file: FileEntry): string {
  return file.contentType ?? EXTENSION_MIME_TYPES[fileExtension(file.name)] ?? FALLBACK_MIME_TYPE;
}

const DOCUMENT_MIMES = new Set(['application/pdf', 'application/msword', 'application/vnd.ms-powerpoint', PPTX_MIME, DOCX_MIME]);

const SPREADSHEET_MIMES = new Set(['application/vnd.ms-excel', XLSX_MIME, 'text/csv', 'text/tab-separated-values']);

const CODE_MIMES = new Set([
  'application/json',
  'application/sql',
  'application/x-sh',
  'text/css',
  'text/javascript',
  'text/jsx',
  'text/x-go',
  'text/x-python',
  'text/x-rust',
  'text/x-typescript',
  'text/yaml',
]);

const TEXT_MIMES = new Set(['text/markdown', 'text/mdx', 'text/plain']);

export function fileTypeFilterGroup(mime: string): FileTypeFilterGroup {
  if (DOCUMENT_MIMES.has(mime)) return 'Documents';
  if (SPREADSHEET_MIMES.has(mime)) return 'Spreadsheets';
  if (mime.startsWith('image/')) return 'Images';
  if (CODE_MIMES.has(mime)) return 'Code';
  if (TEXT_MIMES.has(mime)) return 'Text';
  return 'Archives & binary';
}

const IMAGE_EXTENSIONS = /\.(avif|gif|jpe?g|png|svg|webp)$/;

/**
 * Which viewer layout a file wants, or `null` when nothing can display it.
 * `contentType` wins; otherwise the extension decides.
 */
export function viewerKindForFile(file: FileSystemFileItem): FileSystemViewerKind | null {
  if (file.contentType?.startsWith('image/')) return 'image';
  if (file.contentType === 'application/pdf') return 'pdf';
  if (file.contentType === PPTX_MIME) return 'pptx';

  const name = (file.name ?? file.path).toLowerCase();
  if (name.endsWith('.pdf')) return 'pdf';
  if (name.endsWith('.docx')) return 'docx';
  if (name.endsWith('.pptx')) return 'pptx';
  if (name.endsWith('.xlsx')) return 'xlsx';
  if (IMAGE_EXTENSIONS.test(name)) return 'image';

  return null;
}
