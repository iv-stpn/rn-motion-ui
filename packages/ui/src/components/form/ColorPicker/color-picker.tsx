import { useCallback, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { DownLine as ChevronDown } from 'rn-motion-ui-icons/icons/down-line';
import { useThemeColor } from '../../../theme/use-theme-color';
import { AdaptiveDropdown, type TriggerRenderProps } from '../../menus/AdaptiveDropdown/adaptive-dropdown';
import { Text } from '../../typography/Text/text';
import { type ColorSummary, type Hsv, hexToHsv, parseColor, summarize } from './hsv';
import { HueSlider } from './hue-slider';
import { SaturationPanel } from './saturation-panel';
import { Swatches } from './swatches';

// theme-exempt: the default swatch palette is preset colour data, not a theme token.
const DEFAULT_SWATCHES: readonly string[] = [
  '#ef4444' /* theme-exempt */,
  '#f97316' /* theme-exempt */,
  '#f59e0b' /* theme-exempt */,
  '#22c55e' /* theme-exempt */,
  '#14b8a6' /* theme-exempt */,
  '#06b6d4' /* theme-exempt */,
  '#3b82f6' /* theme-exempt */,
  '#8b5cf6' /* theme-exempt */,
  '#ec4899' /* theme-exempt */,
  '#64748b' /* theme-exempt */,
  '#1f2937' /* theme-exempt */,
  '#ffffff' /* theme-exempt */,
];

const FALLBACK_HSV: Hsv = { h: 0, s: 0, v: 0 };

/** The trigger: a field-like button showing the current colour and its hex. */
function ColorPickerTrigger({
  hex,
  open,
  toggle,
  accessibilityLabel,
}: TriggerRenderProps & { hex: string; accessibilityLabel?: string }) {
  const chevronColor = useThemeColor('muted-foreground');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? 'Choose color'}
      accessibilityState={{ expanded: open }}
      onPress={toggle}
      className="flex-row items-center gap-2.5 rounded-interactive border-[1.5px] border-border bg-surface-3 py-2 pr-2.5 pl-3"
    >
      <View className="h-5 w-5 rounded-[5px] border-[1.5px] border-foreground/20" style={{ backgroundColor: hex }} />
      <Text font="mono" size="sm" className="text-foreground">
        {hex}
      </Text>
      <ChevronDown color={chevronColor} size={14} />
    </Pressable>
  );
}

/** The readout at the top of the panel, so the value stays visible inside the sheet. */
function Preview({ hex, rgb, hsl }: ColorSummary) {
  const detail = `${rgb} · ${hsl}`;
  return (
    <View className="flex-row items-center gap-3">
      <View className="h-9 w-9 rounded-lg border-[1.5px] border-foreground/20" style={{ backgroundColor: hex }} />
      <View className="flex-1 gap-0.5">
        <Text font="mono" size="sm" className="text-foreground">
          {hex}
        </Text>
        <Text font="mono" size="xs" className="text-muted-foreground">
          {detail}
        </Text>
      </View>
    </View>
  );
}

/** What `onChange` / `onComplete` hand back — one object, every representation. */
export type ColorPickerChange = ColorSummary;

export type ColorPickerProps = {
  /** Current color as a hex / `rgb()` / `hsl()` string. Omit to let the picker own its state. */
  value?: string;
  /** Initial color when uncontrolled. @default '#000000' */
  defaultValue?: string;
  /** Fires on every change, including while dragging the panel or slider. */
  onChange?: (color: ColorPickerChange) => void;
  /** Fires once when a drag ends or a swatch is tapped. */
  onComplete?: (color: ColorPickerChange) => void;
  /** Preset colors in the swatch grid. @default a curated 12-color palette */
  swatches?: readonly string[];
  /** Header title inside the panel. */
  title?: string;
  /** Which edge of the trigger the panel aligns to. @default 'start' */
  align?: 'start' | 'end';
  /** Panel width in pixels (wide screen only). */
  width?: number;
  /** When true, the bottom sheet on small screens stretches to full height. @default false */
  fullSheet?: boolean;
  testID?: string;
  accessibilityLabel?: string;
};

/**
 * A colour picker that opens inside an {@link AdaptiveDropdown}: a floating
 * panel on wide screens, a bottom sheet on small ones. The panel composes an
 * HSV saturation/value plane, a hue slider and a preset swatch grid — the same
 * anatomy as `reanimated-color-picker`, rebuilt on the package's own
 * PanResponder + `react-native-svg` primitives so it needs no extra dependency.
 */
export function ColorPicker({
  value,
  defaultValue = '#000000' /* theme-exempt: initial colour value, not a theme token */,
  onChange,
  onComplete,
  swatches = DEFAULT_SWATCHES,
  title,
  align = 'start',
  width,
  fullSheet = false,
  testID,
  accessibilityLabel,
}: ColorPickerProps) {
  const [internal, setInternal] = useState<Hsv>(() => parseColor(value ?? defaultValue) ?? FALLBACK_HSV);
  const controlled = value !== undefined;
  const hsv = controlled ? (parseColor(value) ?? FALLBACK_HSV) : internal;
  const summary = summarize(hsv);

  // The latest HSV in a ref so the drag callbacks below never capture a stale
  // hue: dragging the saturation plane changes only S/V, and the merge must read
  // the hue the *other* control last committed, not whatever this render bound.
  const hsvRef = useRef(hsv);
  hsvRef.current = hsv;

  const commit = useCallback(
    (patch: Partial<Hsv>) => {
      const next = { ...hsvRef.current, ...patch };
      if (!controlled) setInternal(next);
      onChange?.(summarize(next));
    },
    [controlled, onChange],
  );

  const finish = useCallback(
    (patch: Partial<Hsv>) => {
      onComplete?.(summarize({ ...hsvRef.current, ...patch }));
    },
    [onComplete],
  );

  const selectSwatch = useCallback(
    (hex: string) => {
      const next = hexToHsv(hex) ?? FALLBACK_HSV;
      if (!controlled) setInternal(next);
      onChange?.(summarize(next));
      onComplete?.(summarize(next));
    },
    [controlled, onChange, onComplete],
  );

  const onSaturationChange = useCallback((s: number, v: number) => commit({ s, v }), [commit]);
  const onSaturationComplete = useCallback((s: number, v: number) => finish({ s, v }), [finish]);
  const onHueChange = useCallback((h: number) => commit({ h }), [commit]);
  const onHueComplete = useCallback((h: number) => finish({ h }), [finish]);

  const renderTrigger = useCallback(
    (props: TriggerRenderProps) => <ColorPickerTrigger {...props} hex={summary.hex} accessibilityLabel={accessibilityLabel} />,
    [summary.hex, accessibilityLabel],
  );

  const root = testID ?? 'color-picker';

  return (
    <AdaptiveDropdown
      trigger={renderTrigger}
      title={title}
      align={align}
      width={width}
      fullSheet={fullSheet}
      contentClassName="p-4"
      testID={root}
    >
      <View className="gap-4">
        <Preview {...summary} />
        <SaturationPanel
          hue={hsv.h}
          saturation={hsv.s}
          value={hsv.v}
          onChange={onSaturationChange}
          onComplete={onSaturationComplete}
          testID={`${root}-saturation`}
          accessibilityLabel={accessibilityLabel ? `${accessibilityLabel} saturation and brightness` : undefined}
        />
        <HueSlider
          hue={hsv.h}
          onChange={onHueChange}
          onComplete={onHueComplete}
          testID={`${root}-hue`}
          accessibilityLabel={accessibilityLabel ? `${accessibilityLabel} hue` : undefined}
        />
        <Swatches colors={swatches} value={summary.hex} onSelect={selectSwatch} testID={root} />
      </View>
    </AdaptiveDropdown>
  );
}
