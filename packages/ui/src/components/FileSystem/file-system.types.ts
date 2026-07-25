// Public data model for <FileSystem>. Kept RN-free so the logic modules and
// their unit tests can import it without pulling in the render layer.
//
// Path model (after FileTree): every entry IS its path. Folder paths carry a
// trailing slash, file paths never do, and the empty string is the implicit
// root. Consumers may hand in a flat manifest of files only — missing folder
// prefixes are inferred by `buildFileSystemIndex`.

import type { ReactNode } from 'react';

/** The four Finder-style presentations. */
export type FileSystemView = 'icons' | 'list' | 'columns' | 'gallery';

export type FileSystemFolderItem = {
  kind: 'folder';
  /** Folder prefix, e.g. `'invoices/2026/'`. A trailing slash is added when missing. */
  path: string;
  name?: string;
  parentPath?: string;
  /** Set when children exist but are not in `items` yet; enables `loadChildren`. */
  hasChildren?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type FileSystemFileItem = {
  kind: 'file';
  /** Display/canonical path, e.g. `'invoices/2026/jan.pdf'`. */
  path: string;
  /** Original object key (S3/R2). Defaults to `path`. */
  key?: string;
  name?: string;
  parentPath?: string;
  contentType?: string;
  size?: number;
  createdAt?: string;
  updatedAt?: string;
  etag?: string;
  /** Optional if already public/presigned. Otherwise resolved via `getFileUrl`. */
  url?: string;
  /** Externally generated thumbnail. The component never rasterizes documents itself. */
  previewImageUrl?: string | null;
  /**
   * Externally generated page thumbnails (first entry is the cover). When a file
   * has more than one page, large thumbnails show a pager.
   */
  previewImageUrls?: string[] | null;
  /**
   * Total page count when it exceeds `previewImageUrls.length`; the pager loads
   * the remaining pages on demand via `loadPreviewImageUrl`.
   */
  previewPageCount?: number;
  /** Thumbnail aspect ratio (width / height). Defaults to a portrait page. */
  previewAspectRatio?: number;
  metadata?: Record<string, string>;
};

export type FileSystemItem = FileSystemFolderItem | FileSystemFileItem;

export type FileSystemLoadChildrenArgs = { path: string; cursor: string | null };

export type FileSystemLoadChildrenResult = { items: FileSystemItem[]; nextCursor?: string | null };

/** File classes the built-in viewer knows a layout for. */
export type FileSystemViewerKind = 'docx' | 'image' | 'pdf' | 'pptx' | 'xlsx';

export type FileSystemViewerArgs = { file: FileSystemFileItem; kind: FileSystemViewerKind | null; url: string | null };

/** Columns the entry list can be ordered by. */
export type FileSystemSortKey = 'createdAt' | 'kind' | 'name' | 'size' | 'updatedAt';

export type FileSystemSortDirection = 'asc' | 'desc';

export type FileSystemSortState = { direction: FileSystemSortDirection; key: FileSystemSortKey };

/** Filter facets offered by the toolbar's filter menu. */
export type FileSystemFilterType = 'dateCreated' | 'dateModified' | 'fileType';

export type FileSystemDateFilterType = Exclude<FileSystemFilterType, 'fileType'>;

export type FileSystemFilterOperator = 'after' | 'before' | 'in-range' | 'is' | 'is-any-of' | 'is-not' | 'not-in-range';

export type FileSystemFilter = { id: string; operator: FileSystemFilterOperator; type: FileSystemFilterType; value: string[] };

/** Coarse buckets the file-type checklist groups MIME types under. */
export type FileTypeFilterGroup = 'Documents' | 'Spreadsheets' | 'Images' | 'Code' | 'Text' | 'Archives & binary';

export type FileTypeFilterOption = {
  group: FileTypeFilterGroup;
  /** Sample file name so the option icon reuses the file-type resolver. */
  iconFileName: string;
  label: string;
  mime: string;
};

// ── Internal (resolved) entries ────────────────────────────────────────────
// The index fills in every optional identity field so the render layer never
// has to re-derive a name or a parent path.

export type FolderEntry = FileSystemFolderItem & { name: string; parentPath: string };

export type FileEntry = FileSystemFileItem & { key: string; name: string; parentPath: string };

export type FileSystemEntry = FolderEntry | FileEntry;

export type FileSystemIndex = {
  children: Map<string, FileSystemEntry[]>;
  files: Map<string, FileEntry>;
  folders: Map<string, FolderEntry>;
};

export type FileSystemProps = {
  /** Flat manifest. Folders are optional; missing prefixes are inferred from file paths. */
  items: FileSystemItem[];
  className?: string;
  /** Label for the root folder. */
  title?: string;
  defaultView?: FileSystemView;
  view?: FileSystemView;
  onViewChange?: (view: FileSystemView) => void;
  /** Folder prefix to open initially, e.g. `'invoices/'`. */
  defaultPath?: string;
  onSelectionChange?: (item: FileSystemItem | null) => void;
  /**
   * Called when a file is opened (double-click on web, second tap on native),
   * replacing the built-in behaviour. By default image files open in a viewer
   * modal, and everything else is delegated to `renderFileViewer` when provided.
   */
  onFileOpen?: (file: FileSystemFileItem, url: string | null) => void;
  /** Resolve a URL (e.g. presigned) for a file without one. */
  getFileUrl?: (file: FileSystemFileItem) => string | Promise<string>;
  /** Lazily fetch children for folders with `hasChildren` and no loaded entries. */
  loadChildren?: (args: FileSystemLoadChildrenArgs) => Promise<FileSystemLoadChildrenResult>;
  /** Custom preview node for files without `previewImageUrl`. */
  renderFilePreview?: (file: FileSystemFileItem) => ReactNode;
  /**
   * Document viewer body for the open-file modal and the gallery stage. The
   * component ships no PDF/DOCX/PPTX/XLSX renderers — return one here to make
   * those kinds viewable in place. Images are handled built-in.
   */
  renderFileViewer?: (args: FileSystemViewerArgs) => ReactNode;
  /**
   * Lazily render a page thumbnail beyond the eagerly provided
   * `previewImageUrls` (the pager calls this as pages come into view).
   */
  loadPreviewImageUrl?: (file: FileSystemFileItem, pageIndex: number) => Promise<string | null>;
  /** Fixed viewport height. Defaults to 480. */
  height?: number;
};
