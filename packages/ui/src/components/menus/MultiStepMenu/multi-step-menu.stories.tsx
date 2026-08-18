import type { Meta, StoryObj } from '@storybook/react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { MoonLine as Moon } from 'rn-motion-ui-icons/icons/moon-line';
import { NotificationLine as Bell } from 'rn-motion-ui-icons/icons/notification-line';
import { ShieldLine as ShieldCheck } from 'rn-motion-ui-icons/icons/shield-line';
import { User2Line as User } from 'rn-motion-ui-icons/icons/user-2-line';
import { expect, screen, userEvent, within } from 'storybook/test';
import {
  Action,
  Choice,
  ControlCard,
  Note,
  Playground,
  Sample,
  Section,
  Toggle,
  Variants,
} from '../../../__stories__/story-harness';
import { TriggerButton, TriggerControls, useTriggerState } from '../../../__stories__/story-trigger';
import { useBreakpointAtLeast } from '../../../hooks/use-breakpoint';
import { Button } from '../../form/Button/button';
import { MenuItem } from '../../rows/menu-item';
import { Text } from '../../typography/Text/text';
import type { MultiStepHelpers, MultiStepMenuHandle, MultiStepSection } from './multi-step-menu';
import { MenuRow, MultiStepMenu } from './multi-step-menu';

const EMPTY_SECTIONS: MultiStepSection[] = [];

const meta = {
  title: 'Menus/MultiStepMenu',
  component: MultiStepMenu,
  parameters: { layout: 'fullscreen' },
  // All required props are managed by each story's render fn; stubs satisfy the type checker
  args: {
    isWideScreen: false,
    visible: false,
    onClose: () => undefined,
    sections: EMPTY_SECTIONS,
    sidebar: () => null,
    smallScreenMenu: () => null,
    rootTitle: '',
  },
} satisfies Meta<typeof MultiStepMenu>;

type Story = StoryObj<typeof meta>;

const SETTINGS_ROOT_TITLE = 'Settings';
const OPEN_SETTINGS_LABEL = 'Open settings';

// ── Shared fixture data ────────────────────────────────────────────────────

const ACCOUNT_BODY = 'Manage your profile, email, and password.';
const NOTIFICATIONS_BODY = 'Choose which alerts you receive and how.';
const APPEARANCE_BODY = 'Light, dark, or system theme.';
const ADVANCED_APPEARANCE_LABEL = 'Advanced options →';
const ADVANCED_BODY = 'Font size, contrast, motion settings.';
const PRIVACY_BODY = 'Two-factor auth, connected apps, and data.';

type AppearanceSectionProps = { helpers: MultiStepHelpers };

function AppearanceSection({ helpers }: AppearanceSectionProps) {
  const navigateAdvanced = useCallback(() => helpers.navigate('appearance/advanced'), [helpers]);
  return (
    <View className="gap-3">
      <Text className="text-muted-foreground">{APPEARANCE_BODY}</Text>
      <Button variant="secondary" size="sm" onPress={navigateAdvanced}>
        {ADVANCED_APPEARANCE_LABEL}
      </Button>
    </View>
  );
}

const sections: MultiStepSection[] = [
  {
    path: 'account',
    title: 'Account',
    render: () => <Text className="text-muted-foreground">{ACCOUNT_BODY}</Text>,
  },
  {
    path: 'notifications',
    title: 'Notifications',
    render: () => <Text className="text-muted-foreground">{NOTIFICATIONS_BODY}</Text>,
  },
  {
    path: 'appearance',
    title: 'Appearance',
    render: (helpers) => <AppearanceSection helpers={helpers} />,
    subsections: [
      {
        path: 'advanced',
        title: 'Advanced Appearance',
        render: () => <Text className="text-muted-foreground">{ADVANCED_BODY}</Text>,
      },
    ],
  },
  {
    path: 'privacy',
    title: 'Privacy & Security',
    render: () => <Text className="text-muted-foreground">{PRIVACY_BODY}</Text>,
  },
];

// `iconBackgroundColor` is a decorative per-row accent, not a themed surface. theme-exempt.
type MenuEntry = { path: string; label: string; icon: typeof User; color: string };

const MENU_ENTRIES = [
  { path: 'account', label: 'Account', icon: User, color: '#3b82f6' },
  { path: 'notifications', label: 'Notifications', icon: Bell, color: '#f59e0b' },
  { path: 'appearance', label: 'Appearance', icon: Moon, color: '#8b5cf6' },
  { path: 'privacy', label: 'Privacy & Security', icon: ShieldCheck, color: '#10b981' },
] as const satisfies readonly MenuEntry[];

type MenuEntryRowProps = { entry: MenuEntry; active?: boolean; iosStyle?: boolean; onNavigate?: (path: string) => void };

/**
 * One navigation row in either of the two shapes a menu list can take:
 * `MenuRow` (iOS-style coloured icon tile) or a plain `MenuItem` in `sidebar`
 * mode, whose icon and label follow the theme's muted/foreground tokens.
 */

function MenuEntryRow({ entry, active = false, iosStyle = false, onNavigate }: MenuEntryRowProps) {
  const handlePress = useCallback(() => onNavigate?.(entry.path), [entry.path, onNavigate]);
  // Everything but the icon treatment is shared, so only that part differs per style.
  const shared = { icon: entry.icon, label: entry.label, active, onPress: handlePress };
  return iosStyle ? <MenuRow {...shared} iconBackgroundColor={entry.color} /> : <MenuItem {...shared} mode="sidebar" />;
}

type MenuListProps = { helpers: MultiStepHelpers; iosStyle: boolean };

function MenuList({ helpers, iosStyle }: MenuListProps) {
  const navigate = useCallback((path: string) => helpers.navigate([path]), [helpers]);
  // Only the wide sidebar keeps a visible selection; the small-screen root is a launcher.
  const selected = helpers.isWideScreen ? helpers.path[0] : undefined;
  return (
    <View className="gap-1">
      {MENU_ENTRIES.map((entry) => (
        <MenuEntryRow entry={entry} active={entry.path === selected} iosStyle={iosStyle} key={entry.path} onNavigate={navigate} />
      ))}
    </View>
  );
}

/** The same list serves both slots — `isWideScreen` already tells it which one it is. */
const makeMenuRenderer = (iosStyle: boolean) => (h: MultiStepHelpers) => <MenuList helpers={h} iosStyle={iosStyle} />;

const DEFAULT_MENU_RENDERER = makeMenuRenderer(false);

// ── Playground ─────────────────────────────────────────────────────────────

const START_OPTIONS = [
  { value: 'none', label: 'Placeholder' },
  { value: 'account', label: 'Account' },
  { value: 'advanced', label: 'Appearance → Advanced' },
] as const;
type StartKey = (typeof START_OPTIONS)[number]['value'];

// Wide screens adopt `defaultPath` as the initial sidebar selection; small screens always start at the root.
// `defaultPath` is a mutable `string[]`, so these can't be `as const`.
const START_PATHS: Record<StartKey, string[] | undefined> = {
  account: ['account'],
  advanced: ['appearance', 'advanced'],
  none: undefined,
};

const WIDE_PANEL_SIZE = { width: 700, height: 480 } as const;
const RESET_LABEL = 'Reset to root';
const JUMP_LABEL = 'Jump to Advanced';
const SIDEBAR_FOOTER_LABEL = 'v2.4.0';
const PLACEHOLDER_TITLE = 'Pick a section';
const PLACEHOLDER_BODY = 'Nothing is selected yet.';
const CLOSED_NOTE = 'Closed';
const START_NOTE = 'Initial selection and the panel size only apply to the wide layout.';

const SIDEBAR_FOOTER = (
  <Text className="text-muted-foreground" size="sm">
    {SIDEBAR_FOOTER_LABEL}
  </Text>
);

const WIDE_PLACEHOLDER = (
  <View className="flex-1 items-center justify-center gap-1.5">
    <Text size="lg" weight="semibold">
      {PLACEHOLDER_TITLE}
    </Text>
    <Text className="text-muted-foreground" size="sm">
      {PLACEHOLDER_BODY}
    </Text>
  </View>
);

/**
 * Self-contained `MultiStepMenu` owns its `AdaptiveModal` shell: a full sheet on
 * small screens (slide up/down) and a centered panel on wide screens.
 * `onAfterClose` resets the menu's navigation state so the next open starts at
 * the root. The inner panes keep their own slide enter/exit between steps.
 */

function MenuPlayground() {
  // Only the wide/narrow answer matters here, so this subscribes to the tier
  // rather than the width — dragging the viewport re-renders at the edge only.
  const isAutoWide = useBreakpointAtLeast('sm');
  const [startKey, setStartKey] = useState<StartKey>('account');
  const [withFooter, setWithFooter] = useState(true);
  const [withPlaceholder, setWithPlaceholder] = useState(true);
  const [iosStyle, setIosStyle] = useState(false);
  const [visible, setVisible] = useState(false);
  const [path, setPath] = useState<string[]>([]);
  const menuRef = useRef<MultiStepMenuHandle | null>(null);
  const trigger = useTriggerState();

  const isWideScreen = isAutoWide;
  const handleOpen = useCallback(() => setVisible(true), []);
  const handleClose = useCallback(() => setVisible(false), []);
  const handleAfterClose = useCallback(() => menuRef.current?.reset(), []);
  const handleReset = useCallback(() => menuRef.current?.reset(), []);
  const handleJump = useCallback(() => menuRef.current?.navigate(['appearance', 'advanced']), []);

  const pathNote = path.length > 0 ? path.join(' → ') : SETTINGS_ROOT_TITLE;
  const stateNote = visible ? `Open — ${pathNote}` : CLOSED_NOTE;

  const renderMenu = useMemo(() => makeMenuRenderer(iosStyle), [iosStyle]);

  return (
    <Playground>
      <ControlCard title="Options">
        <Choice label="Initial selection" onChange={setStartKey} options={START_OPTIONS} value={startKey} />
        <Toggle label="Sidebar footer" onChange={setWithFooter} value={withFooter} />
        <Toggle label="Wide placeholder" onChange={setWithPlaceholder} value={withPlaceholder} />
        <Toggle label="iOS-style rows" onChange={setIosStyle} value={iosStyle} />
      </ControlCard>

      <ControlCard title="Actions">
        <Action label={JUMP_LABEL} onPress={handleJump} />
        <Action label={RESET_LABEL} onPress={handleReset} />
      </ControlCard>

      <TriggerControls state={trigger} />

      <TriggerButton
        kind={trigger.kind}
        size={trigger.size}
        shape={trigger.shape}
        label={OPEN_SETTINGS_LABEL}
        onPress={handleOpen}
      />

      <Note testID="story-state">{stateNote}</Note>
      <Note>{START_NOTE}</Note>

      <MultiStepMenu
        defaultPath={START_PATHS[startKey]}
        isWideScreen={isWideScreen}
        onAfterClose={handleAfterClose}
        onClose={handleClose}
        onPathChange={setPath}
        ref={menuRef}
        rootTitle={SETTINGS_ROOT_TITLE}
        sections={sections}
        sidebar={renderMenu}
        sidebarFooter={withFooter ? SIDEBAR_FOOTER : undefined}
        smallScreenMenu={renderMenu}
        widePanelSize={isWideScreen ? WIDE_PANEL_SIZE : undefined}
        widePlaceholder={withPlaceholder ? WIDE_PLACEHOLDER : undefined}
        visible={visible}
      />

      <View className="h-3" />
      <Section title="Sidebar row states">
        <Variants align="stretch" direction="column">
          <Sample label="Default">
            <MenuEntryRow entry={MENU_ENTRIES[0]} iosStyle={iosStyle} />
          </Sample>
          <Sample label="Active">
            <MenuEntryRow active={true} entry={MENU_ENTRIES[3]} iosStyle={iosStyle} />
          </Sample>
        </Variants>
      </Section>
    </Playground>
  );
}

type MultiStepSheetStoryProps = { isWideScreen: boolean; defaultPath?: string[] };

function MultiStepSheetStory({ isWideScreen, defaultPath }: MultiStepSheetStoryProps) {
  const [visible, setVisible] = useState(false);
  const menuRef = useRef<MultiStepMenuHandle | null>(null);
  const handleOpen = useCallback(() => setVisible(true), []);
  const handleClose = useCallback(() => setVisible(false), []);
  const handleAfterClose = useCallback(() => menuRef.current?.reset(), []);

  return (
    <View>
      <TriggerButton label={OPEN_SETTINGS_LABEL} onPress={handleOpen} />
      <MultiStepMenu
        defaultPath={defaultPath}
        isWideScreen={isWideScreen}
        onAfterClose={handleAfterClose}
        onClose={handleClose}
        ref={menuRef}
        rootTitle={SETTINGS_ROOT_TITLE}
        sections={sections}
        sidebar={DEFAULT_MENU_RENDERER}
        smallScreenMenu={DEFAULT_MENU_RENDERER}
        visible={visible}
        widePanelSize={isWideScreen ? WIDE_PANEL_SIZE : undefined}
      />
    </View>
  );
}

export default meta;

// ── Stories ────────────────────────────────────────────────────────────────

/** Every layout, initial selection and imperative navigation in one sheet. */
export const Interactive: Story = { render: () => <MenuPlayground /> };

/** Wide-screen layout (sidebar + content pane) in a sliding sheet. */
export const WideScreen: Story = {
  name: 'Demo: Navigate sections',
  render: () => <MultiStepSheetStory defaultPath={START_PATHS.account} isWideScreen={true} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole('button', { name: OPEN_SETTINGS_LABEL }));
    // FullSheet renders into a Modal portal — query the document, not the canvas.
    await expect(await screen.findByLabelText('Close')).toBeTruthy();
    // Click the Notifications sidebar item by its visible text.
    await userEvent.click(await screen.findByText('Notifications'));
    // Verify the Notifications section body (unique text) is now shown.
    await expect(await screen.findByText(NOTIFICATIONS_BODY)).toBeTruthy();
  },
};
