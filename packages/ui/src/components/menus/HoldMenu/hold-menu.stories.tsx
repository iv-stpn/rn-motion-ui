/**
 * Stories for `HoldMenu`, the verbatim port of react-native-hold-menu.
 *
 * These run under react-native-web, where the faithful port keeps upstream's
 * RNGH v2 `Gesture` handlers for every platform — there is no `contextmenu`
 * special-casing like the sibling `HoldMenu`. So on web the interaction is a
 * real press-and-hold (or tap / double-tap, per `activateOn`), which works for
 * a human pointer but not for the synthetic events `play` functions dispatch.
 * The four upstream screens are therefore render-only behind a single
 * `Interactive` toggle, so each one can be held open by hand — the `NestedScroll`
 * story is the exception: it drives the DOM `contextmenu` path (web `'hold'`)
 * to pin the panel's on-screen placement.
 *
 * The scenes mirror `example/src/screens`: Clubhouse (a hold menu on the back
 * chevron), Home (the examples index — rows are holdable, and a theme toggle
 * flips the provider), Telegram (hold-to-open menus on the bottom tab buttons,
 * opened above the bar via `bottom`), and WhatsApp (an inverted chat list of
 * holdable bubbles with reply/copy/edit/pin/forward/delete and `actionParams`).
 */
import type { Decorator, Meta, StoryObj } from '@storybook/react';
import { type ReactElement, useCallback, useState } from 'react';
import { FlatList, Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { AddLine } from 'rn-motion-ui-icons/icons/add-line';
import { ArrowLeftLine } from 'rn-motion-ui-icons/icons/arrow-left-line';
import { ArrowRightLine } from 'rn-motion-ui-icons/icons/arrow-right-line';
import { AtLine } from 'rn-motion-ui-icons/icons/at-line';
import { Chat3Line } from 'rn-motion-ui-icons/icons/chat-3-line';
import { CopyLine } from 'rn-motion-ui-icons/icons/copy-line';
import { CornerDownLeftLine } from 'rn-motion-ui-icons/icons/corner-down-left-line';
import { CornerUpRightLine } from 'rn-motion-ui-icons/icons/corner-up-right-line';
import { Delete2Line } from 'rn-motion-ui-icons/icons/delete-2-line';
import { Home5Line } from 'rn-motion-ui-icons/icons/home-5-line';
import { MapPinLine } from 'rn-motion-ui-icons/icons/map-pin-line';
import { MoonLine } from 'rn-motion-ui-icons/icons/moon-line';
import { Settings3Line } from 'rn-motion-ui-icons/icons/settings-3-line';
import { SunLine } from 'rn-motion-ui-icons/icons/sun-line';
import { User3Line } from 'rn-motion-ui-icons/icons/user-3-line';
import { expect, fireEvent, waitFor, within } from 'storybook/test';
import { Choice, Note, Toggle } from '../../../__stories__/story-harness';
import { Card } from '../../display/Card/card';
import { Text } from '../../typography/Text/text';
import { OVERLAY_OPTIONS, type OverlayType } from '../Overlay/overlay-type';
import { HoldItem } from './hold-item';
import type { HoldMenuIconComponentProps, MenuItemProps } from './hold-menu-types';
import { HoldMenuProvider } from './provider';

/** Icon adapter props — the provider's `iconComponent` contract. */
type IconNameProps = { size?: number; color?: string };

/** Icon name → component map, consumed by the provider's `iconComponent` and by the scenes directly. */
const ICONS: Record<string, (props: IconNameProps) => ReactElement> = {
  'chevron-left': ArrowLeftLine,
  'chevron-right': ArrowRightLine,
  'at-sign': AtLine,
  settings: Settings3Line,
  users: User3Line,
  'message-square': Chat3Line,
  sun: SunLine,
  moon: MoonLine,
  plus: AddLine,
  user: User3Line,
  'corner-down-left': CornerDownLeftLine,
  copy: CopyLine,
  home: Home5Line,
  'map-pin': MapPinLine,
  'corner-up-right': CornerUpRightLine,
  'trash-2': Delete2Line,
};

/**
 * The provider's `iconComponent`: a vector-icon-like adapter that maps an icon
 * `name` string to an rn-motion-ui-icons component — the upstream contract.
 * (Also used directly by the scenes to draw a named icon without the menu.)
 */
function IconByName({ name, size, color }: HoldMenuIconComponentProps) {
  const Icon = ICONS[name] ?? AddLine;
  return <Icon size={size} color={color} />;
}

/** Shared no-op for the static showcase rows whose upstream examples navigate instead. */
const noop = () => {
  /* static showcase — no navigation */
};

/** Optional toggles shared by every scene's provider. */
type SceneProps = { overlay?: OverlayType; closeOnOutsidePress?: boolean };

//#region Clubhouse

/** Clubhouse — a cream screen whose back chevron opens a two-item hold menu. */
function ClubhouseScene({ overlay = 'blur', closeOnOutsidePress = true }: SceneProps) {
  return (
    <HoldMenuProvider closeOnOutsidePress={closeOnOutsidePress} iconComponent={IconByName} overlay={overlay} theme="light">
      <View style={{ flex: 1, backgroundColor: '#F3F0E7' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16 }}>
          <HoldItem
            items={[
              { text: '@you', onPress: noop },
              { text: 'All Rooms', onPress: noop },
            ]}
            containerStyles={{ marginLeft: 16 }}
          >
            <IconByName name="chevron-left" size={32} color="#000000" />
          </HoldItem>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 24, gap: 32 }}>
            <IconByName name="at-sign" size={24} color="#000000" />
            <IconByName name="settings" size={24} color="#000000" />
          </View>
        </View>
        <Note>Press and hold the back chevron to open the menu.</Note>
      </View>
    </HoldMenuProvider>
  );
}

//#endregion

//#region Home

const HOME_ROWS = ['Playground', 'Whatsapp', 'Telegram', 'Clubhouse'];

/** Home — the examples index; rows open a hold menu, and the header toggle flips the provider theme. */
function HomeScene({ overlay = 'blur', closeOnOutsidePress = true }: SceneProps) {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [picked, setPicked] = useState('—');
  const palette =
    theme === 'light'
      ? { bg: '#FFFFFF', secondary: '#F0F0F0', color: '#000000' }
      : { bg: '#131415', secondary: '#2B2D2E', color: '#FFFFFF' };

  const itemsFor = useCallback(
    (title: string): MenuItemProps[] => [
      { text: 'Open', onPress: () => setPicked(`Open ${title}`) },
      { text: 'Share', onPress: () => setPicked(`Share ${title}`), withSeparator: true },
      { text: 'Delete', isDestructive: true, onPress: () => setPicked(`Delete ${title}`) },
    ],
    [],
  );

  return (
    <HoldMenuProvider closeOnOutsidePress={closeOnOutsidePress} iconComponent={IconByName} overlay={overlay} theme={theme}>
      <View style={{ flex: 1, backgroundColor: palette.bg }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 16,
            paddingTop: 16,
            paddingBottom: 8,
          }}
        >
          <Text size="2xl" weight="semibold" style={{ color: palette.color }}>
            Examples
          </Text>
          <Pressable onPress={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
            {theme === 'light' ? (
              <IconByName name="sun" size={24} color={palette.color} />
            ) : (
              <IconByName name="moon" size={24} color={palette.color} />
            )}
          </Pressable>
        </View>
        {HOME_ROWS.map((title, index) => (
          <HoldItem key={title} items={itemsFor(title)} containerStyles={{ width: '100%' }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: 16,
                backgroundColor: palette.secondary,
                borderBottomWidth: index === HOME_ROWS.length - 1 ? 0 : 1.5,
                borderBottomColor: palette.bg,
              }}
            >
              <Text size="base" style={{ color: palette.color }}>
                {title}
              </Text>
              <IconByName name="chevron-right" size={24} color={palette.color} />
            </View>
          </HoldItem>
        ))}
        <View style={{ padding: 16 }}>
          <Note>{`Press and hold a row. Last action: ${picked}`}</Note>
        </View>
      </View>
    </HoldMenuProvider>
  );
}

//#endregion

//#region Telegram

type TelegramTabProps = { icon: string; title: string; items: MenuItemProps[] };

/** A bottom tab whose icon+label is a `HoldItem` — the menu opens above the bar (`bottom`). */
function TelegramTab({ icon, title, items }: TelegramTabProps) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <HoldItem bottom={true} items={items} containerStyles={{ width: '100%' }}>
        <View style={{ width: '100%', alignItems: 'center', paddingVertical: 8 }}>
          <IconByName name={icon} size={18} color="#474747" />
          <Text size="xs" style={{ color: '#474747', marginTop: 8 }}>
            {title}
          </Text>
        </View>
      </HoldItem>
    </View>
  );
}

/** Telegram — a bottom tab bar whose buttons hold-open menus above the bar. */
function TelegramScene({ overlay = 'blur', closeOnOutsidePress = true }: SceneProps) {
  const chatMenu: MenuItemProps[] = [{ text: 'Add Folder', icon: 'plus', onPress: noop }];
  const profileMenu: MenuItemProps[] = [
    { text: 'Add Account', icon: 'plus', onPress: noop },
    { text: 'My Account', icon: 'user', onPress: noop },
  ];

  return (
    <HoldMenuProvider closeOnOutsidePress={closeOnOutsidePress} iconComponent={IconByName} overlay={overlay} theme="light">
      <View style={{ flex: 1, backgroundColor: '#C8D9EA' }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text size="base" style={{ color: '#474747' }}>
            Chat
          </Text>
        </View>
        <View style={{ flexDirection: 'row', backgroundColor: '#FFFFFF' }}>
          <TelegramTab icon="users" title="Calls" items={[]} />
          <TelegramTab icon="message-square" title="Chat" items={chatMenu} />
          <TelegramTab icon="settings" title="Settings" items={profileMenu} />
        </View>
        <Note>Press and hold a tab — the menu opens above the bar.</Note>
      </View>
    </HoldMenuProvider>
  );
}

//#endregion

//#region WhatsApp

type ChatMessage = { id: string; text: string; fromMe: boolean };

/** `WhatsAppBubble` props — named so the parameter type isn't inlined. */
type WhatsAppBubbleProps = { message: ChatMessage; onAction: (label: string) => void };

/** `FlatList` render-item shape for the message rows. */
type MessageRenderItem = { item: ChatMessage };

const WHATSAPP_MESSAGES: ChatMessage[] = [
  { id: 'm1', text: 'Hey! The HoldMenu port is looking great.', fromMe: false },
  { id: 'm2', text: 'Thanks — hold any bubble to see the action panel.', fromMe: true },
  { id: 'm3', text: 'Does it support reply / copy / forward with per-message params?', fromMe: false },
  { id: 'm4', text: 'Yes — actionParams spread into each handler, and delete is destructive.', fromMe: true },
  { id: 'm5', text: 'Long-press a bubble near the bottom; it lifts with the panel.', fromMe: false },
  { id: 'm6', text: 'And tapping the lifted bubble dismisses the menu (closeOnTap).', fromMe: true },
  { id: 'm7', text: 'What about a bubble near the top of the list?', fromMe: false },
  { id: 'm8', text: 'Scroll up, hold one there — the menu flips below the bubble.', fromMe: true },
  { id: 'm9', text: 'Nice. And messages from me show an extra Edit action, right?', fromMe: false },
  { id: 'm10', text: 'Exactly — fromMe bubbles get Reply / Copy / Edit / Pin / Forward / Delete.', fromMe: true },
  { id: 'm11', text: 'While incoming ones skip Edit but keep the rest.', fromMe: false },
  { id: 'm12', text: 'Right. The separator groups the destructive Delete action too.', fromMe: true },
  { id: 'm13', text: 'Does the panel stay open while the list keeps scrolling?', fromMe: false },
  { id: 'm14', text: 'Yes, it tracks the bubble as it lifts and dismisses on tap.', fromMe: true },
  { id: 'm15', text: 'One more at the very bottom to stress the boundary.', fromMe: false },
  { id: 'm16', text: 'Hold it — it should reflow above the panel without clipping.', fromMe: true },
  { id: 'm17', text: 'This is plenty to demo scroll now.', fromMe: false },
  { id: 'm18', text: 'Agreed — a long thread shows the hold menu at every height.', fromMe: true },
];

/** WhatsApp bubble — a holdable chat bubble with the full sender/receiver menu. */
function WhatsAppBubble({ message, onAction }: WhatsAppBubbleProps) {
  const items: MenuItemProps[] = [
    { text: 'Reply', icon: 'corner-down-left', onPress: () => onAction(`Reply ${message.id}`) },
    { text: 'Copy', icon: 'copy', onPress: () => onAction(`Copy "${message.text}"`), withSeparator: true },
    ...(message.fromMe
      ? [{ text: 'Edit', icon: 'home', onPress: () => onAction(`Edit ${message.id}`) } satisfies MenuItemProps]
      : []),
    { text: 'Pin', icon: 'map-pin', onPress: () => onAction('Pin') },
    { text: 'Forward', icon: 'corner-up-right', onPress: () => onAction('Forward'), withSeparator: true },
    { text: 'Delete', icon: 'trash-2', isDestructive: true, onPress: () => onAction('Delete') },
  ];

  const actionParams = { Reply: [message.id], Copy: [message.text], Edit: [message.id, message.text] };

  return (
    <View style={{ width: '100%', alignItems: message.fromMe ? 'flex-end' : 'flex-start', marginTop: 8 }}>
      <HoldItem
        items={items}
        actionParams={actionParams}
        closeOnTap={true}
        containerStyles={{ position: 'relative', maxWidth: '80%' }}
      >
        <View
          style={{
            paddingHorizontal: 8,
            paddingVertical: 8,
            borderRadius: 8,
            borderBottomRightRadius: message.fromMe ? 1 : 8,
            borderBottomLeftRadius: message.fromMe ? 8 : 1,
            backgroundColor: message.fromMe ? 'rgb(218, 248, 201)' : '#FFFFFF',
          }}
        >
          <Text size="base" style={{ color: '#474747', textAlign: 'left' }}>
            {message.text}
          </Text>
        </View>
      </HoldItem>
    </View>
  );
}

/** WhatsApp — a chat list of holdable bubbles over the brand chat background. */
function WhatsAppScene({ overlay = 'blur', closeOnOutsidePress = true }: SceneProps) {
  const [picked, setPicked] = useState('—');
  const onAction = useCallback((label: string) => setPicked(label), []);

  return (
    <HoldMenuProvider closeOnOutsidePress={closeOnOutsidePress} iconComponent={IconByName} overlay={overlay} theme="light">
      <View style={{ flex: 1, backgroundColor: 'rgb(230, 211, 214)' }}>
        <FlatList
          contentContainerStyle={{ paddingHorizontal: 8, paddingVertical: 8 }}
          data={WHATSAPP_MESSAGES}
          keyExtractor={(item: ChatMessage) => item.id}
          renderItem={({ item }: MessageRenderItem) => <WhatsAppBubble message={item} onAction={onAction} />}
          // RN 0.86 defaults `removeClippedSubviews` to TRUE on Android; with
          // the rows' `collapsable={false}` Animated.View + GestureDetector
          // subtrees, a re-render (the menu opening re-renders every bubble)
          // makes the RecyclerView detach/re-attach a clipped cell with a stale
          // parent — the native view ends up double-parented and HWUI's
          // `RenderNode::prepareTreeImpl` recurses on the cycle until the
          // RenderThread stack overflows (SIGSEGV, 500+ identical frames).
          // Same requirement as every FileSystem list view in this package.
          removeClippedSubviews={false}
          scrollEventThrottle={16}
          style={{ flex: 1 }}
        />
        <View style={{ padding: 12, borderTopWidth: 1.5, borderTopColor: 'rgba(0, 0, 0, 0.1)', backgroundColor: '#FFFFFF' }}>
          <Text size="sm" style={{ color: '#474747' }}>
            {`Last action: ${picked}`}
          </Text>
        </View>
        <Note>Press and hold a bubble to open its menu.</Note>
      </View>
    </HoldMenuProvider>
  );
}

//#endregion

//#region NestedScroll

type NestedFile = { id: string; name: string; size: string };
type NestedSection = { id: string; title: string; files: NestedFile[] };
type NestedFileRowProps = { name: string; size: string; onAction: (label: string) => void };
type ScrollingCardProps = { title: string; files: NestedFile[]; onAction: (label: string) => void };

const NESTED_FILE_NAMES = [
  'quarterly-report',
  'onboarding-notes',
  'design-tokens',
  'sprint-board',
  'roadmap',
  'meeting-notes',
  'figma-exports',
  'release-notes',
  'api-spec',
  'migration-plan',
  'style-guide',
  'analytics-dashboard',
];

/** Four sections whose inner lists overflow their cards, so both scroll levels are real. */
const NESTED_SECTIONS: NestedSection[] = ['Recent files', 'Starred', 'Shared with me', 'Archive'].map((title, s) => ({
  id: title.toLowerCase().replaceAll(' ', '-'),
  title,
  files: NESTED_FILE_NAMES.map((name, i) => ({
    id: `${s}-${i}`,
    name: `${name}.md`,
    size: `${(i % 6) + 1}.${i % 9} MB`,
  })),
}));

/** A holdable file row inside a card's inner scroll view. */
function NestedFileRow({ name, size, onAction }: NestedFileRowProps) {
  const items: MenuItemProps[] = [
    { text: 'Open', onPress: () => onAction(`Open ${name}`) },
    { text: 'Rename', onPress: () => onAction(`Rename ${name}`), withSeparator: true },
    { text: 'Delete', isDestructive: true, onPress: () => onAction(`Delete ${name}`) },
  ];

  return (
    <HoldItem items={items} containerStyles={{ width: '100%' }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingVertical: 10,
          paddingHorizontal: 4,
          borderBottomWidth: 1.5,
          borderBottomColor: 'rgba(0, 0, 0, 0.06)',
        }}
      >
        <Text size="base" style={{ color: '#1C1C1E' }}>
          {name}
        </Text>
        <Text size="sm" style={{ color: '#8E8E93' }}>
          {size}
        </Text>
      </View>
    </HoldItem>
  );
}

/** A card whose own scroll view holds the holdable rows — the inner scroll level. */
function ScrollingCard({ title, files, onAction }: ScrollingCardProps) {
  return (
    <Card size="md" elevation={2} className="overflow-hidden">
      <Text size="lg" weight="semibold" style={{ color: '#1C1C1E' }}>
        {title}
      </Text>
      <ScrollView nestedScrollEnabled={true} showsVerticalScrollIndicator={false} style={{ height: 200 }}>
        {files.map((file) => (
          <NestedFileRow key={file.id} name={file.name} size={file.size} onAction={onAction} />
        ))}
      </ScrollView>
    </Card>
  );
}

/**
 * Nested scrolls — a global scroll container with a definite, limited height,
 * whose cards each hold their own inner scroll of holdable rows. The outer
 * height is fixed (not `flex: 1`) so the global scroll is always a real,
 * bounded region regardless of viewport height — two genuine scroll levels.
 */
function NestedScrollScene() {
  const [picked, setPicked] = useState('—');
  const onAction = useCallback((label: string) => setPicked(label), []);

  return (
    <HoldMenuProvider iconComponent={IconByName} theme="light">
      <View style={{ flex: 1, backgroundColor: 'rgb(242, 242, 247)' }}>
        <ScrollView
          nestedScrollEnabled={true}
          showsVerticalScrollIndicator={false}
          // Limited height, not flex:1 — the global container bounds its own
          // scroll, and the cards inside add a second, inner scroll level.
          style={{ height: 480 }}
          contentContainerStyle={{ padding: 16, gap: 16 }}
        >
          <Text size="2xl" weight="semibold" style={{ color: '#1C1C1E' }}>
            Nested card scrolls
          </Text>
          {NESTED_SECTIONS.map((section) => (
            <ScrollingCard key={section.id} title={section.title} files={section.files} onAction={onAction} />
          ))}
        </ScrollView>
        <View style={{ flex: 1 }} />
        <View style={{ padding: 12, borderTopWidth: 1.5, borderTopColor: 'rgba(0, 0, 0, 0.1)', backgroundColor: '#FFFFFF' }}>
          <Text size="sm" style={{ color: '#474747' }}>
            {`Last action: ${picked}`}
          </Text>
        </View>
        <Note>Scroll the outer list, scroll a card, then press-and-hold a row — the twin tracks it.</Note>
      </View>
    </HoldMenuProvider>
  );
}

//#endregion

/** The four upstream example screens, keyed by their toggle label. */
const EXAMPLES = ['Clubhouse', 'Home', 'Telegram', 'WhatsApp'] as const;
type Example = (typeof EXAMPLES)[number];

/**
 * The single `Interactive` story: a `Choice` toggle swaps the full-screen scene
 * in place, so the four upstream examples live behind one sidebar entry instead
 * of four. The toggle bar sits above the scene, outside each scene's own
 * `HoldMenuProvider`, so it stays reachable while a menu is held open.
 */
function InteractiveScene() {
  const [example, setExample] = useState<Example>('WhatsApp');
  const [overlay, setOverlay] = useState<OverlayType>('blur');
  const [closeOnOutside, setCloseOnOutside] = useState(true);

  return (
    <View style={{ flex: 1 }}>
      <View
        style={{
          padding: 12,
          borderBottomWidth: 1.5,
          borderBottomColor: 'rgba(0, 0, 0, 0.1)',
          backgroundColor: '#FFFFFF',
          gap: 8,
        }}
      >
        <Choice label="Example" value={example} options={EXAMPLES} onChange={setExample} />
        <Choice label="Overlay" onChange={setOverlay} options={OVERLAY_OPTIONS} value={overlay} />
        <Toggle label="Close on outside" onChange={setCloseOnOutside} value={closeOnOutside} />
      </View>
      <View style={{ flex: 1 }}>
        {example === 'Clubhouse' ? <ClubhouseScene closeOnOutsidePress={closeOnOutside} overlay={overlay} /> : null}
        {example === 'Home' ? <HomeScene closeOnOutsidePress={closeOnOutside} overlay={overlay} /> : null}
        {example === 'Telegram' ? <TelegramScene closeOnOutsidePress={closeOnOutside} overlay={overlay} /> : null}
        {example === 'WhatsApp' ? <WhatsAppScene closeOnOutsidePress={closeOnOutside} overlay={overlay} /> : null}
      </View>
    </View>
  );
}

// The storybook canvas root has no definite height, so the global decorator's
// `flex-1` cannot stretch and the provider's `flex: 1` collapses. This wrapper
// gives the canvas a definite height (the global decorator pads 1.5rem per
// side, hence 100vh minus 3rem) so each scene and its backdrop cover the whole
// page. The height must be a definite `height`, not `min-height`, so the
// WhatsApp list bounds to it and scrolls internally.
//
// The height comes from `useWindowDimensions` rather than a `calc()` CSS
// length: `calc(100vh - 3rem)` is honoured by react-native-web, but RN's Yoga
// drops the invalid dimension on native — the wrapper collapses to 0 and the
// provider's `flex: 1` chain white-screens the story on Android.
const STORY_HEIGHT_OFFSET = 64;
const storyDecorator: Decorator = (Story) => {
  const { height } = useWindowDimensions();
  return (
    <View className="w-full" style={{ height: Math.max(420, height - STORY_HEIGHT_OFFSET) }}>
      <Story />
    </View>
  );
};

const meta = {
  title: 'Menus/HoldMenu',
  component: HoldMenuProvider,
  parameters: { layout: 'centered' },
  decorators: [storyDecorator],
  // children is supplied per story; a stub satisfies the type checker.
  args: { children: null },
} satisfies Meta<typeof HoldMenuProvider>;

type Story = StoryObj<typeof meta>;

export default meta;

/** Flip between the four upstream example screens, then press-and-hold to open each menu by hand. */
export const Interactive: Story = {
  render: () => <InteractiveScene />,
};

/** The last card's final row — the bottom-most holdable entry after scrolling (NestedScroll play). */
const BOTTOM_ROW_NAME = /^analytics-dashboard\.md/;

/** Nested card scroll views — scroll the outer dashboard and an inner card, then hold a row. */
export const NestedScroll: Story = {
  render: () => <NestedScrollScene />,
  // Pins the two showcase behaviours of this story: a full-width row's
  // centre-anchored panel stays inside the viewport (the pop-in transform's
  // net offset used to shove it off-screen right), and a row held near the
  // bottom of the screen lifts the menu above the lower screen limit.
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // 1. Hold the first row — the panel must be clamped into the viewport.
    const firstRows = await canvas.findAllByText('quarterly-report.md');
    firstRows.sort((a, b) => a.getBoundingClientRect().y - b.getBoundingClientRect().y);
    const firstRow = firstRows[0];
    if (!firstRow) throw new Error('no quarterly-report row rendered');
    fireEvent.contextMenu(firstRow, { clientX: 60, clientY: 150 });
    const panel = await canvas.findByTestId('hold-menu-panel');
    await waitFor(() => {
      const rect = panel.getBoundingClientRect();
      expect(rect.left).toBeGreaterThanOrEqual(-1);
      expect(rect.right).toBeLessThanOrEqual(window.innerWidth + 1);
    });

    // 2. Close, then scroll the dashboard and the last card to the bottom and
    // hold a row near the lower edge — the menu must lift, not run off the
    // bottom of the screen.
    fireEvent.click(await canvas.findByTestId('hold-menu-backdrop'));
    for (const el of [...canvasElement.querySelectorAll('div')]) {
      if (el.scrollHeight > el.clientHeight + 100) el.scrollTop = el.scrollHeight;
    }
    const bottomRow = await waitFor(() => {
      const rows = [...canvasElement.querySelectorAll('div')].filter(
        (el) => BOTTOM_ROW_NAME.test(el.innerText.trim().split('\n')[0] ?? '') && el.getBoundingClientRect().height === 45,
      );
      const visible = rows
        .map((el) => ({ el, y: el.getBoundingClientRect().y }))
        .filter((v) => v.y > 0 && v.y < window.innerHeight - 60);
      visible.sort((a, b) => b.y - a.y);
      const bottom = visible[0];
      if (!bottom) throw new Error('no analytics-dashboard row visible after scrolling');
      return bottom.el;
    });
    fireEvent.contextMenu(bottomRow, { clientX: 60, clientY: 400 });
    await waitFor(() => {
      const rect = panel.getBoundingClientRect();
      expect(rect.bottom).toBeLessThanOrEqual(window.innerHeight + 1);
      expect(rect.right).toBeLessThanOrEqual(window.innerWidth + 1);
    });
  },
};
