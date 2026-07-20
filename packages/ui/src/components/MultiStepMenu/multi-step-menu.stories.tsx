import type { Meta, StoryObj } from '@storybook/react';
import { useCallback, useRef, useState } from 'react';
import { Text, useWindowDimensions, View } from 'react-native';
import { expect, screen, userEvent, within } from 'storybook/test';
import { Bell, Moon, ShieldCheck, User } from '../../lib/icons';
import { Button } from '../Button/button';
import {
  MenuRow,
  type MultiStepHelpers,
  MultiStepMenu,
  type MultiStepMenuHandle,
  type MultiStepSection,
} from './multi-step-menu';

const EMPTY_SECTIONS: MultiStepSection[] = [];

const meta = {
  title: 'Components/MultiStepMenu',
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

const ACCOUNT_TITLE = 'Account Settings';
const ACCOUNT_BODY = 'Manage your profile, email, and password.';
const NOTIFICATIONS_TITLE = 'Notifications';
const NOTIFICATIONS_BODY = 'Choose which alerts you receive and how.';
const APPEARANCE_TITLE = 'Appearance';
const APPEARANCE_BODY = 'Light, dark, or system theme.';
const ADVANCED_APPEARANCE_LABEL = 'Advanced options →';
const ADVANCED_TITLE = 'Advanced Appearance';
const ADVANCED_BODY = 'Font size, contrast, motion settings.';
const PRIVACY_TITLE = 'Privacy & Security';
const PRIVACY_BODY = 'Two-factor auth, connected apps, and data.';

type AppearanceSectionProps = { helpers: MultiStepHelpers };

// biome-ignore lint/style/useComponentExportOnlyModules: story helper co-located with its stories
function AppearanceSection({ helpers }: AppearanceSectionProps) {
  const navigateAdvanced = useCallback(() => helpers.navigate('appearance/advanced'), [helpers]);
  return (
    <View style={{ gap: 12 }}>
      <Text style={{ fontWeight: '600', fontSize: 16 }}>{APPEARANCE_TITLE}</Text>
      <Text style={{ color: '#6b7280', lineHeight: 22 }}>{APPEARANCE_BODY}</Text>
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
    render: () => (
      <View style={{ gap: 12 }}>
        <Text style={{ fontWeight: '600', fontSize: 16 }}>{ACCOUNT_TITLE}</Text>
        <Text style={{ color: '#6b7280', lineHeight: 22 }}>{ACCOUNT_BODY}</Text>
      </View>
    ),
  },
  {
    path: 'notifications',
    title: 'Notifications',
    render: () => (
      <View style={{ gap: 12 }}>
        <Text style={{ fontWeight: '600', fontSize: 16 }}>{NOTIFICATIONS_TITLE}</Text>
        <Text style={{ color: '#6b7280', lineHeight: 22 }}>{NOTIFICATIONS_BODY}</Text>
      </View>
    ),
  },
  {
    path: 'appearance',
    title: 'Appearance',
    render: (helpers) => <AppearanceSection helpers={helpers} />,
    subsections: [
      {
        path: 'advanced',
        title: 'Advanced Appearance',
        render: () => (
          <View style={{ gap: 8 }}>
            <Text style={{ fontWeight: '600', fontSize: 16 }}>{ADVANCED_TITLE}</Text>
            <Text style={{ color: '#6b7280' }}>{ADVANCED_BODY}</Text>
          </View>
        ),
      },
    ],
  },
  {
    path: 'privacy',
    title: 'Privacy & Security',
    render: () => (
      <View style={{ gap: 8 }}>
        <Text style={{ fontWeight: '600', fontSize: 16 }}>{PRIVACY_TITLE}</Text>
        <Text style={{ color: '#6b7280' }}>{PRIVACY_BODY}</Text>
      </View>
    ),
  },
];

type SidebarProps = { helpers: MultiStepHelpers };

// biome-ignore lint/style/useComponentExportOnlyModules: story helper co-located with its stories
function Sidebar({ helpers }: SidebarProps) {
  const navAccount = useCallback(() => helpers.navigate(['account']), [helpers]);
  const navNotifications = useCallback(() => helpers.navigate(['notifications']), [helpers]);
  const navAppearance = useCallback(() => helpers.navigate(['appearance']), [helpers]);
  const navPrivacy = useCallback(() => helpers.navigate(['privacy']), [helpers]);
  return (
    <View style={{ gap: 4, paddingTop: 8 }}>
      <MenuRow
        icon={User}
        label="Account"
        iconBackgroundColor="#3b82f6"
        active={helpers.path[0] === 'account'}
        onPress={navAccount}
      />
      <MenuRow
        icon={Bell}
        label="Notifications"
        iconBackgroundColor="#f59e0b"
        active={helpers.path[0] === 'notifications'}
        onPress={navNotifications}
      />
      <MenuRow
        icon={Moon}
        label="Appearance"
        iconBackgroundColor="#8b5cf6"
        active={helpers.path[0] === 'appearance'}
        onPress={navAppearance}
      />
      <MenuRow
        icon={ShieldCheck}
        label="Privacy & Security"
        iconBackgroundColor="#10b981"
        active={helpers.path[0] === 'privacy'}
        onPress={navPrivacy}
      />
    </View>
  );
}

type SmallScreenMenuItemsProps = { helpers: MultiStepHelpers };

// biome-ignore lint/style/useComponentExportOnlyModules: story helper co-located with its stories
function SmallScreenMenuItems({ helpers }: SmallScreenMenuItemsProps) {
  const navAccount = useCallback(() => helpers.navigate('account'), [helpers]);
  const navNotifications = useCallback(() => helpers.navigate('notifications'), [helpers]);
  const navAppearance = useCallback(() => helpers.navigate('appearance'), [helpers]);
  const navPrivacy = useCallback(() => helpers.navigate('privacy'), [helpers]);
  return (
    <View style={{ gap: 4 }}>
      <MenuRow icon={User} label="Account" iconBackgroundColor="#3b82f6" onPress={navAccount} />
      <MenuRow icon={Bell} label="Notifications" iconBackgroundColor="#f59e0b" onPress={navNotifications} />
      <MenuRow icon={Moon} label="Appearance" iconBackgroundColor="#8b5cf6" onPress={navAppearance} />
      <MenuRow icon={ShieldCheck} label="Privacy & Security" iconBackgroundColor="#10b981" onPress={navPrivacy} />
    </View>
  );
}

const renderSidebar = (h: MultiStepHelpers) => <Sidebar helpers={h} />;
const renderSmallScreenMenu = (h: MultiStepHelpers) => <SmallScreenMenuItems helpers={h} />;

type MultiStepSheetStoryProps = { isWideScreen: boolean; defaultPath?: string[] };

/**
 * Self-contained `MultiStepMenu` owns its `AdaptiveModal` shell: a full sheet on
 * small screens (slide up/down) and a centered panel on wide screens.
 * `onAfterClose` resets the menu's navigation state so the next open starts at
 * the root. The inner panes keep their own slide enter/exit between steps.
 */
// biome-ignore lint/style/useComponentExportOnlyModules: story helper co-located with its stories
function MultiStepSheetStory({ isWideScreen, defaultPath }: MultiStepSheetStoryProps) {
  const [visible, setVisible] = useState(false);
  const menuRef = useRef<MultiStepMenuHandle | null>(null);
  const handleOpen = useCallback(() => setVisible(true), []);
  const handleClose = useCallback(() => setVisible(false), []);
  const handleAfterClose = useCallback(() => menuRef.current?.reset(), []);

  return (
    <View>
      <Button onPress={handleOpen}>{OPEN_SETTINGS_LABEL}</Button>
      <MultiStepMenu
        ref={menuRef}
        visible={visible}
        isWideScreen={isWideScreen}
        sections={sections}
        sidebar={renderSidebar}
        smallScreenMenu={renderSmallScreenMenu}
        rootTitle={SETTINGS_ROOT_TITLE}
        defaultPath={defaultPath}
        onClose={handleClose}
        onAfterClose={handleAfterClose}
        widePanelSize={isWideScreen ? { width: 700, height: 480 } : undefined}
      />
    </View>
  );
}

export default meta;

// ── Stories ────────────────────────────────────────────────────────────────

/** Wide-screen layout (sidebar + content pane) in a sliding sheet. */
export const WideScreen: Story = {
  render: () => <MultiStepSheetStory isWideScreen={true} defaultPath={['account']} />,
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

/** Small-screen layout (stacked navigation, full-height panes) in a sliding sheet. */
export const SmallScreen: Story = {
  render: () => <MultiStepSheetStory isWideScreen={false} />,
};

/** Responsive — switches layout based on window width, in a sliding sheet. */
export const Responsive: Story = {
  render: () => {
    const { width } = useWindowDimensions();
    const isWideScreen = width >= 640;
    return <MultiStepSheetStory isWideScreen={isWideScreen} defaultPath={isWideScreen ? ['account'] : undefined} />;
  },
};
