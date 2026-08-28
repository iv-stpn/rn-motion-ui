import type { Meta, StoryObj } from '@storybook/react';
import { type ReactNode, useCallback, useState } from 'react';
import { View } from 'react-native';
import { MusicLine as Music } from 'rn-motion-ui-icons/icons/music-line';
import { PhoneLine as Phone } from 'rn-motion-ui-icons/icons/phone-line';
import { PhoneOffLine as PhoneOff } from 'rn-motion-ui-icons/icons/phone-off-line';
import { TimeDurationLine as Timer } from 'rn-motion-ui-icons/icons/time-duration-line';
import { expect, screen, userEvent, within } from 'storybook/test';
import { Choice, ControlCard, Playground, Sample, Section, Toggle, Variants } from '../../../__stories__/story-harness';
import { useInterval } from '../../../hooks/use-interval';
import { useReducedMotion } from '../../../hooks/use-reduced-motion';
import { MotiView } from '../../../moti/components/view';
import { Button } from '../../buttons/Button/button';
import { Text } from '../../typography/Text/text';
import { DynamicIsland, DynamicIslandView } from './dynamic-island';

type IslandView = 'call' | 'timer' | 'music' | null;

const meta = {
  title: 'Display/DynamicIsland',
  component: DynamicIsland,
  parameters: { layout: 'centered' },
  args: { view: null },
  argTypes: {
    view: { control: 'select', options: [null, 'call', 'timer', 'music'] },
  },
} satisfies Meta<typeof DynamicIsland>;

type Story = StoryObj<typeof meta>;

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

function EqBars() {
  const reduce = useReducedMotion();
  return (
    <View className="h-4 flex-row items-end gap-0.5">
      {BAR_DELAYS.map((delay) => (
        <MotiView
          key={delay}
          from={{ scaleY: 0.4 }}
          animate={reduce ? { scaleY: 0.6 } : { scaleY: 1 }}
          transition={{ type: 'timing', duration: 1100, loop: !reduce, repeatReverse: true, delay }}
          className="h-4 w-[2px] rounded-[999px] bg-success"
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

function ClockPill() {
  return (
    <>
      <View className="h-1.5 w-[6px] rounded-[3px] bg-success" />
      <Text weight="medium" className="text-[12px] text-white">
        {CLOCK}
      </Text>
    </>
  );
}

function RecordingPill() {
  return (
    <>
      <View className="h-1.5 w-[6px] rounded-[3px] bg-warning" />
      <Text className="text-[10px] text-white tracking-px opacity-60">{RECORDING}</Text>
    </>
  );
}

type IslandProps = { view: IslandView; seconds?: number; compact?: ReactNode; onDismiss?: () => void };

/**
 * The three views wired to one shell. `view` picks the active slot; `null`
 * falls back to the compact pill.
 */

function Island({ view, seconds = START_SECONDS, compact, onDismiss }: IslandProps) {
  return (
    <DynamicIsland accessibilityLabel="Dynamic island" compact={compact ?? <ClockPill />} view={view}>
      <DynamicIslandView className="gap-4" id="call">
        <View className="gap-0.5">
          <Text className="text-[10px] text-white tracking-px opacity-60">{INCOMING_CALL}</Text>
          <Text weight="semibold" className="text-[14px] text-white">
            {CALLER}
          </Text>
        </View>
        <View className="flex-row items-center gap-2">
          <Button accessibilityLabel="Decline" onPress={onDismiss} size="icon" variant="ghost">
            <PhoneOff className="text-white" size={14} />
          </Button>
          <Button accessibilityLabel="Accept" onPress={onDismiss} size="icon" variant="ghost">
            <Phone className="text-white" size={14} />
          </Button>
        </View>
      </DynamicIslandView>

      <DynamicIslandView className="gap-3" id="timer">
        <Timer className="text-warning" size={16} />
        <Text className="text-[10px] text-white tracking-px opacity-60">{TIMER_LABEL}</Text>
        <Text weight="semibold" className="text-[14px] text-white tabular-nums">
          {formatClock(seconds)}
        </Text>
      </DynamicIslandView>

      <DynamicIslandView className="gap-3" id="music">
        <Music className="text-white" size={14} />
        <View className="gap-px">
          <Text weight="semibold" className="text-[12px] text-white">
            {TRACK_TITLE}
          </Text>
          <Text className="text-[10px] text-white opacity-60">{TRACK_ARTIST}</Text>
        </View>
        <EqBars />
      </DynamicIslandView>
    </DynamicIsland>
  );
}

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
      <ControlCard title="Options">
        <Choice label="View" onChange={selectView} options={VIEWS} value={viewKey} />
        <Toggle label="Run timer" onChange={setRunning} value={running} />
      </ControlCard>

      <View className="h-[132px] items-center pt-2">
        <Island onDismiss={dismiss} seconds={seconds} view={viewKey === 'compact' ? null : viewKey} />
      </View>

      <View className="h-3" />
      <Section title="Every view, side by side">
        <Variants align="center" direction="column">
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
        <Variants align="center" direction="column">
          <Sample align="center" label="Clock">
            <Island view={null} />
          </Sample>
          <Sample align="center" label="Live activity">
            <Island compact={<RecordingPill />} view={null} />
          </Sample>
        </Variants>
      </Section>
    </Playground>
  );
}

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
    <View className="items-center gap-4">
      <View className="h-[128px] items-center justify-start pt-2">
        <Island onDismiss={dismiss} seconds={seconds} view={view} />
      </View>

      <View className="flex-row flex-wrap items-center justify-center gap-2">
        <Button onPress={showCall} size="sm" variant="inverse">
          {CALL_ACTION}
        </Button>
        <Button onPress={showTimer} size="sm" variant="inverse">
          {TIMER_ACTION}
        </Button>
        <Button onPress={showMusic} size="sm" variant="inverse">
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
