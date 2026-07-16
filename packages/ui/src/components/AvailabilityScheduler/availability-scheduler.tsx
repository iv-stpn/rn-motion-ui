import { AnimatePresence, MotiView } from 'moti';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  type LayoutChangeEvent,
  Modal,
  Pressable,
  ScrollView,
  type StyleProp,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { useReducedMotion } from '../../hooks/use-reduced-motion';
import { CONTENT_TRANSITION, SPRING_LAYOUT, SPRING_PRESS } from '../../lib/ease';
import { Check, Copy, Plus, X } from '../../lib/icons';
import { Checkbox } from '../Checkbox/checkbox';
import { Switch } from '../Switch/switch';
import { WheelPicker } from '../WheelPicker/wheel-picker';

// ─── types (re-exported) ───────────────────────────────────────────────────

export type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
export type TimeRange = { id: string; start: string; end: string };
export type DayAvailability = { enabled: boolean; ranges: TimeRange[] };
export type WeekAvailability = Record<DayKey, DayAvailability>;

export interface AvailabilitySchedulerProps {
  value?: WeekAvailability;
  defaultValue?: WeekAvailability;
  onChange?: (value: WeekAvailability) => void;
  /** Minutes between selectable times. Default 30. */
  step?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

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

export const label12 = (v: string) => {
  const [h, m] = v.split(':').map(Number);
  const ap = (h ?? 0) < 12 ? 'AM' : 'PM';
  const h12 = (h ?? 0) % 12 === 0 ? 12 : (h ?? 0) % 12;
  return `${h12}:${String(m ?? 0).padStart(2, '0')} ${ap}`;
};

type TimeOption = { value: string; label: string };

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
  const onShow = () => setPending(value);

  const wheelOptions = useMemo(() => options.map((o) => ({ label: o.label, value: o.value })), [options]);

  return (
    <Modal visible={visible} transparent animationType="slide" onShow={onShow} onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }} onPress={onClose}>
        <View>
          <Pressable onPress={(e) => e.stopPropagation()}>
            <View className="rounded-t-3xl bg-card" style={{ paddingBottom: 16 }}>
              {/* Handle bar */}
              <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 4 }}>
                <View className="bg-border" style={{ width: 36, height: 4, borderRadius: 2 }} />
              </View>

              <Text className="text-center text-base font-semibold text-foreground" style={{ paddingVertical: 8 }}>
                Select time
              </Text>

              <View style={{ paddingHorizontal: 48, paddingVertical: 8 }}>
                <WheelPicker
                  options={wheelOptions}
                  value={pending}
                  onValueChange={setPending}
                  visibleCount={5}
                  itemHeight={44}
                />
              </View>

              <View style={{ flexDirection: 'row', gap: 12, paddingHorizontal: 24, paddingTop: 8 }}>
                <Pressable
                  accessibilityRole="button"
                  onPress={onClose}
                  className="flex-1 items-center justify-center rounded-full border border-border bg-card"
                  style={{ height: 44 }}
                >
                  <Text className="text-sm font-medium text-foreground">Cancel</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    onSelect(pending);
                    onClose();
                  }}
                  className="flex-1 items-center justify-center rounded-full bg-primary"
                  style={{ height: 44 }}
                >
                  <Text className="text-sm font-medium text-primary-foreground">Done</Text>
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
  return (
    <>
      <Pressable
        accessibilityRole="button"
        testID={testID}
        onPress={() => setOpen(true)}
        className="items-center justify-center rounded-lg border border-border bg-card"
        style={{ height: 36, paddingHorizontal: 10, minWidth: 96 }}
      >
        <Text className="text-sm text-foreground" style={{ fontVariant: ['tabular-nums'] }}>
          {label12(value)}
        </Text>
      </Pressable>
      <TimePickerModal
        visible={open}
        value={value}
        options={options}
        onSelect={onChange}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

// ─── CopyModal ─────────────────────────────────────────────────────────────

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
  const others = WEEKDAYS.filter((d) => d.label !== fromLabel);

  const toggle = (k: DayKey) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });

  const apply = (targets: DayKey[]) => {
    if (!targets.length) return;
    onApply(targets);
    setPicked(new Set());
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }} onPress={onClose}>
        <View>
          <Pressable onPress={(e) => e.stopPropagation()}>
            <View className="rounded-t-3xl bg-card" style={{ paddingBottom: 20, paddingHorizontal: 20 }}>
              <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 4 }}>
                <View className="bg-border" style={{ width: 36, height: 4, borderRadius: 2 }} />
              </View>

              <Text className="py-2 text-sm font-medium text-muted-foreground">Copy times to</Text>

              {others.map((d) => (
                <Checkbox
                  key={d.key}
                  checked={picked.has(d.key)}
                  onCheckedChange={() => toggle(d.key)}
                  label={d.label}
                />
              ))}

              <View style={{ flexDirection: 'row', gap: 12, paddingTop: 16 }}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => apply(others.map((d) => d.key))}
                  className="flex-1 items-center justify-center rounded-full border border-border bg-card"
                  style={{ height: 44 }}
                >
                  <Text className="text-xs font-medium text-muted-foreground">Every day</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => apply([...picked])}
                  disabled={picked.size === 0}
                  className="flex-1 items-center justify-center rounded-full bg-primary"
                  style={{ height: 44, opacity: picked.size === 0 ? 0.4 : 1 }}
                >
                  <Text className="text-xs font-semibold text-primary-foreground">Apply</Text>
                </Pressable>
              </View>
            </View>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

// ─── DayRow ────────────────────────────────────────────────────────────────

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
  onChange: (next: DayAvailability) => void;
  onCopy: (targets: DayKey[]) => void;
}) {
  const idRef = useRef(0);
  const nextId = () => `${day}-n${idRef.current++}`;
  const [copyOpen, setCopyOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // Natural height of the body (ranges or the "Unavailable" label), measured
  // offscreen so the visible clip has an explicit target to spring toward.
  const [bodyHeight, setBodyHeight] = useState<number | null>(null);
  // Skip the spring on the very first measure so pre-enabled rows render at
  // their height instead of unfurling from 0 on mount. `readyRef` flips one
  // commit *after* the first height lands, so that first change stays instant.
  const readyRef = useRef(false);
  useEffect(() => {
    if (bodyHeight !== null) readyRef.current = true;
  }, [bodyHeight]);
  const onBodyLayout = useCallback((e: LayoutChangeEvent) => {
    setBodyHeight(e.nativeEvent.layout.height);
  }, []);

  const setEnabled = (enabled: boolean) => {
    if (enabled && state.ranges.length === 0) {
      onChange({ enabled, ranges: [{ id: nextId(), start: '09:00', end: '17:00' }] });
    } else {
      onChange({ ...state, enabled });
    }
  };

  const updateRange = (id: string, patch: Partial<TimeRange>) => {
    onChange({ ...state, ranges: state.ranges.map((r) => (r.id === id ? { ...r, ...patch } : r)) });
  };

  const addRange = () => {
    const last = state.ranges[state.ranges.length - 1];
    const start = last ? Math.min(toMinutes(last.end) + 60, 24 * 60 - 60) : 540;
    onChange({
      enabled: true,
      ranges: [...state.ranges, { id: nextId(), start: toValue(start), end: toValue(start + 60) }],
    });
  };

  const removeRange = (id: string) => {
    const ranges = state.ranges.filter((r) => r.id !== id);
    onChange({ enabled: ranges.length > 0, ranges });
  };

  const handleCopyApply = (targets: DayKey[]) => {
    onCopy(targets);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  // The body content at natural size. Rendered twice: once in the offscreen
  // measurer (drives the clip's height target) and once as the visible layer.
  const renderBody = () =>
    state.enabled ? (
      <View style={{ marginTop: 10, gap: 8 }}>
        <AnimatePresence>
          {state.ranges.map((r) => (
            <MotiView
              key={r.id}
              from={reduce ? { opacity: 0 } : { opacity: 0, translateX: -8 }}
              animate={{ opacity: 1, translateX: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, translateX: -8 }}
              transition={SPRING_LAYOUT}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
            >
              <TimeButton
                value={r.start}
                options={options}
                onChange={(v) => updateRange(r.id, { start: v })}
                testID={`time-start-${r.id}`}
              />
              <Text className="text-sm text-muted-foreground">–</Text>
              <TimeButton
                value={r.end}
                options={options}
                onChange={(v) => updateRange(r.id, { end: v })}
                testID={`time-end-${r.id}`}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Remove time range"
                onPress={() => removeRange(r.id)}
                className="h-8 w-8 items-center justify-center rounded-lg"
              >
                <X size={16} color="#6b7280" />
              </Pressable>
            </MotiView>
          ))}
        </AnimatePresence>
      </View>
    ) : (
      <View style={{ marginTop: 6 }}>
        <Text className="text-sm text-muted-foreground">Unavailable</Text>
      </View>
    );

  return (
    <View className="border-b border-border" style={{ paddingVertical: 16 }}>
      {/* Header row: switch + label + actions */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Switch checked={state.enabled} onCheckedChange={setEnabled} testID={`switch-${day}`} />
          <Text className="text-sm font-medium text-foreground">{label}</Text>
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
            onPress={() => setCopyOpen(true)}
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
          pointerEvents="none"
          onLayout={onBodyLayout}
          style={{ position: 'absolute', left: 0, right: 0, top: 0, opacity: 0 }}
        >
          {renderBody()}
        </View>
        <AnimatePresence exitBeforeEnter>
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

      <CopyModal visible={copyOpen} fromLabel={label} onApply={handleCopyApply} onClose={() => setCopyOpen(false)} />
    </View>
  );
}

// ─── AvailabilityScheduler ─────────────────────────────────────────────────

export function AvailabilityScheduler({
  value,
  defaultValue,
  onChange,
  step = 30,
  style,
  testID,
}: AvailabilitySchedulerProps) {
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
      for (const t of targets) {
        next[t] = {
          enabled: source.enabled,
          ranges: source.ranges.map((r) => ({
            ...r,
            id: `${t}-c${idRef.current++}`,
          })),
        };
      }
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
          onChange={(next) => setDay(key, next)}
          onCopy={(targets) => copyDay(key, targets)}
        />
      ))}
    </ScrollView>
  );
}
