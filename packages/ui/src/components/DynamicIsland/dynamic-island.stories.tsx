import { MotiView } from '@rn-motion-ui/moti/view';
import type { Meta, StoryObj } from '@storybook/react';
import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { expect, screen, userEvent, within } from 'storybook/test';
import { useInterval } from '../../hooks/use-interval';
import { useReducedMotion } from '../../hooks/use-reduced-motion';
import { Music, Phone, PhoneOff, Timer } from '../../lib/icons';
import { Button } from '../Button/button';
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
          style={{ width: 2, height: 16, borderRadius: 999, backgroundColor: '#3fa653' }}
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

// biome-ignore lint/style/useComponentExportOnlyModules: story helper
function IslandDemo() {
  const [view, setView] = useState<IslandView>(null);
  const [seconds, setSeconds] = useState(154);

  useInterval(() => setSeconds((s) => (s > 0 ? s - 1 : 0)), view === 'timer' ? 1000 : null);

  const dismiss = useCallback(() => setView(null), []);
  const showCall = useCallback(() => setView('call'), []);
  const showTimer = useCallback(() => {
    setSeconds(154);
    setView('timer');
  }, []);
  const showMusic = useCallback(() => setView('music'), []);

  return (
    <View style={{ alignItems: 'center', gap: 16 }}>
      <View style={{ height: 128, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 8 }}>
        <DynamicIsland
          view={view}
          accessibilityLabel="Dynamic island"
          compact={
            <>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#3fa653' }} />
              <Text style={{ color: '#fafafa', fontSize: 12, fontWeight: '500' }}>{CLOCK}</Text>
            </>
          }
        >
          {/* biome-ignore lint/correctness/useUniqueElementIds: not a DOM id — DynamicIslandView renders null; `id` is a view descriptor the parent matches against its `view` prop */}
          <DynamicIslandView id="call" className="gap-4">
            <View style={{ gap: 2 }}>
              <Text style={{ color: '#fafafa', fontSize: 10, letterSpacing: 1, opacity: 0.6 }}>{INCOMING_CALL}</Text>
              <Text style={{ color: '#fafafa', fontSize: 14, fontWeight: '600' }}>{CALLER}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Button variant="ghost" size="icon" accessibilityLabel="Decline" onPress={dismiss}>
                <PhoneOff size={14} color="#fafafa" />
              </Button>
              <Button variant="ghost" size="icon" accessibilityLabel="Accept" onPress={dismiss}>
                <Phone size={14} color="#fafafa" />
              </Button>
            </View>
          </DynamicIslandView>

          {/* biome-ignore lint/correctness/useUniqueElementIds: not a DOM id — DynamicIslandView renders null; `id` is a view descriptor the parent matches against its `view` prop */}
          <DynamicIslandView id="timer" className="gap-3">
            <Timer size={16} color="#d99a00" />
            <Text style={{ color: '#fafafa', fontSize: 10, letterSpacing: 1, opacity: 0.6 }}>{TIMER_LABEL}</Text>
            <Text style={{ color: '#fafafa', fontSize: 14, fontWeight: '600', fontVariant: ['tabular-nums'] }}>
              {formatClock(seconds)}
            </Text>
          </DynamicIslandView>

          {/* biome-ignore lint/correctness/useUniqueElementIds: not a DOM id — DynamicIslandView renders null; `id` is a view descriptor the parent matches against its `view` prop */}
          <DynamicIslandView id="music" className="gap-3">
            <Music size={14} color="#fafafa" />
            <View style={{ gap: 1 }}>
              <Text style={{ color: '#fafafa', fontSize: 12, fontWeight: '600' }}>{TRACK_TITLE}</Text>
              <Text style={{ color: '#fafafa', fontSize: 10, opacity: 0.6 }}>{TRACK_ARTIST}</Text>
            </View>
            <EqBars />
          </DynamicIslandView>
        </DynamicIsland>
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <Button size="sm" variant="secondary" onPress={showCall}>
          {CALL_ACTION}
        </Button>
        <Button size="sm" variant="secondary" onPress={showTimer}>
          {TIMER_ACTION}
        </Button>
        <Button size="sm" variant="secondary" onPress={showMusic}>
          {MUSIC_ACTION}
        </Button>
        <Button size="sm" variant="ghost" onPress={dismiss}>
          {DISMISS_ACTION}
        </Button>
      </View>
    </View>
  );
}

export default meta;

export const Default: Story = {
  render: () => <IslandDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Tapping "Call" expands the island to the call view. "Saurabh" renders in
    // both the offscreen measurer and the visible slot, so match all.
    await userEvent.click(await canvas.findByText(CALL_ACTION));
    const matches = await screen.findAllByText(CALLER);
    await expect(matches.length).toBeGreaterThan(0);
  },
};

export const Compact: Story = {
  args: { view: null },
  render: () => (
    <DynamicIsland
      view={null}
      accessibilityLabel="Dynamic island"
      compact={
        <>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#3fa653' }} />
          <Text style={{ color: '#fafafa', fontSize: 12, fontWeight: '500' }}>{CLOCK}</Text>
        </>
      }
    >
      {/* biome-ignore lint/correctness/useUniqueElementIds: not a DOM id — DynamicIslandView renders null; `id` is a view descriptor the parent matches against its `view` prop */}
      <DynamicIslandView id="music" className="gap-3">
        <Music size={14} color="#fafafa" />
        <Text style={{ color: '#fafafa', fontSize: 12, fontWeight: '600' }}>{TRACK_TITLE}</Text>
      </DynamicIslandView>
    </DynamicIsland>
  ),
};
