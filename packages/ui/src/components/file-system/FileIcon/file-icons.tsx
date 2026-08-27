// Render layer for the file-system glyphs: the gradient folder icon and the
// colour-resolved file-type icon. All are react-native-svg so they draw
// identically on native and react-native-web.
//
// File-type icons are either a tintable category badge drawn over the shared
// paper (the empty file, itself vector art), or a fixed-colour brand logo (PDF,
// MS Office, Flash, AI, Video) drawn full-bleed with no paper.

import { type ComponentType, useId } from 'react';
import { useColorScheme } from 'react-native';
import Svg, { Defs, G, LinearGradient, Path, Stop, Text as SvgText } from 'react-native-svg';
import {
  FILE_BADGE_TRANSFORM,
  type FileIconBrand,
  type FileIconCategory,
  type FileIconColorToken,
  FOLDER_GLYPH_ASPECT_RATIO,
  fileIconAspectRatio,
  fileIconBadgeColor,
  fileIconColor,
  isFileIconBrand,
  resolveFileIcon,
} from './file-icon';
import {
  File3dBadge,
  FileAiGlyph,
  FileApkBadge,
  FileArchiveBadge,
  FileAudioBadge,
  FileCertificateBadge,
  FileCodeBadge,
  FileConfigBadge,
  FileDatabaseBadge,
  FileDiskImageBadge,
  FileDocumentBadge,
  FileExcelGlyph,
  FileExecutableBadge,
  FileFlashGlyph,
  FileFontBadge,
  FileImageBadge,
  FileLibraryBadge,
  FileOneNoteGlyph,
  FilePaperGlyph,
  FilePdfGlyph,
  FilePowerPointGlyph,
  FileScriptBadge,
  FileTerminalBadge,
  FileVideoGlyph,
  FileWordGlyph,
} from './file-icon-glyphs';
import { FILE_EXTENSION_LABEL_COLOR, fileExtensionLabel } from './file-icon-label';
import { FILE_PAPER_INK } from './file-icon-metrics';

/** Tintable category badges — drawn over the paper, in their file type's colour. */
const CATEGORY_BADGES: Record<FileIconCategory, ComponentType<{ color: string }>> = {
  FileAudio: FileAudioBadge,
  FileApk: FileApkBadge,
  FileArchive: FileArchiveBadge,
  FileCertificate: FileCertificateBadge,
  FileCode: FileCodeBadge,
  FileConfig: FileConfigBadge,
  FileDatabase: FileDatabaseBadge,
  FileDiskImage: FileDiskImageBadge,
  FileDocument: FileDocumentBadge,
  FileExecutable: FileExecutableBadge,
  FileFont: FileFontBadge,
  FileImage: FileImageBadge,
  FileLibrary: FileLibraryBadge,
  FileScript: FileScriptBadge,
  FileTerminal: FileTerminalBadge,
  File3d: File3dBadge,
};

/** Fixed-colour brand logos — drawn full-bleed, no paper, no tinting. */
const BRAND_GLYPHS: Record<FileIconBrand, ComponentType<{ width: number; height: number }>> = {
  FilePdf: FilePdfGlyph,
  FileWord: FileWordGlyph,
  FileExcel: FileExcelGlyph,
  FilePowerPoint: FilePowerPointGlyph,
  FileOneNote: FileOneNoteGlyph,
  FileFlash: FileFlashGlyph,
  FileAi: FileAiGlyph,
  FileVideo: FileVideoGlyph,
};

/**
 * The back plane: the tab along the top-left, then the full body behind the
 * front panel. Corner radii are deliberately tight (4 at the tab, 3.5 at the
 * top-right, 5 at the base) — a softer folder reads as a generic blob at the
 * 16–20px sizes the list views draw it at.
 */
const FOLDER_BACK_PATH =
  'M5 8c0-2.21 1.79-4 4-4h12.9c1.5 0 2.94.66 3.92 1.8l1.63 1.9a3 3 0 0 0 2.27 1.05H55.5c1.93 0 3.5 1.57 3.5 3.5V42c0 2.76-2.24 5-5 5H10c-2.76 0-5-2.24-5-5V8Z';

/**
 * The front panel. Its top corners are rounded too, so the back plane shows
 * through as two small notches either side of the lip — that gap is what makes
 * the two faces read as separate planes rather than one flat shape.
 */
const FOLDER_FRONT_PATH =
  'M8.5 15.5h47c1.93 0 3.5 1.57 3.5 3.5V42c0 2.76-2.24 5-5 5H10c-2.76 0-5-2.24-5-5V19c0-1.93 1.57-3.5 3.5-3.5Z';

/**
 * The sheet in a non-empty folder, drawn between the two planes so it is only
 * visible where it overshoots the lip. Its lower half is squared off and runs
 * past y=15.5 on purpose: the front panel covers it, so only the rounded top
 * edge is ever seen.
 */
const FOLDER_PAPER_PATH = 'M17 11.5h30c1.66 0 3 1.34 3 3V18H14v-3.5c0-1.66 1.34-3 3-3Z';

/**
 * The page, cropped to its ink: the paper is drawn in a square canvas but the
 * sheet only covers a portrait slice of it, so drawing through the wider canvas
 * is what used to leave a page looking small beside a full-bleed PDF logo at the
 * same nominal size. The shadow is inside the box, so nothing is clipped.
 */
const PAPER_VIEW_BOX = `${FILE_PAPER_INK.x} ${FILE_PAPER_INK.y} ${FILE_PAPER_INK.width} ${FILE_PAPER_INK.height}`;

/** Which surface a file-type colour is read against — drives which half of the pair wins. */
export type FileIconSurface = 'theme' | 'light' | 'inverted';

/** Whether the folder is drawn holding a sheet of paper. */
export type FileSystemFolderVariant = 'empty' | 'filled';

export type FileSystemFolderGlyphProps = {
  /** Glyph width in px. Height follows the 54:43 aspect ratio. */
  size?: number;
  /**
   * `'filled'` tucks a sheet of paper behind the front panel, so a folder with
   * contents is distinguishable from an empty one at a glance. Defaults to
   * `'empty'` — the caller knows whether the folder has children, the glyph
   * does not.
   */
  variant?: FileSystemFolderVariant;
};

/**
 * The macOS-style two-tone folder. Back and front faces each carry their own
 * vertical gradient, so the lip reads as a separate plane.
 */
export function FileSystemFolderGlyph({ size = 64, variant = 'empty' }: FileSystemFolderGlyphProps) {
  // Gradient ids must be unique per mounted glyph — a grid of folders would
  // otherwise all resolve `url(#…)` to whichever instance rendered last.
  const backId = useId();
  const frontId = useId();
  const paperId = useId();

  return (
    <Svg height={size / FOLDER_GLYPH_ASPECT_RATIO} viewBox="5 4 54 43" width={size}>
      <Defs>
        <LinearGradient id={backId} x1="0" x2="0" y1="0" y2="1">
          <Stop offset="0" stopColor="#3dabf5" />
          <Stop offset="1" stopColor="#1d84dd" />
        </LinearGradient>
        <LinearGradient id={frontId} x1="0" x2="0" y1="0" y2="1">
          <Stop offset="0" stopColor="#7accfb" />
          <Stop offset="1" stopColor="#37a0ef" />
        </LinearGradient>
        <LinearGradient id={paperId} x1="0" x2="0" y1="0" y2="1">
          <Stop offset="0" stopColor="#ffffff" />
          <Stop offset="1" stopColor="#e3ebf4" />
        </LinearGradient>
      </Defs>
      <Path d={FOLDER_BACK_PATH} fill={`url(#${backId})`} />
      {variant === 'filled' && <Path d={FOLDER_PAPER_PATH} fill={`url(#${paperId})`} />}
      <Path d={FOLDER_FRONT_PATH} fill={`url(#${frontId})`} />
    </Svg>
  );
}

export type FileTypeIconProps = {
  /** File name (or a synthesized `file.<ext>`) the icon is resolved from. */
  fileName: string;
  /**
   * Drawn width in px — the same for every file type, which is what puts a row
   * of mixed icons on one vertical edge. The height is the glyph's own: a page
   * comes out taller than the square PDF logo next to it, as it should.
   */
  size?: number;
  /**
   * Overrides the aspect-derived height. When set, the glyph is stretched into
   * this exact box rather than keeping its natural width:height ratio — used
   * where the height is decided by the layout (e.g. a fraction of a row), not
   * by the file type.
   */
  height?: number;
  /** Overrides the resolved badge colour (e.g. a muted toolbar icon). */
  color?: string;
};

/**
 * The icon for a file name: a tinted category badge on the paper, or a brand
 * logo drawn full-bleed. Both carry their own colours, so the icon reads the
 * same on any surface — it is a picture of a file, not a themed symbol.
 */
export function FileTypeIcon({ color, fileName, height: heightProp, size = 16 }: FileTypeIconProps) {
  const { name, token } = resolveFileIcon(fileName);
  const height = heightProp ?? size / fileIconAspectRatio(name);

  if (isFileIconBrand(name)) {
    const Glyph = BRAND_GLYPHS[name];
    return <Glyph height={height} width={size} />;
  }

  const Badge = CATEGORY_BADGES[name];
  // Printed on the page under the badge, as macOS does it — and only when the
  // icon is drawn big enough to read it, which is `null` at list-row sizes.
  const label = fileExtensionLabel(fileName, size, height);
  return (
    // The paper draws at its own coordinates and the viewBox — not a transform —
    // does the cropping. The badge is the one that needs moving: it is authored
    // against the older, larger template the paper replaced.
    <Svg height={height} viewBox={PAPER_VIEW_BOX} width={size}>
      <FilePaperGlyph />
      <G transform={FILE_BADGE_TRANSFORM}>
        <Badge color={color ?? fileIconBadgeColor(token)} />
      </G>
      {label && (
        // `system-ui` is the OS UI font on web and an unknown family on native,
        // where it falls back to the same one — so the label is set in the
        // platform's own face either way, as the icon it imitates is.
        <SvgText
          fill={FILE_EXTENSION_LABEL_COLOR}
          fontFamily="system-ui"
          fontSize={label.fontSize}
          fontWeight="bold"
          letterSpacing={label.letterSpacing}
          textAnchor="middle"
          x={label.x}
          y={label.y}
        >
          {label.text}
        </SvgText>
      )}
    </Svg>
  );
}

/**
 * A file type's colour for anything the icon does not draw itself — a kind
 * label, a tinted chip — resolved against the current scheme.
 */
// biome-ignore lint/style/useComponentExportOnlyModules: the colour resolver belongs with the palette the icons are drawn from, so the two cannot drift
export function useFileIconColor(token: FileIconColorToken, surface: FileIconSurface = 'theme'): string {
  const isDark = useColorScheme() === 'dark';
  return fileIconColor(token, isDark, surface);
}
