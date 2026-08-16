/**
 * Stories for `HoldMenu`, the verbatim port of react-native-hold-menu.
 *
 * These run under react-native-web, where the faithful port keeps upstream's
 * RNGH v2 `Gesture` handlers for every platform — there is no `contextmenu`
 * special-casing like the sibling `HoldMenu`. So on web the interaction is a
 * real press-and-hold (or tap / double-tap, per `activateOn`), which works for
 * a human pointer but not for the synthetic events `play` functions dispatch.
 * The stories are therefore render-only: no `play` assertions, just the four
 * screens from upstream's example app, so each one can be held open by hand.
 *
 * The scenes mirror `example/src/screens`: Clubhouse (a hold menu on the back
 * chevron), Home (the examples index — rows are holdable, and a theme toggle
 * flips the provider), Telegram (hold-to-open menus on the bottom tab buttons,
 * opened above the bar via `bottom`), and WhatsApp (an inverted chat list of
 * holdable bubbles with reply/copy/edit/pin/forward/delete and `actionParams`).
 */
import type { Decorator, Meta, StoryObj } from '@storybook/react';
import { type ReactElement, useCallback, useState } from 'react';
import { Pressable, View, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
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
import { Note } from '../../../__stories__/story-harness';
import { Text } from '../../typography/Text/text';
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

//#region Clubhouse

/** Clubhouse — a cream screen whose back chevron opens a two-item hold menu. */
function ClubhouseScene() {
  return (
    <HoldMenuProvider iconComponent={IconByName} theme="light">
      <View style={{ flex: 1, backgroundColor: '#F3F0E7' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16 }}>
          <HoldItem
            items={[
              { text: '@enesozt', onPress: noop },
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
function HomeScene() {
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
    <HoldMenuProvider iconComponent={IconByName} theme={theme}>
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
                borderBottomWidth: index === HOME_ROWS.length - 1 ? 0 : 1,
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
function TelegramScene() {
  const chatMenu: MenuItemProps[] = [{ text: 'Add Folder', icon: 'plus', onPress: noop }];
  const profileMenu: MenuItemProps[] = [
    { text: 'Add Account', icon: 'plus', onPress: noop },
    { text: 'Enes Ozturk', icon: 'user', onPress: noop },
  ];

  return (
    <HoldMenuProvider iconComponent={IconByName} theme="light">
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
function WhatsAppScene() {
  const [picked, setPicked] = useState('—');
  const onAction = useCallback((label: string) => setPicked(label), []);

  return (
    <HoldMenuProvider iconComponent={IconByName} theme="light">
      <View style={{ flex: 1, backgroundColor: 'rgb(230, 211, 214)' }}>
        <Animated.FlatList
          contentContainerStyle={{ paddingHorizontal: 8, paddingVertical: 8 }}
          data={WHATSAPP_MESSAGES}
          keyExtractor={(item: ChatMessage) => item.id}
          renderItem={({ item }: MessageRenderItem) => <WhatsAppBubble message={item} onAction={onAction} />}
          scrollEventThrottle={16}
          style={{ flex: 1 }}
        />
        <View style={{ padding: 12, borderTopWidth: 1, borderTopColor: 'rgba(0, 0, 0, 0.1)', backgroundColor: '#FFFFFF' }}>
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

// RN's `DimensionValue` has no room for a `calc()` length, so the web-only
// height is cast — same pattern as the sibling HoldMenu stories.
// biome-ignore lint/plugin: calc() is honoured by react-native-web but absent from RN's DimensionValue union, so the web-only style is cast
const STORY_HEIGHT = { height: 'calc(100vh - 3rem)' } as unknown as ViewStyle;

/**
 * The storybook canvas root has no definite height, so the global decorator's
 * `flex-1` cannot stretch and the provider's `flex: 1` collapses. This wrapper
 * gives the canvas a definite height (the global decorator pads 1.5rem per
 * side, hence 100vh minus 3rem) so each scene and its backdrop cover the whole
 * page. The height must be a definite `height`, not `min-height`, so the
 * WhatsApp list bounds to it and scrolls internally.
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

export const Clubhouse: Story = {
  name: 'Clubhouse',
  render: () => <ClubhouseScene />,
};

export const Home: Story = {
  name: 'Home',
  render: () => <HomeScene />,
};

export const Telegram: Story = {
  name: 'Telegram',
  render: () => <TelegramScene />,
};

export const WhatsApp: Story = {
  name: 'WhatsApp',
  render: () => <WhatsAppScene />,
};
