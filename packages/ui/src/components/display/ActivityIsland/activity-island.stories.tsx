import type { Meta, StoryObj } from '@storybook/react';
import { useCallback, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { LightningLine as Lightning } from 'rn-motion-ui-icons/icons/lightning-line';
import { UploadLine as Upload } from 'rn-motion-ui-icons/icons/upload-line';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { Choice, ControlCard, Note, Playground, Toggle } from '../../../__stories__/story-harness';
import { useInterval } from '../../../hooks/use-interval';
import { Button } from '../../buttons/Button/button';
import { Text } from '../../typography/Text/text';
import { ActivityIsland, ActivityIslandState } from './activity-island';

const meta = {
  title: 'Display/ActivityIsland',
  component: ActivityIsland,
  parameters: { layout: 'centered' },
  args: { state: null },
} satisfies Meta<typeof ActivityIsland>;
type Story = StoryObj<typeof meta>;
type State = 'charging' | 'upload' | 'expanded' | null;
const OPTIONS = [
  { value: 'idle', label: 'Idle' },
  { value: 'charging', label: 'Charging' },
  { value: 'upload', label: 'Upload' },
  { value: 'expanded', label: 'Taller content' },
] as const;
const CYCLE: State[] = [null, 'charging', 'upload', 'expanded', null];
const FILES = ['Midnight City.flac', 'Q1-report.pdf', 'Sunset.jpg', 'Archive.zip', 'Notes.txt'];
const INSET = 36;
const ROW_HEIGHT = 24;
const TALL_HEIGHT = 64;

function IdleBar() {
  return (
    <View className="flex-row items-center justify-between">
      <Text size="xs" className="text-white">
        9:41
      </Text>
      <Text size="xs" className="text-white">
        ••• ▰
      </Text>
    </View>
  );
}

/** The screen stays mounted and its bottom edge stays anchored while the top moves. */
function DownloadsScreen() {
  return (
    <View className="flex-1">
      <View className="px-5 py-4" testID="downloads-hero">
        <Text size="lg" weight="semibold">
          Downloads
        </Text>
        <Text size="xs" className="text-muted-foreground">
          Your recent files
        </Text>
      </View>
      <ScrollView testID="downloads-scroll" className="flex-1" contentContainerClassName="gap-3 px-4 pb-4">
        {FILES.map((name) => (
          <View key={name} className="flex-row items-center gap-3 rounded-xl bg-surface-3 p-3">
            <View className="h-9 w-9 rounded-lg bg-info/20" />
            <Text size="sm" className="min-w-0 flex-1" numberOfLines={1}>
              {name}
            </Text>
          </View>
        ))}
      </ScrollView>
      <View className="items-center py-3" testID="downloads-bottom">
        <View className="h-1 w-24 rounded-full bg-muted-foreground" />
      </View>
    </View>
  );
}

type AppScreenProps = { state: State; idle?: boolean; inset?: number; safeArea?: boolean; wide?: boolean };
function AppScreen({ state, idle = false, inset = INSET, safeArea = true, wide = false }: AppScreenProps) {
  return (
    <SafeAreaInsetsContext.Provider value={{ top: inset, bottom: 0, left: 0, right: 0 }}>
      <View
        className="hairline h-[540px] overflow-hidden rounded-[32px] border-border bg-surface-2"
        style={{ width: wide ? 900 : 320 }}
      >
        <ActivityIsland
          accessibilityLabel="Activity"
          idle={idle ? <IdleBar /> : undefined}
          safeArea={safeArea}
          state={state}
          testID="island"
          states={
            <>
              <ActivityIslandState id="charging" title="Quick charging" detail="26%" icon={Lightning} tone="success" />
              <ActivityIslandState id="upload" title="Uploading 3 files" detail="62%" icon={Upload} tone="info" progress={0.62} />
              <ActivityIslandState id="expanded" title="Transfer in progress" tone="info">
                <View className="h-14 justify-center">
                  <Text size="xs" className="text-white">
                    3 files
                  </Text>
                </View>
              </ActivityIslandState>
            </>
          }
        >
          <DownloadsScreen />
        </ActivityIsland>
      </View>
    </SafeAreaInsetsContext.Provider>
  );
}

type DemoProps = { idle?: boolean; inset?: number; safeArea?: boolean; wide?: boolean };
function IslandDemo(props: DemoProps) {
  const [state, setState] = useState<State>(null);
  return (
    <View className="items-center gap-4">
      <AppScreen {...props} state={state} />
      <View className="flex-row flex-wrap justify-center gap-2">
        <Button onPress={() => setState('charging')} size="sm">
          Charge
        </Button>
        <Button onPress={() => setState('upload')} size="sm" variant="neutral">
          Upload
        </Button>
        <Button onPress={() => setState('expanded')} size="sm" variant="neutral">
          Expand
        </Button>
        <Button onPress={() => setState(null)} size="sm" variant="ghost">
          Dismiss
        </Button>
      </View>
    </View>
  );
}

function IslandPlayground() {
  const [auto, setAuto] = useState(true);
  const [step, setStep] = useState(0);
  const [state, setState] = useState<State>(null);
  const [idle, setIdle] = useState(false);
  useInterval(() => setStep((value) => (value + 1) % CYCLE.length), auto ? 1800 : null);
  const current = auto ? (CYCLE[step] ?? null) : state;
  const pick = useCallback((value: Exclude<State, null> | 'idle') => {
    setAuto(false);
    setState(value === 'idle' ? null : value);
  }, []);
  return (
    <Playground>
      <ControlCard title="Options">
        <Toggle label="Auto-cycle" onChange={setAuto} value={auto} />
        <Choice label="Activity" onChange={pick} options={OPTIONS} value={current ?? 'idle'} />
        <Toggle label="Resting strip" onChange={setIdle} value={idle} />
      </ControlCard>
      <View className="items-center">
        <AppScreen state={current} idle={idle} />
      </View>
      <Note>
        The activity replaces the top safe-area strip. Compact rows do not move the screen; only content taller than the inset
        pushes it down. The screen's top corners curve into the black background, not the other way around.
      </Note>
    </Playground>
  );
}

/** Check settled geometry, not merely whether the new label has mounted. */
async function settled(canvasElement: HTMLElement, height: number, radius: number) {
  const canvas = within(canvasElement);
  const bar = canvas.getByTestId('island-bar');
  const content = canvas.getByTestId('island-content');
  await waitFor(() => {
    expect(bar.getBoundingClientRect().height).toBeCloseTo(height, 1);
    expect(Number.parseFloat(getComputedStyle(content).borderTopLeftRadius)).toBeCloseTo(radius, 1);
    expect(Number.parseFloat(getComputedStyle(content).borderTopRightRadius)).toBeCloseTo(radius, 1);
    expect(content.getBoundingClientRect().top).toBeCloseTo(bar.getBoundingClientRect().bottom, 1);
  });
}

async function compactRow(canvasElement: HTMLElement, id: string) {
  const row = await within(canvasElement).findByTestId(`island-${id}`);
  await waitFor(() => {
    expect(row.getBoundingClientRect().height).toBeCloseTo(16, 1);
    expect(getComputedStyle(row).opacity).toBe('1');
  });
  const text = within(row).getByText(id === 'charging' ? 'Quick charging' : 'Uploading 3 files');
  const detail = within(row).getByText(id === 'charging' ? '26%' : '62%');
  expect(text.getBoundingClientRect().top).toBeCloseTo(detail.getBoundingClientRect().top, 1);
}

type RevealSample = { offset: number; opacity: number; label: number; height: number; time: number };
function sampleReveal(canvasElement: HTMLElement, id = 'charging') {
  const canvas = within(canvasElement);
  const root = canvas.getByTestId('island');
  const reveal = canvas.getByTestId('island-reveal');
  const bar = canvas.getByTestId('island-bar');
  const samples: RevealSample[] = [];
  const start = performance.now();
  const sample = () => {
    const label = canvas.queryByTestId(`island-${id}`);
    samples.push({
      offset: reveal.getBoundingClientRect().top - root.getBoundingClientRect().top,
      opacity: Number(getComputedStyle(reveal).opacity),
      label: label ? Number(getComputedStyle(label).opacity) : 0,
      height: bar.getBoundingClientRect().height,
      time: performance.now() - start,
    });
  };
  sample();
  return new Promise<RevealSample[]>((resolve) => {
    const timer = setInterval(sample, 16);
    setTimeout(() => {
      clearInterval(timer);
      resolve(samples);
    }, 700);
  });
}

/** Fade finishes while the surface holds; only then may the strip retract. */
async function dismissAfterFade(canvasElement: HTMLElement, id: string, height: number) {
  const canvas = within(canvasElement);
  await waitFor(() => {
    expect(getComputedStyle(canvas.getByTestId(`island-${id}`)).opacity).toBe('1');
    const root = canvas.getByTestId('island').getBoundingClientRect();
    const reveal = canvas.getByTestId('island-reveal').getBoundingClientRect();
    expect(reveal.top - root.top).toBeCloseTo(height, 1);
  });
  const sampling = sampleReveal(canvasElement, id);
  await userEvent.click(canvas.getByText('Dismiss'));
  const samples = await sampling;
  expect(samples[0]?.label).toBe(1);
  expect(samples.some(({ label }) => label > 0.01 && label < 0.99)).toBe(true);
  const visible = samples.filter(({ label }) => label > 0.01);
  expect(visible.every((sample) => Math.abs(sample.offset - height) < 0.5)).toBe(true);
  expect(visible.every((sample) => Math.abs(sample.height - height) < 0.5)).toBe(true);
  const rise = samples.find(({ offset }) => offset < height - 0.5);
  const closed = samples.find(({ offset }) => offset < 0.1);
  expect(rise?.label).toBeLessThanOrEqual(0.01);
  expect(rise).toBeDefined();
  expect(closed).toBeDefined();
  if (rise && closed) expect(closed.time - rise.time).toBeLessThan(220);
}

type Sample = { top: number; bottom: number };
function samplePush(canvasElement: HTMLElement) {
  const canvas = within(canvasElement);
  const content = canvas.getByTestId('island-content');
  const bar = canvas.getByTestId('island-bar');
  const samples: Sample[] = [];
  const sample = () => samples.push({ top: content.getBoundingClientRect().top, bottom: bar.getBoundingClientRect().bottom });
  sample(); // The baseline belongs before the trigger, not at the first animation frame.
  return new Promise<Sample[]>((resolve) => {
    const timer = setInterval(sample, 16);
    setTimeout(() => {
      clearInterval(timer);
      resolve(samples);
    }, 650);
  });
}

export default meta;
export const Interactive: Story = { render: () => <IslandPlayground /> };

export const Default: Story = {
  name: 'Demo: Safe-area charging strip',
  render: () => <IslandDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await settled(canvasElement, INSET, 0);
    const content = canvas.getByTestId('island-content');
    const screen = canvas.getByTestId('downloads-scroll');
    const initialTop = content.getBoundingClientRect().top;
    const initialBottom = content.getBoundingClientRect().bottom;
    const revealing = sampleReveal(canvasElement);
    await userEvent.click(canvas.getByText('Charge'));
    const revealFrames = await revealing;
    expect(revealFrames.some(({ offset, label }) => offset > 1 && offset < INSET - 1 && label === 0)).toBe(true);
    expect(revealFrames.every(({ opacity }) => opacity === 1)).toBe(true);
    expect(revealFrames.at(-1)?.offset).toBeCloseTo(INSET, 1);
    await settled(canvasElement, INSET, 24);
    await compactRow(canvasElement, 'charging');
    expect(content.getBoundingClientRect().top).toBeCloseTo(initialTop, 1);
    const root = canvas.getByTestId('island').getBoundingClientRect();
    const bar = canvas.getByTestId('island-bar');
    expect(bar.getBoundingClientRect().top).toBeCloseTo(root.top, 1);
    expect(canvas.getByText('Quick charging').getBoundingClientRect().top).toBeLessThan(root.top + INSET);
    expect(getComputedStyle(bar).borderBottomLeftRadius).toBe('0px');
    const backdrop = canvas.getByTestId('island-backdrop');
    await waitFor(() => expect(getComputedStyle(backdrop).opacity).toBe('1'));
    const probe = document.createElement('div');
    probe.style.backgroundColor = 'oklch(0% 0 0)';
    canvasElement.appendChild(probe);
    try {
      expect(getComputedStyle(backdrop).backgroundColor).toBe(getComputedStyle(probe).backgroundColor);
    } finally {
      probe.remove();
    }
    await userEvent.click(canvas.getByText('Upload'));
    await settled(canvasElement, INSET, 24);
    await compactRow(canvasElement, 'upload');
    expect(canvas.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('62');
    expect(content.getBoundingClientRect().top).toBeCloseTo(initialTop, 1);
    const sampling = samplePush(canvasElement);
    await userEvent.click(canvas.getByText('Expand'));
    const samples = await sampling;
    await settled(canvasElement, TALL_HEIGHT, 24);
    const push = content.getBoundingClientRect().top - initialTop;
    expect(push).toBeCloseTo(TALL_HEIGHT - INSET, 1);
    expect(samples.some(({ top }) => top > initialTop + 0.5 && top < initialTop + push - 0.5)).toBe(true);
    expect(samples.every(({ top, bottom }) => Math.abs(top - bottom) < 2)).toBe(true);
    expect(content.getBoundingClientRect().bottom).toBeCloseTo(initialBottom, 1);
    expect(canvas.getByTestId('downloads-scroll')).toBe(screen);
    await dismissAfterFade(canvasElement, 'expanded', TALL_HEIGHT);
    await settled(canvasElement, INSET, 0);
    await waitFor(() => expect(canvas.queryByTestId('island-expanded')).toBeNull());
    // Interrupt both an entrance and an exit. No retained old row or old tall height.
    await userEvent.click(canvas.getByText('Expand'));
    await userEvent.click(canvas.getByText('Dismiss'));
    await userEvent.click(canvas.getByText('Charge'));
    await settled(canvasElement, INSET, 24);
    await waitFor(() => expect(canvas.queryByTestId('island-expanded')).toBeNull());
    await dismissAfterFade(canvasElement, 'charging', INSET);
    await settled(canvasElement, INSET, 0);
    const reveal = canvas.getByTestId('island-reveal');
    await waitFor(() => {
      expect(reveal.getBoundingClientRect().top).toBeCloseTo(bar.getBoundingClientRect().top, 1);
      expect(getComputedStyle(reveal).opacity).toBe('1');
    });
  },
};

export const WithoutIdle: Story = {
  name: 'Demo: Zero inset',
  render: () => <IslandDemo inset={0} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await settled(canvasElement, 0, 0);
    await userEvent.click(canvas.getByText('Charge'));
    await settled(canvasElement, ROW_HEIGHT, 24);
    await compactRow(canvasElement, 'charging');
    await userEvent.click(canvas.getByText('Upload'));
    await settled(canvasElement, ROW_HEIGHT, 24);
    await compactRow(canvasElement, 'upload');
    await dismissAfterFade(canvasElement, 'upload', ROW_HEIGHT);
    await settled(canvasElement, 0, 0);
    await waitFor(() => expect(canvas.queryByTestId('island-upload')).toBeNull());
  },
};

export const SafeAreaDisabled: Story = {
  name: 'Regression: Safe area opt-out',
  render: () => <IslandDemo safeArea={false} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await settled(canvasElement, 0, 0);
    await userEvent.click(canvas.getByText('Charge'));
    await settled(canvasElement, ROW_HEIGHT, 24);
    await userEvent.click(canvas.getByText('Dismiss'));
    await settled(canvasElement, 0, 0);
  },
};

export const RestingStrip: Story = {
  name: 'Demo: Resting strip',
  render: () => <IslandDemo idle={true} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await settled(canvasElement, INSET, 0);
    expect(canvas.getByText('9:41')).toBeTruthy();
    await userEvent.click(canvas.getByText('Charge'));
    await settled(canvasElement, INSET, 24);
    await waitFor(() => expect(canvas.queryByText('9:41')).toBeNull());
    await userEvent.click(canvas.getByText('Dismiss'));
    await settled(canvasElement, INSET, 0);
    await waitFor(() => expect(canvas.getByText('9:41')).toBeTruthy());
  },
};

export const WideScreen: Story = {
  name: 'Demo: Floating desktop island',
  render: () => <IslandDemo wide={true} inset={0} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const content = canvas.getByTestId('island-content');
    const screen = canvas.getByTestId('downloads-scroll');
    const before = content.getBoundingClientRect();
    await userEvent.click(canvas.getByText('Charge'));
    await compactRow(canvasElement, 'charging');
    const root = canvas.getByTestId('island').getBoundingClientRect();
    const bar = canvas.getByTestId('island-bar').getBoundingClientRect();
    expect(bar.width).toBeCloseTo(360, 1);
    expect(bar.top - root.top).toBeCloseTo(12, 1);
    expect(bar.left - root.left).toBeCloseTo((root.width - bar.width) / 2, 1);
    expect(content.getBoundingClientRect().top).toBeCloseTo(before.top, 1);
    expect(content.getBoundingClientRect().height).toBeCloseTo(before.height, 1);
    await userEvent.click(canvas.getByText('Expand'));
    await waitFor(() => expect(canvas.getByTestId('island-bar').getBoundingClientRect().height).toBeCloseTo(TALL_HEIGHT, 1));
    expect(canvas.getByTestId('downloads-scroll')).toBe(screen);
    expect(content.getBoundingClientRect().top).toBeCloseTo(before.top, 1);
    await userEvent.click(canvas.getByText('Dismiss'));
    await waitFor(() => expect(canvas.getByTestId('island-bar').getBoundingClientRect().height).toBe(0));
  },
};

/** Tapping the strip resolves to the activity's own handler, else the island fallback. */
function TappableDemo() {
  const [log, setLog] = useState<string[]>([]);
  const [state, setState] = useState<State>(null);
  const record = useCallback((label: string) => () => setLog((held) => [...held, label]), []);
  return (
    <SafeAreaInsetsContext.Provider value={{ top: INSET, bottom: 0, left: 0, right: 0 }}>
      <View className="hairline h-[360px] w-[320px] overflow-hidden rounded-[32px] border-border bg-surface-2">
        <ActivityIsland
          accessibilityLabel="Activity"
          idle={<IdleBar />}
          state={state}
          testID="tappable"
          onPress={record('island')}
          states={
            <>
              <ActivityIslandState
                id="charging"
                title="Quick charging"
                detail="26%"
                icon={Lightning}
                tone="success"
                onPress={record('charging')}
              />
              <ActivityIslandState id="upload" title="Uploading 3 files" detail="62%" icon={Upload} tone="info" progress={0.62} />
            </>
          }
        >
          <View className="flex-1 gap-2 p-4">
            <View testID="tappable-log">
              <Text size="sm">{log.join(',') || '—'}</Text>
            </View>
            <View className="flex-row gap-2">
              <Button onPress={() => setState('charging')} size="sm">
                Charge
              </Button>
              <Button onPress={() => setState('upload')} size="sm" variant="neutral">
                Upload
              </Button>
              <Button onPress={() => setState(null)} size="sm" variant="ghost">
                Dismiss
              </Button>
            </View>
          </View>
        </ActivityIsland>
      </View>
    </SafeAreaInsetsContext.Provider>
  );
}

export const Tappable: Story = {
  name: 'Tappable: per-activity + fallback',
  render: () => <TappableDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const expectLog = (expected: string) => waitFor(() => expect(canvas.getByTestId('tappable-log').textContent).toBe(expected));
    // Idle strip has no activity, so the island fallback fires.
    await userEvent.click(canvas.getByText('9:41'));
    await expectLog('island');
    // An activity with its own handler overrides the fallback.
    await userEvent.click(canvas.getByText('Charge'));
    await canvas.findByText('Quick charging');
    await userEvent.click(canvas.getByText('Quick charging'));
    await expectLog('island,charging');
    // An activity without a handler falls back to the island.
    await userEvent.click(canvas.getByText('Upload'));
    await canvas.findByText('Uploading 3 files');
    await userEvent.click(canvas.getByText('Uploading 3 files'));
    await expectLog('island,charging,island');
  },
};
