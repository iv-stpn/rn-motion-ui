// Render layer for the file-system glyphs: the gradient folder icon and the
// colour-resolved file-type icon. Both are react-native-svg so they draw
// identically on native and react-native-web.

import { useId } from 'react';
import { useColorScheme } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { FileTreeIcon } from '../FileTree/file-tree-icons';
import { type FileIconColorToken, fileIconColor, resolveFileIcon } from './file-system-icon';

/** Aspect ratio of the folder glyph's 64×50 viewBox. */
const FOLDER_ASPECT_RATIO = 64 / 50;

/** Which surface an icon sits on — drives which half of the colour pair wins. */
export type FileIconSurface = 'theme' | 'light' | 'inverted';

export type FileSystemFolderGlyphProps = {
  /** Glyph width in px. Height follows the 64:50 aspect ratio. */
  size?: number;
};

/**
 * The macOS-style two-tone folder. Back and front faces each carry their own
 * vertical gradient, so the lip reads as a separate plane.
 */
export function FileSystemFolderGlyph({ size = 64 }: FileSystemFolderGlyphProps) {
  // Gradient ids must be unique per mounted glyph — a grid of folders would
  // otherwise all resolve `url(#…)` to whichever instance rendered last.
  const backId = useId();
  const frontId = useId();

  return (
    <Svg height={size / FOLDER_ASPECT_RATIO} viewBox="0 0 64 50" width={size}>
      <Defs>
        <LinearGradient id={backId} x1="0" x2="0" y1="0" y2="1">
          <Stop offset="0" stopColor="#3dabf5" />
          <Stop offset="1" stopColor="#1d84dd" />
        </LinearGradient>
        <LinearGradient id={frontId} x1="0" x2="0" y1="0" y2="1">
          <Stop offset="0" stopColor="#7accfb" />
          <Stop offset="1" stopColor="#37a0ef" />
        </LinearGradient>
      </Defs>
      <Path
        d="M5 10c0-3.31 2.69-6 6-6h10.9c1.6 0 3.13.7 4.18 1.9l1.5 1.73a3.5 3.5 0 0 0 2.64 1.22H54c2.76 0 5 2.24 5 5V40c0 3.87-3.13 7-7 7H12c-3.87 0-7-3.13-7-7V10Z"
        fill={`url(#${backId})`}
      />
      <Path d="M5 15.5h54V40c0 3.87-3.13 7-7 7H12c-3.87 0-7-3.13-7-7V15.5Z" fill={`url(#${frontId})`} />
    </Svg>
  );
}

export type FileTypeIconProps = {
  /** File name (or a synthesized `file.<ext>`) the icon is resolved from. */
  fileName: string;
  size?: number;
  surface?: FileIconSurface;
  /** Overrides the resolved colour entirely (e.g. a muted toolbar icon). */
  color?: string;
};

/** The colour-resolved icon for a file name. */
export function FileTypeIcon({ color, fileName, size = 16, surface = 'theme' }: FileTypeIconProps) {
  const isDark = useColorScheme() === 'dark';
  const { name, token } = resolveFileIcon(fileName);
  return <FileTreeIcon name={name} size={size} color={color ?? fileIconColor(token, isDark, surface)} />;
}

/** The resolved colour for a token, as a hook (for animated/SVG consumers). */
// biome-ignore lint/style/useComponentExportOnlyModules: the colour resolver belongs with the icons it colours — the scheme lookup is the same one FileTypeIcon does
export function useFileIconColor(token: FileIconColorToken, surface: FileIconSurface = 'theme'): string {
  const isDark = useColorScheme() === 'dark';
  return fileIconColor(token, isDark, surface);
}
