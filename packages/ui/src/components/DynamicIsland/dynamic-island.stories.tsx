import type { Meta, StoryObj } from '@storybook/react';
import { type ReactNode, useCallback, useState } from 'react';
import { View } from 'react-native';
import { expect, screen, userEvent, within } from 'storybook/test';
import { Choice, Controls, Playground, Sample, Section, Toggle, Variants } from '../../__stories__/story-harness';
import { useInterval } from '../../hooks/use-interval';
import { useReducedMotion } from '../../hooks/use-reduced-motion';
import { Music, Phone, PhoneOff, Timer } from '../../lib/icons';
import { MotiView } from '../../moti/components/view';
import { Button } from '../Button/button';
import { Text } from '../Text/text';
import { DynamicIsland, DynamicIslandView } from './dynamic-island';

type IslandView = 'call' | 'timer' | 'music' | null;

const meta = {
  title: 'Components/DynamicIsland',
  component: DynamicIsland,
  parameters: { layout: 'centered' },
  args: { view: null },
  argTypes: {
    view: { control: 'select', options: [null, 'call', 'timer', 'music'] },
  },
} satisfies Meta<typeof DynamicIsland>;

type Story = StoryObj<typeof meta>;

// The island shell is always black, so its content is tinted against that
// rather than against the theme surface.
const ON_BLACK = '#fafafa';
const ACCENT = '#3fa653';
const TIMER_TINT = '#d99a00';

const CLOCK = '9:41';
const INCOMING_CALL = 'INCOMING CALL';
const CALLER = 'Saurabh';
const TIMER_LABEL = 'TIMER';
const TRACK_TITLE = 'Midnight City';
const TRACK_ARTIST = 'M83';
const CALL_ACTION = 'Call';
const TIMER_ACTION = 'Timer';
const MUSIC_ACTION = 'Music';
const DISMISS_ACTION = 'Dismiss';
const RECORDING = 'REC';
const START_SECONDS = 154;

const VIEWS = [
  { value: 'compact', label: 'Compact' },
  { value: 'call', label: CALL_ACTION },
  { value: 'timer', label: TIMER_ACTION },
  { value: 'music', label: MUSIC_ACTION },
] as const;

type ViewKey = (typeof VIEWS)[number]['value'];

const BAR_DELAYS = [0, 180, 90, 270];

// biome-ignore lint/style/useComponentExportOnlyModules: story helper
function EqBars() {
  const reduce = useReducedMotion();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 16 }}>
      {BAR_DELAYS.map((delay) => (
        <MotiView
          key={delay}
          from={{ scaleY: 0.4 }}
          animate={reduce ? { scaleY: 0.6 } : { scaleY: 1 }}
          transition={{ type: 'timing', duration: 1100, loop: !reduce, repeatReverse: true, delay }}
          style={{ width: 2, height: 16, borderRadius: 999, backgroundColor: ACCENT }}
        />
      ))}
    </View>
  );
}

function formatClock(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Compact pills — whatever the island shows while no view is active. */
function clockPill() {
  return (
    <>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: ACCENT }} />
      <Text style={{ color: ON_BLACK, fontSize: 12, fontWeight: '500' }}>{CLOCK}</Text>
    </>
  );
}

function recordingPill() {
  return (
    <>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: TIMER_TINT }} />
      <Text style={{ color: ON_BLACK, fontSize: 10, letterSpacing: 1, opacity: 0.6 }}>{RECORDING}</Text>
    </>
  );
}

type IslandProps = { view: IslandView; seconds?: number; compact?: ReactNode; onDismiss?: () => void };

/**
 * The three views wired to one shell. `view` picks the active slot; `null`
 * falls back to the compact pill.
 */
// biome-ignore lint/style/useComponentExportOnlyModules: story helper
function Island({ view, seconds = START_SECONDS, compact, onDismiss }: IslandProps) {
  return (
    <DynamicIsland accessibilityLabel="Dynamic island" compact={compact ?? clockPill()} view={view}>
      {/* biome-ignore lint/correctness/useUniqueElementIds: not a DOM id — `id` is a view descriptor used as the slot's React key and matched against the parent's `view` prop; never rendered as an id attribute */}
      <DynamicIslandView className="gap-4" id="call">
        <View style={{ gap: 2 }}>
          <Text style={{ color: ON_BLACK, fontSize: 10, letterSpacing: 1, opacity: 0.6 }}>{INCOMING_CALL}</Text>
          <Text style={{ color: ON_BLACK, fontSize: 14, fontWeight: '600' }}>{CALLER}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Button accessibilityLabel="Decline" onPress={onDismiss} size="icon" variant="ghost">
            <PhoneOff color={ON_BLACK} size={14} />
          </Button>
          <Button accessibilityLabel="Accept" onPress={onDismiss} size="icon" variant="ghost">
            <Phone color={ON_BLACK} size={14} />
          </Button>
        </View>
      </DynamicIslandView>

      {/* biome-ignore lint/correctness/useUniqueElementIds: not a DOM id — `id` is a view descriptor used as the slot's React key and matched against the parent's `view` prop; never rendered as an id attribute */}
      <DynamicIslandView className="gap-3" id="timer">
        <Timer color={TIMER_TINT} size={16} />
        <Text style={{ color: ON_BLACK, fontSize: 10, letterSpacing: 1, opacity: 0.6 }}>{TIMER_LABEL}</Text>
        <Text style={{ color: ON_BLACK, fontSize: 14, fontWeight: '600', fontVariant: ['tabular-nums'] }}>
          {formatClock(seconds)}
        </Text>
      </DynamicIslandView>

      {/* biome-ignore lint/correctness/useUniqueElementIds: not a DOM id — `id` is a view descriptor used as the slot's React key and matched against the parent's `view` prop; never rendered as an id attribute */}
      <DynamicIslandView className="gap-3" id="music">
        <Music color={ON_BLACK} size={14} />
        <View style={{ gap: 1 }}>
          <Text style={{ color: ON_BLACK, fontSize: 12, fontWeight: '600' }}>{TRACK_TITLE}</Text>
          <Text style={{ color: ON_BLACK, fontSize: 10, opacity: 0.6 }}>{TRACK_ARTIST}</Text>
        </View>
        <EqBars />
      </DynamicIslandView>
    </DynamicIsland>
  );
}

// biome-ignore lint/style/useComponentExportOnlyModules: story helper
function IslandPlayground() {
  const [viewKey, setViewKey] = useState<ViewKey>('compact');
  const [running, setRunning] = useState(true);
  const [seconds, setSeconds] = useState(START_SECONDS);

  useInterval(() => setSeconds((s) => (s > 0 ? s - 1 : START_SECONDS)), running && viewKey === 'timer' ? 1000 : null);

  const selectView = useCallback((next: ViewKey) => {
    if (next === 'timer') setSeconds(START_SECONDS);
    setViewKey(next);
  }, []);
  const dismiss = useCallback(() => setViewKey('compact'), []);

  return (
    <Playground>
      <Controls>
        <Choice label="View" onChange={selectView} options={VIEWS} value={viewKey} />
        <Toggle label="Run timer" onChange={setRunning} value={running} />
      </Controls>

      <View style={{ height: 132, alignItems: 'center', paddingTop: 8 }}>
        <Island onDismiss={dismiss} seconds={seconds} view={viewKey === 'compact' ? null : viewKey} />
      </View>

      <View style={{ height: 12 }} />
      <Section title="Every view, side by side">
        <Variants align="center" direction="column" gap={16}>
          <Sample align="center" label={CALL_ACTION}>
            <Island view="call" />
          </Sample>
          <Sample align="center" label={TIMER_ACTION}>
            <Island view="timer" />
          </Sample>
          <Sample align="center" label={MUSIC_ACTION}>
            <Island view="music" />
          </Sample>
        </Variants>
      </Section>

      <Section title="Compact pill (no view active)">
        <Variants align="center" direction="column" gap={16}>
          <Sample align="center" label="Clock">
            <Island view={null} />
          </Sample>
          <Sample align="center" label="Live activity">
            <Island compact={recordingPill()} view={null} />
          </Sample>
        </Variants>
      </Section>
    </Playground>
  );
}

// biome-ignore lint/style/useComponentExportOnlyModules: story helper
function IslandDemo() {
  const [view, setView] = useState<IslandView>(null);
  const [seconds, setSeconds] = useState(START_SECONDS);

  useInterval(() => setSeconds((s) => (s > 0 ? s - 1 : 0)), view === 'timer' ? 1000 : null);

  const dismiss = useCallback(() => setView(null), []);
  const showCall = useCallback(() => setView('call'), []);
  const showTimer = useCallback(() => {
    setSeconds(START_SECONDS);
    setView('timer');
  }, []);
  const showMusic = useCallback(() => setView('music'), []);

  return (
    <View style={{ alignItems: 'center', gap: 16 }}>
      <View style={{ height: 128, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 8 }}>
        <Island onDismiss={dismiss} seconds={seconds} view={view} />
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <Button onPress={showCall} size="sm" variant="secondary">
          {CALL_ACTION}
        </Button>
        <Button onPress={showTimer} size="sm" variant="secondary">
          {TIMER_ACTION}
        </Button>
        <Button onPress={showMusic} size="sm" variant="secondary">
          {MUSIC_ACTION}
        </Button>
        <Button onPress={dismiss} size="sm" variant="ghost">
          {DISMISS_ACTION}
        </Button>
      </View>
    </View>
  );
}

export default meta;

/** Pick a view to watch the pill unfurl into it, then every view and pill side by side. */
export const Interactive: Story = {
  render: () => <IslandPlayground />,
};

export const Default: Story = {
  name: 'Demo: Switch between views',
  render: () => <IslandDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Tapping "Call" expands the island from the compact pill to the call view.
    await userEvent.click(await canvas.findByText(CALL_ACTION));
    const matches = await screen.findAllByText(CALLER);
    await expect(matches.length).toBeGreaterThan(0);
  },
};
