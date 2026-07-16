import type { Meta, StoryObj } from '@storybook/react';
import { MotiView } from 'moti';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { expect, screen, userEvent, within } from 'storybook/test';
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

export default meta;
type Story = StoryObj<typeof meta>;

const BAR_DELAYS = [0, 180, 90, 270];

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

function IslandDemo() {
  const [view, setView] = useState<IslandView>(null);
  const [seconds, setSeconds] = useState(154);

  useEffect(() => {
    if (view !== 'timer') return;
    const id = setInterval(() => setSeconds((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, [view]);

  return (
    <View style={{ alignItems: 'center', gap: 16 }}>
      <View style={{ height: 128, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 8 }}>
        <DynamicIsland
          view={view}
          accessibilityLabel="Dynamic island"
          compact={
            <>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#3fa653' }} />
              <Text style={{ color: '#fafafa', fontSize: 12, fontWeight: '500' }}>9:41</Text>
            </>
          }
        >
          <DynamicIslandView id="call" className="gap-4">
            <View style={{ gap: 2 }}>
              <Text style={{ color: '#fafafa', fontSize: 10, letterSpacing: 1, opacity: 0.6 }}>INCOMING CALL</Text>
              <Text style={{ color: '#fafafa', fontSize: 14, fontWeight: '600' }}>Saurabh</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Button variant="ghost" size="icon" accessibilityLabel="Decline" onPress={() => setView(null)}>
                <PhoneOff size={14} color="#fafafa" />
              </Button>
              <Button variant="ghost" size="icon" accessibilityLabel="Accept" onPress={() => setView(null)}>
                <Phone size={14} color="#fafafa" />
              </Button>
            </View>
          </DynamicIslandView>

          <DynamicIslandView id="timer" className="gap-3">
            <Timer size={16} color="#d99a00" />
            <Text style={{ color: '#fafafa', fontSize: 10, letterSpacing: 1, opacity: 0.6 }}>TIMER</Text>
            <Text style={{ color: '#fafafa', fontSize: 14, fontWeight: '600', fontVariant: ['tabular-nums'] }}>
              {formatClock(seconds)}
            </Text>
          </DynamicIslandView>

          <DynamicIslandView id="music" className="gap-3">
            <Music size={14} color="#fafafa" />
            <View style={{ gap: 1 }}>
              <Text style={{ color: '#fafafa', fontSize: 12, fontWeight: '600' }}>Midnight City</Text>
              <Text style={{ color: '#fafafa', fontSize: 10, opacity: 0.6 }}>M83</Text>
            </View>
            <EqBars />
          </DynamicIslandView>
        </DynamicIsland>
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <Button size="sm" variant="secondary" onPress={() => setView('call')}>
          Call
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onPress={() => {
            setSeconds(154);
            setView('timer');
          }}
        >
          Timer
        </Button>
        <Button size="sm" variant="secondary" onPress={() => setView('music')}>
          Music
        </Button>
        <Button size="sm" variant="ghost" onPress={() => setView(null)}>
          Dismiss
        </Button>
      </View>
    </View>
  );
}

export const Default: Story = {
  render: () => <IslandDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Tapping "Call" expands the island to the call view. "Saurabh" renders in
    // both the offscreen measurer and the visible slot, so match all.
    await userEvent.click(await canvas.findByText('Call'));
    const matches = await screen.findAllByText('Saurabh');
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
          <Text style={{ color: '#fafafa', fontSize: 12, fontWeight: '500' }}>9:41</Text>
        </>
      }
    >
      <DynamicIslandView id="music" className="gap-3">
        <Music size={14} color="#fafafa" />
        <Text style={{ color: '#fafafa', fontSize: 12, fontWeight: '600' }}>Midnight City</Text>
      </DynamicIslandView>
    </DynamicIsland>
  ),
};
