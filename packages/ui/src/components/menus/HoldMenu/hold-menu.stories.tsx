/**
 * Stories for `HoldMenu`, the faithful reimplementation of
 * react-native-hold-menu.
 *
 * These run under react-native-web, which is the platform where the component
 * deliberately does something else: `activateOn="hold"` is a right-click that
 * opens a dropdown anchored to the item — children still render exactly once
 * (the portal twin stays native-only), but the item performs the lift in
 * place: a quick squeeze, then it scales back up and glides with the panel as
 * the menu pops out of it. The backdrop still dims the page behind the panel —
 * a blurred translucent scrim, since web joins the blur-capable tier (see
 * `hold-menu-blur.tsx`) — and the `play` functions pin that contract: a
 * right-click and the keyboard `contextmenu` path open the panel, a press on a
 * row runs its `actionParams` and closes it, and a click on the dimmed
 * backdrop closes it too. `'tap'` and `'double-tap'` keep the press on web, so
 * those stories open with ordinary clicks.
 *
 * The demo is a full chat thread: a header, fifteen `HoldItem` bubbles in a
 * `HoldMenuFlatList` that fills the story page and scrolls internally, and a
 * pinned footer readout. Because the list is a real scroll view, every
 * placement behaviour is exercisable by hand — hold a bubble near the bottom
 * edge and the panel travels up with the item, hold one near the top and it
 * drops down, scroll mid-thread and the menu clamps to the viewport. An
 * `Interactive` playground reuses the same chat with the story-harness
 * controls — activation, theme, long-press delay and the travel toggles — so
 * every combination can be tuned by hand.
 */
import type { Decorator, Meta, StoryObj } from '@storybook/react';
import { type ReactElement, useCallback, useState } from 'react';
import { View, type ViewStyle } from 'react-native';
import { Chat1Line as MessageCircle } from 'rn-motion-ui-icons/icons/chat-1-line';
import { CopyLine as Copy } from 'rn-motion-ui-icons/icons/copy-line';
import { Delete2Line as Trash2 } from 'rn-motion-ui-icons/icons/delete-2-line';
import { PinLine as Pin } from 'rn-motion-ui-icons/icons/pin-line';
import { ShareForwardLine as Share2 } from 'rn-motion-ui-icons/icons/share-forward-line';
import { expect, screen, userEvent, waitFor, within } from 'storybook/test';
import { Choice, ControlCard, Note, Playground, Toggle } from '../../../__stories__/story-harness';
import { cn } from '../../../lib/cn';
import { Text } from '../../typography/Text/text';
import { HoldItem } from './hold-item';
import { HoldMenuFlatList } from './hold-menu-flat-list';
import { HoldMenuProvider } from './hold-menu-provider';
import type { HoldMenuIconComponentProps, MenuItemProps } from './hold-menu-types';

const INCOMING = 'Ported the hold menu — right-click me here, hold me on a phone.';
const OUTGOING = 'Same panel, anchored to the other edge.';
const REPLY = 'Reply';
const FORWARD = 'Forward';
const HEADING = 'Message';
const DEMO_TEST_ID = 'story-hold-menu-item';
const PICKED_TEST_ID = 'story-hold-picked';
const FIRST_MESSAGE_ID = 'm1';

/** Icon adapter props — the provider's iconComponent contract. */
type IconNameProps = { size?: number; color?: string };

/** Icon name → component map, consumed by the provider's `iconComponent`. */
const ICONS: Record<string, (props: IconNameProps) => ReactElement> = {
  chat: MessageCircle,
  copy: Copy,
  forward: Share2,
  pin: Pin,
  trash: Trash2,
};

/**
 * The provider's `iconComponent`: a vector-icon-like adapter that maps an icon
 * `name` string to an rn-motion-ui-icons component — the upstream contract.
 */
function IconByName({ name, size, color }: HoldMenuIconComponentProps) {
  const Icon = ICONS[name] ?? MessageCircle;
  return <Icon size={size} color={color} />;
}

type Message = { id: string; text: string; outgoing: boolean };

/** FlatList row — a message and its HoldItem. */
type MessageRow = { item: Message };

/**
 * A full chat thread — fifteen unique bubbles so the list actually scrolls and
 * every placement behaviour can be tried by hand (top drop-down, mid-thread
 * clamping, bottom up-travel).
 */
const MESSAGES: Message[] = [
  { id: FIRST_MESSAGE_ID, text: INCOMING, outgoing: false },
  { id: 'm2', text: OUTGOING, outgoing: true },
  { id: 'm3', text: 'The backdrop blurs the page behind the panel now — iOS, Android and web.', outgoing: false },
  { id: 'm4', text: 'Nice. And when the menu does not fit below, the item glides up with it.', outgoing: true },
  { id: 'm5', text: 'Right — clamped to the safe area, so it never runs off screen.', outgoing: false },
  { id: 'm6', text: 'Does the long-press delay behave on Android?', outgoing: true },
  { id: 'm7', text: 'Yes — haptics fire once at the threshold, then the panel lifts.', outgoing: false },
  { id: 'm8', text: 'The destructive row is tinted red with a separator above it.', outgoing: true },
  { id: 'm9', text: 'And each bubble can open on tap, double-tap or hold — per item.', outgoing: false },
  { id: 'm10', text: 'Try the Interactive story: every knob maps to a real prop.', outgoing: true },
  { id: 'm11', text: 'Scroll to the bottom and hold the last message.', outgoing: false },
  { id: 'm12', text: 'It flips above the bubble when it would overflow the viewport.', outgoing: true },
  { id: 'm13', text: 'Pinning the item in place keeps the bubble still while the panel opens.', outgoing: false },
  { id: 'm14', text: 'Close on tap? One tap anywhere dismisses the whole menu.', outgoing: true },
  { id: 'm15', text: 'Shipped — hold any of the fifteen bubbles to try it.', outgoing: false },
];

type BubbleProps = { text: string; outgoing?: boolean };

/** A chat bubble — the shape this interaction was built for. */
function Bubble({ text, outgoing = false }: BubbleProps) {
  return (
    <View
      className={cn('max-w-[260px] rounded-2xl px-4 py-2.5', outgoing ? 'rounded-br-md bg-info' : 'rounded-bl-md bg-surface-3')}
    >
      <Text className={outgoing ? 'text-info-foreground' : 'text-foreground'} size="sm">
        {text}
      </Text>
    </View>
  );
}

/** Chat header — makes the demo read as a real thread, not loose bubbles. */
function ChatHeader() {
  return (
    <View className="flex-row items-center gap-3 border-border border-b bg-surface-1 px-4 py-2.5">
      <View className="h-9 w-9 items-center justify-center rounded-full bg-info">
        <Text className="text-info-foreground" size="sm" weight="semibold">
          HM
        </Text>
      </View>
      <View className="gap-0.5">
        <Text className="text-foreground" size="sm" weight="semibold">
          Hold Menu
        </Text>
        <Text className="text-muted-foreground" size="xs">
          Hold or right-click any bubble — 15 messages, scroll to test travel
        </Text>
      </View>
    </View>
  );
}

type DemoProps = {
  activateOn?: 'tap' | 'double-tap' | 'hold';
  bottom?: boolean;
  closeOnTap?: boolean;
  disableMove?: boolean;
  longPressMinDurationMs?: number;
  theme?: 'light' | 'dark';
  testID?: string;
};

/**
 * The chat demo: a header, a full-height scrollable `HoldMenuFlatList` of
 * fifteen `HoldItem` bubbles with the full row menu — a title caption, icon
 * rows, a destructive row, separators, `actionParams` spread into `onPress`,
 * chat-bubble `containerStyles` and a `longPressMinDurationMs` override — and
 * a pinned footer readout. `flex: 1` on the list bounds it to the remaining
 * height so it scrolls internally instead of growing the page.
 */
function HoldMenuDemo({
  activateOn = 'hold',
  bottom,
  closeOnTap,
  disableMove,
  longPressMinDurationMs,
  theme = 'light',
  testID = DEMO_TEST_ID,
}: DemoProps) {
  const [picked, setPicked] = useState('—');

  const buildItems = useCallback(
    (_messageId: string): MenuItemProps[] => [
      { text: HEADING, isTitle: true },
      {
        text: REPLY,
        icon: 'chat',
        onPress: (id: string) => setPicked(`Replied to ${id}`),
        withSeparator: true,
      },
      { text: 'Copy', icon: 'copy', onPress: () => setPicked('Copied') },
      { text: 'Pin', icon: 'pin', onPress: () => setPicked('Pinned') },
      { text: FORWARD, icon: 'forward', onPress: () => setPicked('Forwarded'), withSeparator: true },
      { text: 'Delete', icon: 'trash', isDestructive: true, onPress: () => setPicked('Deleted') },
    ],
    [],
  );

  const renderItem = useCallback(
    ({ item }: MessageRow) => (
      <HoldItem
        actionParams={{ [REPLY]: [item.id] }}
        activateOn={activateOn}
        bottom={bottom}
        closeOnTap={closeOnTap}
        containerStyles={{ maxWidth: '80%' }}
        disableMove={disableMove}
        items={buildItems(item.id)}
        longPressMinDurationMs={longPressMinDurationMs}
        testID={`${testID}-${item.id}`}
      >
        <Bubble outgoing={item.outgoing} text={item.text} />
      </HoldItem>
    ),
    [activateOn, bottom, buildItems, closeOnTap, disableMove, longPressMinDurationMs, testID],
  );

  return (
    <HoldMenuProvider iconComponent={IconByName} theme={theme}>
      <View className="w-full flex-1">
        <ChatHeader />
        <HoldMenuFlatList
          contentContainerStyle={{ gap: 12, padding: 16 }}
          data={MESSAGES}
          keyExtractor={(item: Message) => item.id}
          renderItem={renderItem}
          style={{ flex: 1 }}
        />
        <View className="border-border border-t px-4 py-2">
          <Note testID={PICKED_TEST_ID}>{`Picked: ${picked}`}</Note>
        </View>
      </View>
    </HoldMenuProvider>
  );
}

const ACTIVATE_OPTIONS = ['hold', 'tap', 'double-tap'] as const;
const THEME_OPTIONS = ['light', 'dark'] as const;
const LONG_PRESS_OPTIONS = ['150', '300', '500'] as const;

type ActivateOnKey = (typeof ACTIVATE_OPTIONS)[number];
type ThemeKey = (typeof THEME_OPTIONS)[number];
type LongPressKey = (typeof LONG_PRESS_OPTIONS)[number];

/** The story-harness playground: every knob from the demos in one canvas. */
function HoldMenuPlayground() {
  const [activateOn, setActivateOn] = useState<ActivateOnKey>('hold');
  const [theme, setTheme] = useState<ThemeKey>('light');
  const [longPressMs, setLongPressMs] = useState<LongPressKey>('150');
  const [bottom, setBottom] = useState(false);
  const [closeOnTap, setCloseOnTap] = useState(true);
  const [disableMove, setDisableMove] = useState(false);

  return (
    <Playground className="min-w-[340px] flex-1">
      <ControlCard title="Menu">
        <Choice label="Activate on" onChange={setActivateOn} options={ACTIVATE_OPTIONS} value={activateOn} />
        <Choice label="Theme" onChange={setTheme} options={THEME_OPTIONS} value={theme} />
        <Choice label="Long-press (ms)" onChange={setLongPressMs} options={LONG_PRESS_OPTIONS} value={longPressMs} />
      </ControlCard>

      <ControlCard title="Behaviour">
        <Toggle label="Open above the item" onChange={setBottom} value={bottom} />
        <Toggle label="Close on tap" onChange={setCloseOnTap} value={closeOnTap} />
        <Toggle label="Pin the item in place" onChange={setDisableMove} value={disableMove} />
      </ControlCard>

      <HoldMenuDemo
        activateOn={activateOn}
        bottom={bottom}
        closeOnTap={closeOnTap}
        disableMove={disableMove}
        longPressMinDurationMs={Number(longPressMs)}
        theme={theme}
      />
      <Note>Right-click a bubble (or hold on a phone) to open its menu — the controls change how it behaves.</Note>
    </Playground>
  );
}

// RN's `DimensionValue` has no room for a `calc()` length, so the web-only
// height is cast — same pattern as HoverMenu's `WEB_PANEL_POSITION`.
// biome-ignore lint/plugin: calc() is honoured by react-native-web but absent from RN's DimensionValue union, so the web-only style is cast
const STORY_HEIGHT = { height: 'calc(100vh - 3rem)' } as unknown as ViewStyle;

/**
 * The storybook canvas root (`#storybook-root`) is a plain block with no
 * definite height, so the global `ThemeDecorator`'s `flex-1` (preview.tsx)
 * cannot stretch and the provider's own `flex: 1` collapses to content height
 * — the stories used to render as a small box at the top-left with the
 * full-bleed backdrop dimming only that box. This story-level wrapper gives
 * the canvas a DEFINITE height filling the visible page (the global decorator
 * pads 1.5rem per side, hence 100vh minus 3rem) so the demo and its backdrop
 * cover the whole page without creating a scrollbar.
 *
 * The height must be a definite `height`, not a `min-height`: the chat demo
 * is a full 15-message thread taller than most viewports, and `min-height`
 * only sets a floor — content taller than it grows the wrapper and the page
 * scrolls instead of the list. A definite height lets the `flex: 1` chain
 * (provider root → demo → FlatList, all with RNW's base `min-height: 0`)
 * bound the list so it scrolls internally.
 *
 * The wrapper must NOT carry `flex-1`: a definite `flex-basis: 0%` overrides
 * the `height` property for a flex item (CSS flexbox — the height is ignored
 * and the wrapper sizes to content again). `min-height` was immune to that
 * override, which is why the old recipe used it — but a floor is not enough
 * once the content is taller than the viewport.
 */
const storyDecorator: Decorator = (Story) => (
  <View className="w-full" style={STORY_HEIGHT}>
    <Story />
  </View>
);

const meta = {
  title: 'Menus/HoldMenu',
  component: HoldMenuProvider,
  parameters: { layout: 'fullscreen' },
  decorators: [storyDecorator],
  // children is supplied per story; a stub satisfies the type checker.
  args: { children: null },
} satisfies Meta<typeof HoldMenuProvider>;

type Story = StoryObj<typeof meta>;

export default meta;

/**
 * The default gesture, per platform: hold on native, right-click here.
 *
 * The first assertion is a negative — the children render exactly once on web.
 * Upstream's portal twin (a second copy of the children that takes over while
 * the menu is open) is skipped entirely on web, so the DOM is never duplicated;
 * what a consumer would feel is a bubble that is still the one in the page.
 *
 * The right-click is the keyboard path too, since browsers raise `contextmenu`
 * for Shift+F10 and the ContextMenu key on the focused trigger — the play
 * dispatches that event directly to pin it.
 */

/** Every knob in one canvas: activation, theme, long-press delay, travel toggles. */
export const Interactive: Story = {
  name: 'Interactive',
  render: () => <HoldMenuPlayground />,
};

export const Default: Story = {
  name: 'Demo: Right-click to open the menu',
  render: (args) => <HoldMenuDemo {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = await canvas.findByTestId(`${DEMO_TEST_ID}-${FIRST_MESSAGE_ID}`);

    await userEvent.pointer({ target: trigger, keys: '[MouseRight]' });

    // The panel is the floating surface; the menu appears with its rows.
    const panel = await screen.findByTestId(`${DEMO_TEST_ID}-${FIRST_MESSAGE_ID}-panel`);
    await waitFor(() => expect(panel).toBeVisible());
    await expect(within(panel).getByTestId(`${DEMO_TEST_ID}-${FIRST_MESSAGE_ID}-menu-item-${REPLY}`)).toBeInTheDocument();

    // Web renders the children once — the portal twin is native-only.
    await expect(screen.getAllByText(INCOMING)).toHaveLength(1);
    await expect(screen.getAllByText(OUTGOING)).toHaveLength(1);

    // Picking a row runs its onPress with the actionParams spread, then closes.
    await userEvent.click(within(panel).getByTestId(`${DEMO_TEST_ID}-${FIRST_MESSAGE_ID}-menu-item-${REPLY}`));
    await waitFor(() => expect(canvas.getByTestId(PICKED_TEST_ID)).toHaveTextContent('Replied to m1'));
    await waitFor(() => expect(panel).not.toBeVisible());

    // Clicking the dimmed backdrop is the other way out.
    await userEvent.pointer({ target: trigger, keys: '[MouseRight]' });
    await screen.findByTestId(`${DEMO_TEST_ID}-${FIRST_MESSAGE_ID}-panel`);
    await waitFor(() => expect(panel).toBeVisible());
    await userEvent.click(await screen.findByTestId(`${DEMO_TEST_ID}-${FIRST_MESSAGE_ID}-backdrop`));
    await waitFor(() => expect(panel).not.toBeVisible());

    // The keyboard path: browsers raise `contextmenu` for Shift+F10 and the
    // ContextMenu key on the focused trigger, so the DOM event opens the menu.
    trigger.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
    await waitFor(() => expect(panel).toBeVisible());
  },
};

/** The dark palette — the panel and the scrim swap to their dark variants. */
export const DarkTheme: Story = {
  name: 'Demo: Dark theme',
  render: (args) => <HoldMenuDemo {...args} theme="dark" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = await canvas.findByTestId(`${DEMO_TEST_ID}-${FIRST_MESSAGE_ID}`);
    await userEvent.pointer({ target: trigger, keys: '[MouseRight]' });
    const panel = await screen.findByTestId(`${DEMO_TEST_ID}-${FIRST_MESSAGE_ID}-panel`);
    await waitFor(() => expect(panel).toBeVisible());
    // Web dark scrim — the blur tier's BACKDROP_DARK_BACKGROUND_COLOR (Android
    // blurs too; only the no-expo-blur fallback keeps the near-opaque dim).
    const backdrop = await screen.findByTestId(`${DEMO_TEST_ID}-${FIRST_MESSAGE_ID}-backdrop`);
    await expect(getComputedStyle(backdrop).backgroundColor).toBe('rgba(0, 0, 0, 0.5)');
    // The backdrop testID sits on the inner tint view; its parent is the blur
    // layer, which frosts the page behind the tint via CSS backdrop-filter.
    const blurLayer = backdrop.parentElement;
    if (!blurLayer) throw new Error('backdrop blur layer not found');
    await expect(getComputedStyle(blurLayer).backdropFilter).toContain('blur');
  },
};

/** `activateOn="tap"` keeps the press on web — a click opens the menu. */
export const TapActivation: Story = {
  name: 'Demo: Tap to open',
  render: (args) => <HoldMenuDemo {...args} activateOn="tap" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = await canvas.findByTestId(`${DEMO_TEST_ID}-${FIRST_MESSAGE_ID}`);
    await userEvent.click(trigger);
    const panel = await screen.findByTestId(`${DEMO_TEST_ID}-${FIRST_MESSAGE_ID}-panel`);
    await waitFor(() => expect(panel).toBeVisible());
    await expect(within(panel).getByText(REPLY)).toBeInTheDocument();
  },
};

/** `activateOn="double-tap"` — two clicks open the menu. */
export const DoubleTapActivation: Story = {
  name: 'Demo: Double-tap to open',
  render: (args) => <HoldMenuDemo {...args} activateOn="double-tap" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = await canvas.findByTestId(`${DEMO_TEST_ID}-${FIRST_MESSAGE_ID}`);
    await userEvent.dblClick(trigger);
    const panel = await screen.findByTestId(`${DEMO_TEST_ID}-${FIRST_MESSAGE_ID}-panel`);
    await waitFor(() => expect(panel).toBeVisible());
  },
};

/** `bottom` opens the menu above the item instead of below it. */
export const Bottom: Story = {
  name: 'Demo: Open above the item',
  render: (args) => <HoldMenuDemo {...args} bottom={true} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = await canvas.findByTestId(`${DEMO_TEST_ID}-${FIRST_MESSAGE_ID}`);
    await userEvent.pointer({ target: trigger, keys: '[MouseRight]' });
    const panel = await screen.findByTestId(`${DEMO_TEST_ID}-${FIRST_MESSAGE_ID}-panel`);
    await waitFor(() => expect(panel).toBeVisible());
  },
};
