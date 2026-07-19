// biome-ignore lint/style/noExcessiveLinesPerFile: all-in-one scheduler — state, helpers, and rendering are tightly coupled
import { useReducedMotion } from '@rn-motion-ui/hooks/use-reduced-motion';
import { AnimatePresence } from '@rn-motion-ui/moti/presence';
import { MotiView } from '@rn-motion-ui/moti/view';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  type GestureResponderEvent,
  type LayoutChangeEvent,
  Modal,
  Pressable,
  ScrollView,
  type StyleProp,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { CONTENT_TRANSITION, SPRING_LAYOUT, SPRING_PRESS } from '../../lib/ease';
import { Check, Copy, Plus, X } from '../../lib/icons';
import { Checkbox } from '../Checkbox/checkbox';
import { Switch } from '../Switch/switch';
import { WheelPicker } from '../WheelPicker/wheel-picker';

// ─── types (re-exported) ───────────────────────────────────────────────────

const LABEL_SELECT_TIME = 'Select time';
const LABEL_CANCEL = 'Cancel';
const LABEL_DONE = 'Done';
const LABEL_COPY_TIMES_TO = 'Copy times to';
const LABEL_EVERY_DAY = 'Every day';
const LABEL_APPLY = 'Apply';
const LABEL_SEPARATOR = '–';
const LABEL_UNAVAILABLE = 'Unavailable';

export type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
export type TimeRange = { id: string; start: string; end: string };
export type DayAvailability = { enabled: boolean; ranges: TimeRange[] };
export type WeekAvailability = Record<DayKey, DayAvailability>;

// biome-ignore lint/style/useExportsLast: props type before time helper functions — collocated for readability
export type AvailabilitySchedulerProps = {
  value?: WeekAvailability;
  defaultValue?: WeekAvailability;
  onChange?: (value: WeekAvailability) => void;
  /** Minutes between selectable times. Default 30. */
  step?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

// ─── time helpers ──────────────────────────────────────────────────────────

const toMinutes = (v: string) => {
  const [h, m] = v.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

const toValue = (mins: number) => {
  const clamped = Math.max(0, Math.min(24 * 60 - 1, mins));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

// biome-ignore lint/style/useComponentExportOnlyModules: label12 is a formatting utility exported alongside the component for consumers; extracting it would fracture the public API
export const label12 = (v: string) => {
  const [h, m] = v.split(':').map(Number);
  const ap = (h ?? 0) < 12 ? 'AM' : 'PM';
  const h12 = (h ?? 0) % 12 === 0 ? 12 : (h ?? 0) % 12;
  return `${h12}:${String(m ?? 0).padStart(2, '0')} ${ap}`;
};

type TimeOption = { value: string; label: string };

// biome-ignore lint/style/useComponentExportOnlyModules: buildOptions is a utility exported alongside the component for consumers to generate time picker options; extracting it to a separate file would fracture the public API of this component
export function buildOptions(step: number): TimeOption[] {
  const out: TimeOption[] = [];
  for (let m = 0; m < 24 * 60; m += step) {
    const value = toValue(m);
    out.push({ value, label: label12(value) });
  }
  return out;
}

const WEEKDAYS: { key: DayKey; label: string }[] = [
  { key: 'mon', label: 'Monday' },
  { key: 'tue', label: 'Tuesday' },
  { key: 'wed', label: 'Wednesday' },
  { key: 'thu', label: 'Thursday' },
  { key: 'fri', label: 'Friday' },
  { key: 'sat', label: 'Saturday' },
  { key: 'sun', label: 'Sunday' },
];

/** Default: Mon–Fri 9–5, weekend off. */
// biome-ignore lint/style/useComponentExportOnlyModules: defaultWeek is a utility factory exported with the component so consumers can seed the scheduler without importing from a separate module
export function defaultWeek(): WeekAvailability {
  const workday = (day: DayKey): DayAvailability => ({
    enabled: true,
    ranges: [{ id: `${day}-0`, start: '09:00', end: '17:00' }],
  });
  const off = (day: DayKey): DayAvailability => ({
    enabled: false,
    ranges: [{ id: `${day}-0`, start: '09:00', end: '17:00' }],
  });
  return {
    mon: workday('mon'),
    tue: workday('tue'),
    wed: workday('wed'),
    thu: workday('thu'),
    fri: workday('fri'),
    sat: off('sat'),
    sun: off('sun'),
  };
}

// Stop touch propagation so taps inside the sheet don't dismiss it.
const stopPropagation = (e: GestureResponderEvent) => e.stopPropagation();

// ─── TimePickerModal ───────────────────────────────────────────────────────

function TimePickerModal({
  visible,
  value,
  options,
  onSelect,
  onClose,
}: {
  visible: boolean;
  value: string;
  options: TimeOption[];
  onSelect: (v: string) => void;
  onClose: () => void;
}) {
  const [pending, setPending] = useState(value);

  // Reset pending selection when modal opens with a new value
  const onShow = useCallback(() => setPending(value), [value]);

  const wheelOptions = useMemo(() => options.map((o) => ({ label: o.label, value: o.value })), [options]);

  const handleDone = useCallback(() => {
    onSelect(pending);
    onClose();
  }, [onSelect, pending, onClose]);

  return (
    <Modal visible={visible} transparent={true} animationType="slide" onShow={onShow} onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }} onPress={onClose}>
        <View>
          <Pressable onPress={stopPropagation}>
            <View className="rounded-t-3xl bg-card" style={{ paddingBottom: 16 }}>
              {/* Handle bar */}
              <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 4 }}>
                <View className="bg-border" style={{ width: 36, height: 4, borderRadius: 2 }} />
              </View>

              <Text className="text-center font-semibold text-base text-foreground" style={{ paddingVertical: 8 }}>
                {LABEL_SELECT_TIME}
              </Text>

              <View style={{ paddingHorizontal: 48, paddingVertical: 8 }}>
                <WheelPicker options={wheelOptions} value={pending} onValueChange={setPending} visibleCount={5} itemHeight={44} />
              </View>

              <View style={{ flexDirection: 'row', gap: 12, paddingHorizontal: 24, paddingTop: 8 }}>
                <Pressable
                  accessibilityRole="button"
                  onPress={onClose}
                  className="flex-1 items-center justify-center rounded-full border border-border bg-card"
                  style={{ height: 44 }}
                >
                  <Text className="font-medium text-foreground text-sm">{LABEL_CANCEL}</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={handleDone}
                  className="flex-1 items-center justify-center rounded-full bg-primary"
                  style={{ height: 44 }}
                >
                  <Text className="font-medium text-primary-foreground text-sm">{LABEL_DONE}</Text>
                </Pressable>
              </View>
            </View>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

// ─── TimeButton ────────────────────────────────────────────────────────────

function TimeButton({
  value,
  options,
  onChange,
  testID,
}: {
  value: string;
  options: TimeOption[];
  onChange: (v: string) => void;
  testID?: string;
}) {
  const [open, setOpen] = useState(false);
  const openModal = useCallback(() => setOpen(true), []);
  const closeModal = useCallback(() => setOpen(false), []);
  return (
    <>
      <Pressable
        accessibilityRole="button"
        testID={testID}
        onPress={openModal}
        className="items-center justify-center rounded-lg border border-border bg-card"
        style={{ height: 36, paddingHorizontal: 10, minWidth: 96 }}
      >
        <Text className="text-foreground text-sm" style={{ fontVariant: ['tabular-nums'] }}>
          {label12(value)}
        </Text>
      </Pressable>
      <TimePickerModal visible={open} value={value} options={options} onSelect={onChange} onClose={closeModal} />
    </>
  );
}

// ─── CopyModal ─────────────────────────────────────────────────────────────

function CopyDayCheckbox({
  day,
  label,
  checked,
  onToggle,
}: {
  day: DayKey;
  label: string;
  checked: boolean;
  onToggle: (day: DayKey) => void;
}) {
  const handleToggle = useCallback(() => onToggle(day), [onToggle, day]);
  return <Checkbox checked={checked} onCheckedChange={handleToggle} label={label} />;
}

function CopyModal({
  visible,
  fromLabel,
  onApply,
  onClose,
}: {
  visible: boolean;
  fromLabel: string;
  onApply: (targets: DayKey[]) => void;
  onClose: () => void;
}) {
  const [picked, setPicked] = useState<Set<DayKey>>(new Set());
  const others = useMemo(() => WEEKDAYS.filter((d) => d.label !== fromLabel), [fromLabel]);

  const toggle = useCallback((k: DayKey) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  }, []);

  const apply = useCallback(
    (targets: DayKey[]) => {
      if (!targets.length) return;
      onApply(targets);
      setPicked(new Set());
      onClose();
    },
    [onApply, onClose],
  );

  const applyEveryDay = useCallback(() => apply(others.map((d) => d.key)), [apply, others]);
  const applyPicked = useCallback(() => apply([...picked]), [apply, picked]);

  return (
    <Modal visible={visible} transparent={true} animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }} onPress={onClose}>
        <View>
          <Pressable onPress={stopPropagation}>
            <View className="rounded-t-3xl bg-card" style={{ paddingBottom: 20, paddingHorizontal: 20 }}>
              <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 4 }}>
                <View className="bg-border" style={{ width: 36, height: 4, borderRadius: 2 }} />
              </View>

              <Text className="py-2 font-medium text-muted-foreground text-sm">{LABEL_COPY_TIMES_TO}</Text>

              {others.map((d) => (
                <CopyDayCheckbox key={d.key} day={d.key} label={d.label} checked={picked.has(d.key)} onToggle={toggle} />
              ))}

              <View style={{ flexDirection: 'row', gap: 12, paddingTop: 16 }}>
                <Pressable
                  accessibilityRole="button"
                  onPress={applyEveryDay}
                  className="flex-1 items-center justify-center rounded-full border border-border bg-card"
                  style={{ height: 44 }}
                >
                  <Text className="font-medium text-muted-foreground text-xs">{LABEL_EVERY_DAY}</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={applyPicked}
                  disabled={picked.size === 0}
                  className="flex-1 items-center justify-center rounded-full bg-primary"
                  style={{ height: 44, opacity: picked.size === 0 ? 0.4 : 1 }}
                >
                  <Text className="font-semibold text-primary-foreground text-xs">{LABEL_APPLY}</Text>
                </Pressable>
              </View>
            </View>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

// ─── RangeRow ──────────────────────────────────────────────────────────────

function RangeRow({
  range,
  options,
  reduce,
  onUpdate,
  onRemove,
}: {
  range: TimeRange;
  options: TimeOption[];
  reduce: boolean;
  onUpdate: (id: string, patch: Partial<TimeRange>) => void;
  onRemove: (id: string) => void;
}) {
  const handleStartChange = useCallback((v: string) => onUpdate(range.id, { start: v }), [onUpdate, range.id]);
  const handleEndChange = useCallback((v: string) => onUpdate(range.id, { end: v }), [onUpdate, range.id]);
  const handleRemove = useCallback(() => onRemove(range.id), [onRemove, range.id]);

  return (
    <MotiView
      from={reduce ? { opacity: 0 } : { opacity: 0, translateX: -8 }}
      animate={{ opacity: 1, translateX: 0 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, translateX: -8 }}
      transition={SPRING_LAYOUT}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
    >
      <TimeButton value={range.start} options={options} onChange={handleStartChange} testID={`time-start-${range.id}`} />
      <Text className="text-muted-foreground text-sm">{LABEL_SEPARATOR}</Text>
      <TimeButton value={range.end} options={options} onChange={handleEndChange} testID={`time-end-${range.id}`} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Remove time range"
        onPress={handleRemove}
        className="h-8 w-8 items-center justify-center rounded-lg"
      >
        <X size={16} color="#6b7280" />
      </Pressable>
    </MotiView>
  );
}

// ─── DayRow ────────────────────────────────────────────────────────────────

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: time-range drag logic requires branching across all edge cases
// biome-ignore lint/complexity/noExcessiveLinesPerFunction: time-range drag logic — each branch handles a distinct interaction state
function DayRow({
  day,
  label,
  state,
  options,
  reduce,
  onChange,
  onCopy,
}: {
  day: DayKey;
  label: string;
  state: DayAvailability;
  options: TimeOption[];
  reduce: boolean;
  onChange: (day: DayKey, next: DayAvailability) => void;
  onCopy: (day: DayKey, targets: DayKey[]) => void;
}) {
  const idRef = useRef(0);
  const nextId = useCallback(() => {
    const n = idRef.current;
    idRef.current += 1;
    return `${day}-n${n}`;
  }, [day]);
  const [copyOpen, setCopyOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const emitChange = useCallback((next: DayAvailability) => onChange(day, next), [onChange, day]);
  const emitCopy = useCallback((targets: DayKey[]) => onCopy(day, targets), [onCopy, day]);

  // Natural height of the body (ranges or the "Unavailable" label), measured
  // offscreen so the visible clip has an explicit target to spring toward.
  const [bodyHeight, setBodyHeight] = useState<number | null>(null);
  // Skip the spring on the very first measure so pre-enabled rows render at
  // their height instead of unfurling from 0 on mount. `readyRef` flips one
  // commit *after* the first height lands, so that first change stays instant.
  const readyRef = useRef(false);
  // biome-ignore lint/plugin: arming the spring one commit after the first height measurement requires a side effect — setting readyRef during render would fire too early
  useEffect(() => {
    if (bodyHeight !== null) readyRef.current = true;
  }, [bodyHeight]);
  const onBodyLayout = useCallback((e: LayoutChangeEvent) => {
    setBodyHeight(e.nativeEvent.layout.height);
  }, []);

  const setEnabled = useCallback(
    (enabled: boolean) => {
      if (enabled && state.ranges.length === 0) emitChange({ enabled, ranges: [{ id: nextId(), start: '09:00', end: '17:00' }] });
      else emitChange({ ...state, enabled });
    },
    [emitChange, nextId, state],
  );

  const updateRange = useCallback(
    (id: string, patch: Partial<TimeRange>) => {
      emitChange({ ...state, ranges: state.ranges.map((r) => (r.id === id ? { ...r, ...patch } : r)) });
    },
    [emitChange, state],
  );

  const addRange = useCallback(() => {
    const last = state.ranges.at(-1);
    const start = last ? Math.min(toMinutes(last.end) + 60, 24 * 60 - 60) : 540;
    emitChange({
      enabled: true,
      ranges: [...state.ranges, { id: nextId(), start: toValue(start), end: toValue(start + 60) }],
    });
  }, [emitChange, nextId, state]);

  const removeRange = useCallback(
    (id: string) => {
      const ranges = state.ranges.filter((r) => r.id !== id);
      emitChange({ enabled: ranges.length > 0, ranges });
    },
    [emitChange, state],
  );

  const openCopy = useCallback(() => setCopyOpen(true), []);
  const closeCopy = useCallback(() => setCopyOpen(false), []);

  const handleCopyApply = useCallback(
    (targets: DayKey[]) => {
      emitCopy(targets);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    },
    [emitCopy],
  );

  // The body content at natural size. Rendered twice: once in the offscreen
  // measurer (drives the clip's height target) and once as the visible layer.
  const renderBody = () =>
    state.enabled ? (
      <View style={{ marginTop: 10, gap: 8 }}>
        <AnimatePresence>
          {state.ranges.map((r) => (
            <RangeRow key={r.id} range={r} options={options} reduce={reduce} onUpdate={updateRange} onRemove={removeRange} />
          ))}
        </AnimatePresence>
      </View>
    ) : (
      <View style={{ marginTop: 6 }}>
        <Text className="text-muted-foreground text-sm">{LABEL_UNAVAILABLE}</Text>
      </View>
    );

  return (
    <View className="border-border border-b" style={{ paddingVertical: 16 }}>
      {/* Header row: switch + label + actions */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Switch checked={state.enabled} onCheckedChange={setEnabled} testID={`switch-${day}`} />
          <Text className="font-medium text-foreground text-sm">{label}</Text>
        </View>

        {/* Action buttons */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          {state.enabled ? (
            <MotiView
              from={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={SPRING_PRESS}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Add time range to ${label}`}
                onPress={addRange}
                className="h-8 w-8 items-center justify-center rounded-lg"
              >
                <Plus size={16} color="#6b7280" />
              </Pressable>
            </MotiView>
          ) : null}

          {/* Copy button */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Copy ${label} hours to other days`}
            onPress={openCopy}
            className="h-8 w-8 items-center justify-center rounded-lg"
          >
            <AnimatePresence>
              {copied ? (
                <MotiView
                  key="done"
                  from={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.5 }}
                  transition={SPRING_PRESS}
                >
                  <Check size={16} color="#6b7280" />
                </MotiView>
              ) : (
                <MotiView
                  key="copy"
                  from={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.5 }}
                  transition={SPRING_PRESS}
                >
                  <Copy size={16} color="#6b7280" />
                </MotiView>
              )}
            </AnimatePresence>
          </Pressable>
        </View>
      </View>

      {/* Animated clip: the body is measured offscreen at natural height, then
          the visible clip springs its height toward that target. The visible
          layer cross-fades (exitBeforeEnter) between the ranges and the
          "Unavailable" label so only one lives in the flow at a time. */}
      <MotiView
        animate={{ height: bodyHeight ?? 0 }}
        transition={reduce || !readyRef.current ? { type: 'timing', duration: 0 } : SPRING_LAYOUT}
        className="overflow-hidden"
      >
        {/* Offscreen measurer at natural size — feeds the spring its target. */}
        <View
          onLayout={onBodyLayout}
          style={[{ position: 'absolute', left: 0, right: 0, top: 0, opacity: 0 }, { pointerEvents: 'none' }]}
        >
          {renderBody()}
        </View>
        <AnimatePresence exitBeforeEnter={true}>
          <MotiView
            key={state.enabled ? 'ranges' : 'unavailable'}
            from={reduce ? { opacity: 0 } : { opacity: 0, translateY: -4 }}
            animate={{ opacity: 1, translateY: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, translateY: -4 }}
            transition={reduce ? { type: 'timing', duration: 0 } : CONTENT_TRANSITION}
          >
            {renderBody()}
          </MotiView>
        </AnimatePresence>
      </MotiView>

      <CopyModal visible={copyOpen} fromLabel={label} onApply={handleCopyApply} onClose={closeCopy} />
    </View>
  );
}

// ─── AvailabilityScheduler ─────────────────────────────────────────────────

export function AvailabilityScheduler({ value, defaultValue, onChange, step = 30, style, testID }: AvailabilitySchedulerProps) {
  const reduce = useReducedMotion();
  const options = useMemo(() => buildOptions(step), [step]);
  const idRef = useRef(0);

  const [internal, setInternal] = useState<WeekAvailability>(() => defaultValue ?? defaultWeek());
  const controlled = value !== undefined;
  const week = controlled ? value : internal;

  const commit = useCallback(
    (next: WeekAvailability) => {
      if (!controlled) setInternal(next);
      onChange?.(next);
    },
    [controlled, onChange],
  );

  const setDay = useCallback(
    (day: DayKey, next: DayAvailability) => {
      commit({ ...week, [day]: next });
    },
    [commit, week],
  );

  const copyDay = useCallback(
    (from: DayKey, targets: DayKey[]) => {
      const source = week[from];
      const next = { ...week };
      for (const t of targets)
        next[t] = {
          enabled: source.enabled,
          ranges: source.ranges.map((r) => {
            const n = idRef.current;
            idRef.current += 1;
            return { ...r, id: `${t}-c${n}` };
          }),
        };
      commit(next);
    },
    [commit, week],
  );

  return (
    <ScrollView
      testID={testID ?? 'availability-scheduler'}
      style={style}
      contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 8 }}
      showsVerticalScrollIndicator={false}
    >
      {WEEKDAYS.map(({ key, label }) => (
        <DayRow
          key={key}
          day={key}
          label={label}
          state={week[key]}
          options={options}
          reduce={reduce}
          onChange={setDay}
          onCopy={copyDay}
        />
      ))}
    </ScrollView>
  );
}
