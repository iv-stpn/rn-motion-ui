import type { Meta, StoryObj } from '@storybook/react';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { AlertLine as Alert } from 'rn-motion-ui-icons/icons/alert-line';
import { CheckCircleLine as CheckCircle } from 'rn-motion-ui-icons/icons/check-circle-line';
import { MusicLine as Music } from 'rn-motion-ui-icons/icons/music-line';
import { PhoneLine as Phone } from 'rn-motion-ui-icons/icons/phone-line';
import { UploadLine as Upload } from 'rn-motion-ui-icons/icons/upload-line';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { Choice, ControlCard, Note, Playground, Toggle } from '../../../__stories__/story-harness';
import { useInterval } from '../../../hooks/use-interval';
import { cn } from '../../../lib/cn';
import { Button } from '../../buttons/Button/button';
import { Text } from '../../typography/Text/text';
import { ActivityIsland, ActivityIslandState } from './activity-island';

/** Every activity the bar can show. */
const ACTIVITIES = ['upload', 'synced', 'call', 'music', 'error'] as const;
type ActivityId = (typeof ACTIVITIES)[number];
/** An activity id, or `null` for the resting bar. */
type StateId = ActivityId | null;
/** A control value: an activity id, or `'idle'`. */
type ViewKey = ActivityId | 'idle';

const meta = {
  title: 'Display/ActivityIsland',
  component: ActivityIsland,
  parameters: { layout: 'centered' },
  args: { state: null },
} satisfies Meta<typeof ActivityIsland>;

type Story = StoryObj<typeof meta>;

const APP_NAME = 'rn-motion-ui';
const CLOCK = '9:41';
const UPLOAD_TITLE = 'Uploading 3 files';
const SYNCED_TITLE = 'All files synced';
const SYNCED_DETAIL = '3 files · just now';
const CALLER = 'Saurabh';
const CALL_DETAIL = 'Incoming call · mobile';
const TRACK_TITLE = 'Midnight City';
const TRACK_DETAIL = 'M83 · Now playing';
const ERROR_TITLE = 'Upload failed';
const ERROR_DETAIL = 'No connection — retrying in 30s';
const CALL_ACTION = 'Call';
const UPLOAD_ACTION = 'Upload';
const MUSIC_ACTION = 'Music';
const DISMISS_ACTION = 'Dismiss';

/**
 * How long one activity of the demo cycle holds, and where its progress runs
 * from and to. The tick is the clock everything in the playground runs on: the
 * cycle advances one phase every `TICK_MS`, and a phase's progress interpolates
 * across its own ticks — so the bar is moving on every tick, whether or not the
 * activity changes. `progress` is `[at its first tick, at its last]`.
 */
type Phase = { state: StateId; ticks: number; progress?: readonly [number, number] };

/** The resting bar — the phase the cycle starts and ends on. */
const IDLE_PHASE: Phase = { state: null, ticks: 2 };

/**
 * One full pass: a transfer that fills, its success flash, a call, a track
 * playing, a failure, then back to rest.
 */
const CYCLE: readonly Phase[] = [
  IDLE_PHASE,
  { state: 'upload', ticks: 5, progress: [0.12, 1] },
  { state: 'synced', ticks: 2 },
  { state: 'call', ticks: 3 },
  { state: 'music', ticks: 5, progress: [0.24, 0.46] },
  { state: 'error', ticks: 3 },
];

const TICK_MS = 1100;

/** Where an activity sits when it is picked by hand instead of cycled. */
const PICKED_PROGRESS: Partial<Record<ViewKey, number>> = { upload: 0.62, music: 0.33 };

const VIEW_OPTIONS = [
  { value: 'idle', label: 'Idle' },
  { value: 'upload', label: 'Upload' },
  { value: 'synced', label: 'Synced' },
  { value: 'call', label: CALL_ACTION },
  { value: 'music', label: MUSIC_ACTION },
  { value: 'error', label: 'Error' },
] as const;

/** The resting bar: a status strip with the clock, the way a device topbar is. */
function IdleBar() {
  return (
    <View className="flex-row items-center justify-between">
      <View className="flex-row items-center gap-2">
        <View className="h-1.5 w-1.5 rounded-full bg-success" />
        <Text size="sm" weight="medium" className="text-white">
          {CLOCK}
        </Text>
      </View>
      <Text size="xs" className="text-white opacity-40">
        {APP_NAME}
      </Text>
    </View>
  );
}

const FILES = [
  { name: 'Midnight City.flac', meta: '8.4 MB · audio', swatch: 'bg-info' },
  { name: 'Q1-report.pdf', meta: '1.2 MB · document', swatch: 'bg-warning' },
  { name: 'Sunset.jpg', meta: '3.1 MB · image', swatch: 'bg-success' },
];

/** The screen's own top block — the demo's witness that the bar pushes it down. */
const HERO_TESTID = 'downloads-hero';

/** The screen the bar sits above — here, what looks like a downloads list. */
function DownloadsScreen() {
  return (
    <View className="flex-1 gap-4 p-4">
      <View className="h-32 justify-end rounded-2xl bg-surface-3 p-3" testID={HERO_TESTID}>
        <Text size="lg" weight="bold">
          Downloads
        </Text>
        <Text size="xs" className="text-muted-foreground">
          3 files · 12.7 MB
        </Text>
      </View>

      <View className="gap-2">
        {FILES.map((file) => (
          <View key={file.name} className="flex-row items-center gap-3 rounded-xl bg-surface-3 p-3">
            <View className={cn('h-9 w-9 rounded-lg', file.swatch)} />
            <View className="flex-1 gap-0.5">
              <Text size="sm" weight="medium" numberOfLines={1}>
                {file.name}
              </Text>
              <Text size="xs" className="text-muted-foreground" numberOfLines={1}>
                {file.meta}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

type AppScreenProps = { state: StateId; progress?: number; idle?: boolean };

/**
 * A phone-sized shell around one `ActivityIsland`: the bar is flush with the
 * frame's top edge and the downloads screen takes what the bar leaves, edge to
 * edge. Drop `idle` to see the other half of the component — with no resting bar
 * the bar itself unrolls away once nothing is running, and the screen gets the
 * whole frame back.
 */
function AppScreen({ state, progress, idle = true }: AppScreenProps) {
  return (
    <View className="h-[540px] w-[300px] overflow-hidden rounded-[36px] border border-border bg-surface-2">
      <ActivityIsland
        accessibilityLabel="Activity"
        idle={idle ? <IdleBar /> : undefined}
        state={state}
        testID="island"
        states={
          <>
            <ActivityIslandState
              detail={`${Math.round((progress ?? 0) * 100)}% · 2.4 MB/s`}
              icon={Upload}
              id="upload"
              progress={progress}
              title={UPLOAD_TITLE}
              tone="info"
            />
            <ActivityIslandState detail={SYNCED_DETAIL} icon={CheckCircle} id="synced" title={SYNCED_TITLE} tone="success" />
            <ActivityIslandState detail={CALL_DETAIL} icon={Phone} id="call" title={CALLER} tone="success" />
            <ActivityIslandState
              detail={TRACK_DETAIL}
              icon={Music}
              id="music"
              progress={progress}
              title={TRACK_TITLE}
              tone="info"
            />
            <ActivityIslandState detail={ERROR_DETAIL} icon={Alert} id="error" title={ERROR_TITLE} tone="danger" />
          </>
        }
      >
        <DownloadsScreen />
      </ActivityIsland>
    </View>
  );
}

type Run = { phase: Phase; tick: number };

const FIRST_RUN: Run = { phase: IDLE_PHASE, tick: 0 };

/** Step to the next phase of the ring. */
function nextPhase(current: Phase): Phase {
  // Walking the ring keeps the index in range; a `-1` could only come from a
  // phase that isn't in the cycle at all, so holding the current one is right.
  return CYCLE[(CYCLE.indexOf(current) + 1) % CYCLE.length] ?? current;
}

/** Advance one phase of the cycle, or one tick within the current phase. */
function advance({ phase, tick }: Run): Run {
  if (tick + 1 >= phase.ticks) return { phase: nextPhase(phase), tick: 0 };
  return { phase, tick: tick + 1 };
}

function useActivityCycle(enabled: boolean): Run {
  const [run, setRun] = useState<Run>(FIRST_RUN);
  useInterval(() => setRun(advance), enabled ? TICK_MS : null);
  return run;
}

/** A phase's progress at its current tick, or `undefined` if it has none. */
function phaseProgress(phase: Phase, tick: number) {
  if (!phase.progress) return;
  const [from, to] = phase.progress;
  // The tick is 0-based, so the first tick already shows the phase's first step
  // rather than holding its start value for a beat before moving.
  return from + (to - from) * Math.min(1, (tick + 1) / phase.ticks);
}

function IslandPlayground() {
  const [auto, setAuto] = useState(true);
  const [picked, setPicked] = useState<ViewKey>('idle');
  const [resting, setResting] = useState(true);
  const run = useActivityCycle(auto);

  const pickedState: StateId = picked === 'idle' ? null : picked;
  const state = auto ? run.phase.state : pickedState;
  const progress = auto ? phaseProgress(run.phase, run.tick) : PICKED_PROGRESS[picked];

  // Picking by hand takes over from the cycle — otherwise the next tick would
  // wipe the choice out from under the pointer.
  const pick = useCallback((next: ViewKey) => {
    setAuto(false);
    setPicked(next);
  }, []);

  return (
    <Playground>
      <ControlCard title="Options">
        <Toggle label="Auto-cycle" onChange={setAuto} value={auto} />
        <Choice label="Activity" onChange={pick} options={VIEW_OPTIONS} value={state ?? 'idle'} />
        <Toggle label="Resting bar" onChange={setResting} value={resting} />
      </ControlCard>

      <View className="items-center">
        <AppScreen idle={resting} progress={progress} state={state} />
      </View>

      <Note>
        The bar is part of the screen's own stack: raising an activity unrolls it and pushes the downloads list down by exactly
        what it gained, so nothing is ever covered and the list keeps its scroll position throughout.
      </Note>
    </Playground>
  );
}

type IslandDemoProps = { idle?: boolean };

function IslandDemo({ idle = true }: IslandDemoProps) {
  const [state, setState] = useState<StateId>(null);
  const showCall = useCallback(() => setState('call'), []);
  const showUpload = useCallback(() => setState('upload'), []);
  const showMusic = useCallback(() => setState('music'), []);
  const dismiss = useCallback(() => setState(null), []);

  return (
    <View className="items-center gap-4">
      <AppScreen idle={idle} progress={state === null ? undefined : PICKED_PROGRESS[state]} state={state} />

      <View className="flex-row flex-wrap items-center justify-center gap-2">
        <Button onPress={showCall} size="sm" variant="neutral">
          {CALL_ACTION}
        </Button>
        <Button onPress={showUpload} size="sm" variant="neutral">
          {UPLOAD_ACTION}
        </Button>
        <Button onPress={showMusic} size="sm" variant="neutral">
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

/** Cycle the activities, or pick one by hand and watch the bar swap content and height. */
export const Interactive: Story = {
  render: () => <IslandPlayground />,
};

export const Default: Story = {
  name: 'Demo: Raise an activity',
  render: () => <IslandDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const bar = await canvas.findByTestId('island-bar');
    const hero = canvas.getByTestId(HERO_TESTID);

    // The bar unrolls as a transform over a frame that was already laid out, so
    // its box only measures the bar once the unroll has finished — and
    // `findByTestId` resolves before it has even started. Waiting for the box to
    // match the bar's own laid-out height is what rest means here; the height is
    // read off `getComputedStyle` because that reports the frame, not the
    // transform painted over it. The screen below shares the transition and starts
    // with it, so it is at rest by the time the bar is — to within the frame the
    // two are started in, which the push samples below account for.
    const restedBarHeight = async () => {
      await waitFor(() => {
        const painted = bar.getBoundingClientRect().height;
        expect(painted).toBeGreaterThan(0);
        expect(painted).toBeCloseTo(Number.parseFloat(getComputedStyle(bar).height), 1);
      });
      return bar.getBoundingClientRect().height;
    };

    const restingBarHeight = await restedBarHeight();
    const restingBarBottom = bar.getBoundingClientRect().bottom;
    const restingHeroTop = hero.getBoundingClientRect().top;

    // The bar is laid out above the screen, not over it: it ends above the
    // screen's own first block, which is what the screen's padding leaves.
    expect(restingBarBottom).toBeLessThanOrEqual(restingHeroTop);
    const restingGap = restingHeroTop - restingBarBottom;

    // Black in both color schemes: this is the device-bezel surface, so nothing
    // in the bar may derive its ink from the theme's foreground. Probed against
    // the token's own literal — Tailwind inlines `oklch()` verbatim, so the
    // comparison is about the resolved colour, not the class name.
    const probe = document.createElement('div');
    probe.style.backgroundColor = 'oklch(0% 0 0)'; // --color-black
    canvasElement.appendChild(probe);
    try {
      expect(getComputedStyle(bar).backgroundColor).toBe(getComputedStyle(probe).backgroundColor);
    } finally {
      probe.remove();
    }

    // On top of everything, without being in the way: the bar is what is hit at
    // its own centre, and the screen it pushed down is what is hit just below it
    // — its drop falls across that content without swallowing it.
    const centreOf = (rect: DOMRect) => document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    const barHit = centreOf(bar.getBoundingClientRect());
    expect(barHit === bar || bar.contains(barHit)).toBe(true);
    const heroHit = centreOf(hero.getBoundingClientRect());
    expect(heroHit === hero || hero.contains(heroHit)).toBe(true);

    // How the bar's bottom edge and the screen's top move, sampled across a window
    // longer than one unroll. The samples are taken on a timer rather than on
    // animation frames: the browser under the test runner does not hand out frames
    // on a clock that matches wall time, and the animations run on wall-clock time.
    const samplePush = (ms: number) =>
      new Promise<{ top: number; bottom: number }[]>((resolve) => {
        const samples: { top: number; bottom: number }[] = [];
        const sampler = setInterval(() => {
          samples.push({ top: hero.getBoundingClientRect().top, bottom: bar.getBoundingClientRect().bottom });
        }, 16);
        setTimeout(() => {
          clearInterval(sampler);
          resolve(samples);
        }, ms);
      });

    // Raising an activity swaps the resting strip for that activity's content…
    const sampled = samplePush(700);
    await userEvent.click(await canvas.findByText(UPLOAD_ACTION));
    await expect(within(await canvas.findByTestId('island-upload')).getByText(UPLOAD_TITLE)).toBeTruthy();
    const samples = await sampled;
    const tops = samples.map(({ top }) => top);

    // …a state that brings a progress track grows the bar to fit it, rather than
    // clipping the track or overflowing…
    const raisedBarHeight = await restedBarHeight();
    expect(raisedBarHeight).toBeGreaterThan(restingBarHeight);

    // …and the screen is pushed down by exactly what the bar gained, so the two
    // move as one surface rather than the bar growing over the list.
    const pushed = hero.getBoundingClientRect().top - restingHeroTop;
    expect(Math.abs(pushed - (raisedBarHeight - restingBarHeight))).toBeLessThan(1);

    // The push is a motion, not a jump. The bar unrolls as a transform laid over
    // its new height, so a screen that only follows real layout snaps to its new
    // place on the first frame — which is why it rides the same transition. Its
    // top has to have been seen between its resting and raised places, not only at
    // the two ends.
    const framesBetween = tops.filter((top) => top > restingHeroTop + 0.5 && top < restingHeroTop + pushed - 0.5);
    expect(framesBetween.length).toBeGreaterThan(0);
    expect(tops.at(-1)).toBeCloseTo(restingHeroTop + pushed, 1);

    // And the two move *together*: the screen sits its usual padding below the bar
    // on every sampled frame, not just at the two ends. A screen that followed
    // real layout instead of the transition would part company with the bar by the
    // whole height of the push mid-flight — and only mid-flight, which is what
    // makes this worth sampling. The tolerance is a frame's worth of travel: these
    // are two animations, applied to two elements, and the browser only starts
    // them in the same frame to within its own clock.
    const parted = samples.filter(({ top, bottom }) => Math.abs(top - bottom - restingGap) > 2);
    expect(parted).toEqual([]);

    // Raising another rolls the content over inside the same bar.
    await userEvent.click(await canvas.findByText(CALL_ACTION));
    await expect(within(await canvas.findByTestId('island-call')).getByText(CALLER)).toBeTruthy();

    // Dismissing rolls the bar back to the resting strip and hands the space back.
    await userEvent.click(await canvas.findByText(DISMISS_ACTION));
    await waitFor(() => expect(Math.abs(hero.getBoundingClientRect().top - restingHeroTop)).toBeLessThan(1));
    expect(canvas.queryByTestId('island-call')).toBeNull();
  },
};

export const WithoutIdle: Story = {
  name: 'Demo: No resting bar',
  render: () => <IslandDemo idle={false} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Nothing is running and there is no resting bar to fall back on, so the bar
    // is not on screen at all…
    expect(canvas.queryByTestId('island-bar')).toBeNull();

    // …until an activity unrolls it in, from zero height.
    await userEvent.click(await canvas.findByText(MUSIC_ACTION));
    const bar = await canvas.findByTestId('island-bar');
    await waitFor(() => expect(bar.getBoundingClientRect().height).toBeGreaterThan(0));
    await expect(within(await canvas.findByTestId('island-music')).getByText(TRACK_TITLE)).toBeTruthy();

    // …and dismissing takes the bar off screen again rather than leaving a
    // collapsed one behind: the exit is a `layout` transition with no completion
    // callback, so the bar is released on a timer — if that release is missed
    // the presence key is stranded and the bar outlives its content.
    await userEvent.click(await canvas.findByText(DISMISS_ACTION));
    await waitFor(() => expect(canvas.queryByTestId('island-bar')).toBeNull(), { timeout: 2000 });
  },
};
