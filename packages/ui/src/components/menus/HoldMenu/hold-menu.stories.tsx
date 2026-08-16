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
 * those stories open with ordinary clicks. An `Interactive` playground reuses
 * the same demo with the story-harness controls — activation, theme,
 * long-press delay and the travel toggles — so every combination can be tuned
 * by hand.
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

const MESSAGES: Message[] = [
  { id: FIRST_MESSAGE_ID, text: INCOMING, outgoing: false },
  { id: 'm2', text: OUTGOING, outgoing: true },
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
 * The chat demo: a `HoldMenuFlatList` of two `HoldItem` bubbles with the full
 * row menu — a title caption, icon rows, a destructive row, separators,
 * `actionParams` spread into `onPress`, chat-bubble `containerStyles` and a
 * `longPressMinDurationMs` override.
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
      <View className="w-full flex-1 gap-3">
        <HoldMenuFlatList
          contentContainerStyle={{ gap: 12, padding: 16 }}
          data={MESSAGES}
          keyExtractor={(item: Message) => item.id}
          renderItem={renderItem}
          style={{ flexGrow: 1 }}
        />
        <Note testID={PICKED_TEST_ID}>{`Picked: ${picked}`}</Note>
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
    <Playground className="min-w-[340px]">
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
// min-height is cast — same pattern as HoverMenu's `WEB_PANEL_POSITION`.
// biome-ignore lint/plugin: calc() is honoured by react-native-web but absent from RN's DimensionValue union, so the web-only style is cast
const STORY_MIN_HEIGHT = { minHeight: 'calc(100vh - 3rem)' } as unknown as ViewStyle;

/**
 * The storybook canvas root (`#storybook-root`) is a plain block with no
 * definite height, so the global `ThemeDecorator`'s `flex-1` (preview.tsx)
 * cannot stretch and the provider's own `flex: 1` collapses to content height
 * — the stories used to render as a small box at the top-left with the
 * full-bleed backdrop dimming only that box. This story-level wrapper gives
 * the canvas a definite height filling the visible page (the global decorator
 * pads 1.5rem per side, hence 100vh minus 3rem) so the demo and its backdrop
 * cover the whole page without creating a scrollbar.
 */
const storyDecorator: Decorator = (Story) => (
  <View className="w-full flex-1" style={STORY_MIN_HEIGHT}>
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

/** Every knob in one canvas: activation, theme, long-press delay, travel toggles. */
export const Interactive: Story = {
  name: 'Interactive: Tune the menu',
  render: () => <HoldMenuPlayground />,
};
