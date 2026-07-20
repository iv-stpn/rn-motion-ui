// biome-ignore lint/style/noExcessiveLinesPerFile: file item, icon resolution, upload zone, and progress collocated by design

import { type ReactElement, useCallback, useState } from 'react';
import { type LayoutChangeEvent, Pressable, type StyleProp, Text, View, type ViewStyle } from 'react-native';
import { useReducedMotion } from '../../hooks/use-reduced-motion';
import { EASE_OUT } from '../../lib/ease';
import {
  AlertCircle,
  CheckCircle2,
  FileArchive,
  FileAudio,
  FileCode2,
  FileIcon,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo,
  Loader2,
  RefreshCw,
  UploadCloud,
  X,
} from '../../lib/icons';
import { MotiView } from '../../moti/components/view';
import { AnimatePresence } from '../../moti/presence/animate-presence';

// -- Types -------------------------------------------------------------------

export type FileUploadStatus = 'queued' | 'uploading' | 'success' | 'error';
export type FileUploadVariant = 'default' | 'centered';

export type FileUploadItem = {
  id: string;
  name: string;
  size: number;
  type?: string;
  progress?: number;
  status?: FileUploadStatus;
  error?: string;
};

// biome-ignore lint/style/useExportsLast: props type before internal constants — collocated for readability
export type FileUploadProps = {
  value?: FileUploadItem[];
  defaultValue?: FileUploadItem[];
  onValueChange?: (items: FileUploadItem[]) => void;
  /** On RN, `files` is always [] (no File API). Consumer handles file picking. */
  onFilesAdded?: (items: FileUploadItem[]) => void;
  onRemove?: (item: FileUploadItem) => void;
  onRetry?: (item: FileUploadItem) => void;
  maxFiles?: number;
  disabled?: boolean;
  variant?: FileUploadVariant;
  title?: string;
  description?: string;
  browseLabel?: string;
  /** Web className passthrough — no-op on native (kept for API parity). */
  className?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

// -- Constants ---------------------------------------------------------------

const ROW_TRANSITION = { type: 'timing', duration: 220, easing: EASE_OUT } as const;
const FAST_TRANSITION = { type: 'timing', duration: 160, easing: EASE_OUT } as const;
const FILE_META_SEPARATOR = ' · ';

const STATUS_LABEL: Record<FileUploadStatus, string> = {
  queued: 'Queued',
  uploading: 'Uploading',
  success: 'Uploaded',
  error: 'Failed',
};

// -- Helpers -----------------------------------------------------------------

function clampProgress(value: number | undefined, status: FileUploadStatus) {
  if (status === 'success') return 100;
  if (value === undefined || Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;
  return `${value >= 10 || exponent === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[exponent]}`;
}

function fileKind(item: FileUploadItem) {
  const ext = item.name.includes('.') ? item.name.split('.').pop() : undefined;
  if (ext) return ext.toUpperCase();
  if (item.type) return item.type.split('/').pop()?.toUpperCase();
  return 'FILE';
}

type IconComponentProps = { size: number; color: string };
type IconComponent = (props: IconComponentProps) => ReactElement | null;

function getFileIcon(item: FileUploadItem): IconComponent {
  const ext = item.name.includes('.') ? item.name.split('.').pop()?.toLowerCase() : undefined;
  const type = item.type ?? '';

  if (type.startsWith('image/')) return FileImage;
  if (type.startsWith('video/')) return FileVideo;
  if (type.startsWith('audio/')) return FileAudio;
  if (type.includes('zip') || type.includes('compressed') || ['zip', 'rar', '7z', 'tar', 'gz'].includes(ext ?? ''))
    return FileArchive;
  if (type.includes('spreadsheet') || type.includes('excel') || ['csv', 'xls', 'xlsx'].includes(ext ?? ''))
    return FileSpreadsheet;
  if (type.includes('pdf') || type.startsWith('text/') || ['pdf', 'doc', 'docx', 'md', 'txt'].includes(ext ?? ''))
    return FileText;
  if (['css', 'html', 'js', 'jsx', 'json', 'mdx', 'ts', 'tsx', 'xml', 'yaml', 'yml'].includes(ext ?? '')) return FileCode2;
  return FileIcon;
}

// -- Controllable state hook -------------------------------------------------

type useControllableUploadParams = {
  value?: FileUploadItem[];
  defaultValue?: FileUploadItem[];
  onValueChange?: (items: FileUploadItem[]) => void;
};

function useControllableUpload({ value, defaultValue, onValueChange }: useControllableUploadParams) {
  const [internal, setInternal] = useState(defaultValue ?? []);
  const isControlled = value !== undefined;
  const items = value ?? internal;

  const setItems = useCallback(
    (next: FileUploadItem[]) => {
      if (!isControlled) setInternal(next);
      onValueChange?.(next);
    },
    [isControlled, onValueChange],
  );

  return [items, setItems] as const;
}

// -- StatusIcon --------------------------------------------------------------

type StatusIconProps = { status: FileUploadStatus; reduce: boolean };

type StatusIconContentProps = { status: FileUploadStatus; color: string; reduce: boolean };

function StatusIconContent({ status, color, reduce }: StatusIconContentProps) {
  if (status === 'success') return <CheckCircle2 size={16} color={color} />;
  if (status === 'error') return <AlertCircle size={16} color={color} />;
  if (status === 'uploading') {
    return (
      // Spinning loader — moti loop.
      <MotiView
        from={{ rotate: '0deg' }}
        animate={{ rotate: reduce ? '0deg' : '360deg' }}
        transition={{ type: 'timing', duration: 800, loop: !reduce, repeatReverse: false }}
      >
        <Loader2 size={16} color={color} />
      </MotiView>
    );
  }
  return <FileIcon size={16} color={color} />;
}

function StatusIcon({ status, reduce }: StatusIconProps) {
  // Status-specific colours (resolved hex values matching Tailwind tokens).
  const COLOR: Record<FileUploadStatus, string> = {
    queued: '#71717a',
    uploading: '#111111',
    success: '#10b981',
    error: '#e5484d',
  };
  const color = COLOR[status];

  return (
    <AnimatePresence exitBeforeEnter={true}>
      <MotiView
        key={status}
        from={reduce ? { opacity: 0 } : { opacity: 0, translateY: 4 }}
        animate={{ opacity: 1, translateY: 0 }}
        exit={reduce ? { opacity: 0 } : { opacity: 0, translateY: -4 }}
        transition={FAST_TRANSITION}
        style={{ width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }}
        accessibilityLabel={STATUS_LABEL[status]}
      >
        <StatusIconContent status={status} color={color} reduce={reduce} />
      </MotiView>
    </AnimatePresence>
  );
}

// -- ProgressBar -------------------------------------------------------------

type ProgressBarProps = { progress: number; status: FileUploadStatus; reduce: boolean };

function ProgressBar({ progress, status, reduce }: ProgressBarProps) {
  const [barWidth, setBarWidth] = useState(0);
  const handleLayout = useCallback((e: LayoutChangeEvent) => setBarWidth(e.nativeEvent.layout.width), []);
  const ratio = progress / 100;
  // To simulate transform-origin: left via scaleX, we offset translateX by
  // -(barWidth * (1 - ratio) / 2). When ratio=1 offset=0; when ratio=0 the
  // bar is fully outside the left edge (clipped by overflow:hidden).
  const translateX = barWidth > 0 ? -((barWidth * (1 - ratio)) / 2) : 0;
  const barColor = status === 'success' ? '#10b981' : '#18181b';

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(progress) }}
      accessibilityLabel="Upload progress"
      style={{ marginTop: 12, height: 6, borderRadius: 999, overflow: 'hidden', backgroundColor: '#e4e4e7' }}
      onLayout={handleLayout}
    >
      <MotiView
        animate={{ scaleX: ratio, translateX }}
        transition={reduce ? { type: 'timing', duration: 0 } : { type: 'timing', duration: 280, easing: EASE_OUT }}
        style={{ width: '100%', height: '100%', borderRadius: 999, backgroundColor: barColor }}
      />
    </View>
  );
}

// -- FileUploadRow -----------------------------------------------------------

export type FileUploadRowProps = {
  item: FileUploadItem;
  onRemove: (item: FileUploadItem) => void;
  onRetry: (item: FileUploadItem) => void;
};

function FileUploadRow({ item, onRemove, onRetry }: FileUploadRowProps) {
  const reduce = useReducedMotion();
  const status = item.status ?? 'queued';
  const progress = clampProgress(item.progress, status);
  const showProgress = status === 'uploading' || status === 'success';
  const LeadingIcon = getFileIcon(item);
  const handleRetry = useCallback(() => onRetry(item), [onRetry, item]);
  const handleRemove = useCallback(() => onRemove(item), [onRemove, item]);

  return (
    <MotiView
      from={reduce ? { opacity: 0 } : { opacity: 0, translateY: 8 }}
      animate={{ opacity: 1, translateY: 0 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, translateY: -6 }}
      transition={ROW_TRANSITION}
      style={{ overflow: 'hidden', borderRadius: 16 }}
      testID={`file-row-${item.id}`}
    >
      <View className="rounded-2xl border border-border bg-surface p-3">
        <View className="flex-row items-center" style={{ gap: 12 }}>
          {/* Leading icon */}
          <View className="items-center justify-center rounded-xl bg-muted" style={{ width: 44, height: 44, flexShrink: 0 }}>
            <LeadingIcon size={20} color="#71717a" />
          </View>

          {/* Content */}
          <View className="flex-1" style={{ minWidth: 0 }}>
            <View className="flex-row items-start justify-between" style={{ gap: 12 }}>
              {/* Name + meta */}
              <View style={{ minWidth: 0, flex: 1 }}>
                <Text className="font-medium text-foreground text-sm" numberOfLines={1}>
                  {item.name}
                </Text>
                <Text className="text-muted-foreground text-xs" style={{ marginTop: 2 }}>
                  {fileKind(item)}
                  {FILE_META_SEPARATOR}
                  {formatBytes(item.size)}
                  {status === 'error' && item.error ? ` · ${item.error}` : null}
                </Text>
              </View>

              {/* Status icon + actions */}
              <View className="flex-row items-center" style={{ gap: 4, flexShrink: 0 }}>
                <StatusIcon status={status} reduce={Boolean(reduce)} />

                {status === 'error' ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Retry ${item.name}`}
                    onPress={handleRetry}
                    style={{ width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 14 }}
                    testID={`retry-${item.id}`}
                  >
                    <RefreshCw size={14} color="#71717a" />
                  </Pressable>
                ) : null}

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${item.name}`}
                  onPress={handleRemove}
                  style={{ width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 14 }}
                  testID={`remove-${item.id}`}
                >
                  <X size={14} color="#71717a" />
                </Pressable>
              </View>
            </View>

            {showProgress ? <ProgressBar progress={progress} status={status} reduce={Boolean(reduce)} /> : null}
          </View>
        </View>
      </View>
    </MotiView>
  );
}

// -- FileUpload --------------------------------------------------------------

export function FileUpload({
  value,
  defaultValue,
  onValueChange,
  onFilesAdded,
  onRemove,
  onRetry,
  maxFiles,
  disabled = false,
  variant = 'default',
  title = 'Drop files here',
  description = 'Add files to the upload queue',
  browseLabel = 'Browse',
  style,
  testID,
}: FileUploadProps) {
  const reduce = useReducedMotion();
  const [items, setItems] = useControllableUpload({ value, defaultValue, onValueChange });
  const [pressed, setPressed] = useState(false);

  const maxReached = maxFiles !== undefined && items.length >= maxFiles;
  const centered = variant === 'centered';
  const isDisabled = disabled || maxReached;

  const removeItem = useCallback(
    (item: FileUploadItem) => {
      setItems(items.filter((entry) => entry.id !== item.id));
      onRemove?.(item);
    },
    [items, setItems, onRemove],
  );

  const retryItem = useCallback(
    (item: FileUploadItem) => {
      const retrying: FileUploadItem = { ...item, error: undefined, progress: 0, status: 'uploading' };
      setItems(items.map((entry) => (entry.id === item.id ? retrying : entry)));
      onRetry?.(retrying);
    },
    [items, setItems, onRetry],
  );

  // On RN there is no drag-and-drop or File API. The browse button calls
  // onFilesAdded with an empty items list — consumers handle their own file
  // picking (e.g. via expo-document-picker) and pass items via value/defaultValue.
  const handleBrowsePress = useCallback(() => {
    if (isDisabled) return;
    onFilesAdded?.([]);
  }, [isDisabled, onFilesAdded]);

  const handlePressIn = useCallback(() => setPressed(true), []);
  const handlePressOut = useCallback(() => setPressed(false), []);

  const dropzoneContent = centered ? (
    // Centered variant: icon stacked above text + browse button.
    <>
      <MotiView
        animate={reduce ? undefined : { translateY: pressed ? -2 : 0 }}
        transition={FAST_TRANSITION}
        className="items-center justify-center rounded-[22px] border border-border bg-muted"
        style={{ width: 64, height: 64 }}
      >
        <UploadCloud size={28} color="#18181b" />
      </MotiView>

      <View style={{ alignItems: 'center', maxWidth: 280, marginTop: 12 }}>
        {/* biome-ignore lint/suspicious/noLeakedRender: both branches are string literals — no numeric leak */}
        <Text className="font-semibold text-base text-foreground">{maxReached ? 'Upload limit reached' : title}</Text>
        <Text className="text-muted-foreground text-xs" style={{ marginTop: 4, textAlign: 'center', lineHeight: 20 }}>
          {/* biome-ignore lint/suspicious/noLeakedRender: both branches are string literals — no numeric leak */}
          {maxReached ? `${items.length} of ${maxFiles} files added` : description}
        </Text>
      </View>

      <View className="rounded-full border border-border" style={{ marginTop: 12, paddingHorizontal: 16, paddingVertical: 8 }}>
        <Text className="font-medium text-foreground text-xs">{browseLabel}</Text>
      </View>
    </>
  ) : (
    // Default (row) variant: icon + text inline with browse button on the right.
    <>
      <View className="items-center justify-center rounded-[20px] bg-muted" style={{ width: 56, height: 56 }}>
        <UploadCloud size={24} color="#18181b" />
      </View>

      <View style={{ flex: 1, minWidth: 0, marginLeft: 16 }}>
        {/* biome-ignore lint/suspicious/noLeakedRender: both branches are string literals — no numeric leak */}
        <Text className="font-semibold text-foreground text-sm">{maxReached ? 'Upload limit reached' : title}</Text>
        <Text className="text-muted-foreground text-xs" style={{ marginTop: 2 }}>
          {/* biome-ignore lint/suspicious/noLeakedRender: both branches are string literals — no numeric leak */}
          {maxReached ? `${items.length} of ${maxFiles} files added` : description}
        </Text>
      </View>

      <View className="rounded-full border border-border" style={{ flexShrink: 0, paddingHorizontal: 14, paddingVertical: 8 }}>
        <Text className="font-medium text-foreground text-xs">{browseLabel}</Text>
      </View>
    </>
  );

  return (
    <View testID={testID ?? 'file-upload'} style={[{ width: '100%', gap: 12 }, style]}>
      {/* Dropzone / browse button */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={maxReached ? 'Upload limit reached' : title}
        aria-disabled={isDisabled}
        disabled={isDisabled}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handleBrowsePress}
        style={{ opacity: isDisabled ? 0.55 : 1 }}
      >
        <View
          className="w-full overflow-hidden rounded-3xl border border-border border-dashed bg-surface"
          style={[
            centered
              ? {
                  minHeight: 224,
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingHorizontal: 28,
                  paddingVertical: 28,
                }
              : { flexDirection: 'row', alignItems: 'center', padding: 20 },
          ]}
        >
          {dropzoneContent}
        </View>
      </Pressable>

      {/* Upload queue */}
      <View style={{ gap: 8 }}>
        <AnimatePresence>
          {items.map((item) => (
            <FileUploadRow key={item.id} item={item} onRemove={removeItem} onRetry={retryItem} />
          ))}
        </AnimatePresence>
      </View>
    </View>
  );
}
