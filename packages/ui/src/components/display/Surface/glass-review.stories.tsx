import type { Meta, StoryObj } from '@storybook/react';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { FileLine } from 'rn-motion-ui-icons/icons/file-line';
import { FolderLine } from 'rn-motion-ui-icons/icons/folder-line';
import { expect, fn, screen, userEvent, waitFor, within } from 'storybook/test';
import { Button } from '../../buttons/Button/button';
import { FileSystem } from '../../file-system/FileSystem/file-system';
import type { FileSystemContextMenuAction, FileSystemItem } from '../../file-system/FileSystem/types/file-system.types';
import { AdaptiveDropdown } from '../../menus/AdaptiveDropdown/adaptive-dropdown';
import { HoldItem, HoldMenuProvider } from '../../menus/HoldMenu/hold-menu';
import { HoverMenu } from '../../menus/HoverMenu/hover-menu';
import { MorphingMenu } from '../../menus/MorphingMenu/morphing-menu';
import { type MultiStepHelpers, MultiStepMenu } from '../../menus/MultiStepMenu/multi-step-menu';
import { MorphingDockSwitch } from '../../navigation/MorphingDockSwitch/morphing-dock-switch';
import { Menu } from '../../rows/menu';
import { Text } from '../../typography/Text/text';
import { Toaster, toast } from '../Toaster/toaster';

const meta = { title: 'Display/Glass review', parameters: { layout: 'fullscreen' } } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;
const MATERIAL = { glass: true, floating: true, glassTone: 'neutral' as const };
const ITEMS = [
  { value: 'files', label: 'Files', icon: FolderLine },
  { value: 'photos', label: 'Photos', icon: FileLine },
  { value: 'favorites', label: 'Favorites', icon: FolderLine },
  { value: 'backups', label: 'Backups', icon: FolderLine },
  { value: 'shared', label: 'Shared', icon: FileLine },
  { value: 'notes', label: 'Notes', icon: FileLine },
];
const ACTIONS = [
  { id: 'open', label: 'Open', icon: FileLine },
  { id: 'rename', label: 'Rename', icon: FileLine },
  { id: 'move', label: 'Move to folder', icon: FolderLine, separatorAfter: true },
  { id: 'delete', label: 'Delete', destructive: true },
];
const FILES: FileSystemItem[] = [
  { kind: 'folder', path: 'Projects/', name: 'Projects' },
  { kind: 'file', path: 'Project overview.md', size: 2048, updatedAt: '2026-09-20T12:00:00Z' },
  { kind: 'file', path: 'Meeting notes.txt', size: 4200, updatedAt: '2026-09-20T12:00:00Z' },
  { kind: 'file', path: 'Quarterly report.pdf', size: 234_000, updatedAt: '2026-09-20T12:00:00Z' },
];
const fileActions = (): FileSystemContextMenuAction[] => ACTIONS;
type ReviewTriggerProps = { toggle: () => void };
const renderTrigger = ({ toggle }: ReviewTriggerProps) => (
  <Button testID="review-trigger" onPress={toggle}>
    Open menu
  </Button>
);
const renderSettings = () => <Text>Keep your files organized and easy to find.</Text>;
const renderSettingsMenu = ({ navigate }: MultiStepHelpers) => (
  <Menu entries={[{ id: 'general', label: 'General', onSelect: () => navigate('general') }]} />
);
type SceneProps = { kind: string };
function Scene({ kind }: SceneProps) {
  const [open, setOpen] = useState(false);
  const show = useCallback(() => setOpen(true), []);
  const hide = useCallback(() => setOpen(false), []);
  const notify = useCallback(
    () => toast.success('Files saved', { description: 'Your changes are up to date.', duration: 0 }),
    [],
  );
  return (
    <View className="relative min-h-[640px] w-full gap-6 bg-background p-6" testID="review-scene">
      <View className="absolute top-24 left-12 h-48 w-48 rounded-full bg-info/20" />
      <View className="absolute top-40 right-12 h-56 w-56 rounded-full bg-accent/20" />
      <Text size="xl" weight="semibold">
        Your workspace
      </Text>
      <Text className="text-muted-foreground">Files, ideas, and everything you keep.</Text>
      <View className="min-h-[400px] justify-center gap-6">
        {kind === 'toast' ? (
          <>
            <Toaster {...MATERIAL} position="top" offset={160} />
            <Button testID="review-trigger" onPress={notify}>
              Save files
            </Button>
          </>
        ) : null}
        {kind === 'dock' ? (
          <View className="items-center">
            <MorphingDockSwitch
              items={ITEMS}
              dockCount={3}
              showLabels={true}
              size="md"
              blurRadius={12}
              rim={true}
              floating={true}
              testID="review-dock"
              triggerTestID="review-trigger"
            />
          </View>
        ) : null}
        {kind === 'dropdown' ? (
          <AdaptiveDropdown {...MATERIAL} trigger={renderTrigger} testID="review-menu">
            <Menu entries={ACTIONS} />
          </AdaptiveDropdown>
        ) : null}
        {kind === 'hover' ? (
          <HoverMenu {...MATERIAL} trigger={renderTrigger} triggerIsPressable={true} testID="review-menu">
            <Menu entries={ACTIONS} />
          </HoverMenu>
        ) : null}
        {kind === 'morphing' ? (
          <View className="items-center">
            <MorphingMenu
              {...MATERIAL}
              items={[
                { label: 'File', icon: FileLine },
                { label: 'Folder', icon: FolderLine },
              ]}
              testID="review-menu"
            />
          </View>
        ) : null}
        {kind === 'hold' ? (
          <HoldMenuProvider {...MATERIAL} overlay="none">
            <HoldItem
              activateOn="tap"
              items={ACTIONS.map((action) => ({
                text: action.label,
                isDestructive: action.destructive,
                testID: `review-${action.id}`,
              }))}
              testID="review-trigger"
            >
              <View className="p-6">
                <Text>Project overview.md</Text>
              </View>
            </HoldItem>
          </HoldMenuProvider>
        ) : null}
        {kind === 'settings' ? (
          <>
            <Button testID="review-trigger" onPress={show}>
              Settings
            </Button>
            <MultiStepMenu
              {...MATERIAL}
              visible={open}
              onClose={hide}
              isWideScreen={true}
              sections={[{ path: 'general', title: 'General', render: renderSettings }]}
              sidebar={renderSettingsMenu}
              smallScreenMenu={renderSettingsMenu}
              rootTitle="Settings"
              defaultPath={['general']}
              testID="review-menu"
            />
          </>
        ) : null}
        {kind === 'files' ? (
          <HoldMenuProvider {...MATERIAL}>
            <FileSystem
              menuGlass={true}
              menuFloating={true}
              items={FILES}
              view="mobile-list"
              height={400}
              getContextMenuActions={fileActions}
              testID="review-files"
            />
          </HoldMenuProvider>
        ) : null}
      </View>
    </View>
  );
}
export const Toast: Story = { render: () => <Scene kind="toast" /> };
export const Dock: Story = { render: () => <Scene kind="dock" /> };
export const Dropdown: Story = { render: () => <Scene kind="dropdown" /> };
export const Hover: Story = { render: () => <Scene kind="hover" /> };
export const Morphing: Story = { render: () => <Scene kind="morphing" /> };
export const Hold: Story = { render: () => <Scene kind="hold" /> };
export const Settings: Story = { render: () => <Scene kind="settings" /> };
export const Files: Story = { render: () => <Scene kind="files" /> };

/** Verify controls remain separate and the shared material is actually rendered. */
export const ToastInteraction: Story = {
  render: () => <Scene kind="toast" />,
  play: async () => {
    const onPress = fn();
    const onClose = fn();
    const id = toast.success('File moved', {
      glass: true,
      glassTone: 'neutral',
      duration: 0,
      action: { label: 'Undo', onPress },
      onClose,
    });
    const notification = await screen.findByTestId(`toaster-${id}`);
    await waitFor(() => expect(notification.querySelector('svg')).not.toBeNull());
    expect(getComputedStyle(notification).backdropFilter).toContain('blur(12px)');
    await userEvent.click(screen.getByTestId(`toaster-${id}-action`));
    expect(onPress).toHaveBeenCalledOnce();
    expect(onClose).not.toHaveBeenCalled();
    await userEvent.click(screen.getByTestId(`toaster-${id}-dismiss`));
    await waitFor(() => expect(screen.queryByTestId(`toaster-${id}`)).toBeNull());
    expect(onClose).toHaveBeenCalledOnce();
    toast.dismiss(id);
    expect(onClose).toHaveBeenCalledOnce();
  },
};

const LONG_DOCK_ITEMS = Array.from({ length: 24 }, (_, index) => ({
  value: `space-${index}`,
  label: `Space ${index + 1}`,
  icon: FolderLine,
}));
export const DockOverflow: Story = {
  render: () => (
    <View className="h-screen w-full items-end justify-end p-2">
      <MorphingDockSwitch
        items={LONG_DOCK_ITEMS}
        dockCount={1}
        blurRadius={12}
        rim={true}
        floating={true}
        testID="long-dock"
        triggerTestID="long-dock-trigger"
      />
    </View>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByTestId('long-dock-trigger'));
    const scroll = await canvas.findByTestId('long-dock-scroll');
    await waitFor(() => {
      const bounds = scroll.getBoundingClientRect();
      expect(bounds.top).toBeGreaterThanOrEqual(7);
      expect(bounds.right).toBeLessThanOrEqual(window.innerWidth);
      expect(scroll.scrollHeight).toBeGreaterThan(scroll.clientHeight);
    });
    await userEvent.click(canvas.getByTestId('long-dock-item-space-23'));
    await expect(await canvas.findByTestId('long-dock-trigger')).toHaveAttribute('aria-expanded', 'false');
  },
};

export const FileMenuInteraction: Story = {
  render: () => <Scene kind="files" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByTestId('review-files-entry-Project overview.md-kebab'));
    await waitFor(() => expect(screen.getByTestId('file-action-rename')).toBeVisible());
    await expect(screen.getByTestId('file-action-delete')).toBeVisible();
    await userEvent.click(screen.getByTestId('file-action-rename'));
    await waitFor(() => expect(screen.getByTestId('file-action-rename')).not.toBeVisible());
  },
};
