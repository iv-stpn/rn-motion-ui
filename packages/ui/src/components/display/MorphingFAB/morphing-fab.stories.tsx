import type { Meta, StoryObj } from '@storybook/react';
import type { ComponentType, ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import type { IconProps } from 'rn-motion-ui-icons/icon-props';
import { CameraLine } from 'rn-motion-ui-icons/icons/camera-line';
import { Document2Line } from 'rn-motion-ui-icons/icons/document-2-line';
import { LinkLine } from 'rn-motion-ui-icons/icons/link-line';
import { expect, screen, userEvent, within } from 'storybook/test';
import { ThemedIcon } from '../../icon/themed-icon';
import { Text } from '../../typography/Text/text';
import { MorphingFAB } from './morphing-fab';

const meta = {
  title: 'Display/MorphingFAB',
  component: MorphingFAB,
  parameters: { layout: 'fullscreen' },
  args: { position: 'bottom-right', children: null },
} satisfies Meta<typeof MorphingFAB>;

type Story = StoryObj<typeof meta>;

type AppSurfaceProps = { children: ReactNode; hint: string };

/** Faux app surface so the floating trigger has context. */
// biome-ignore lint/style/useComponentExportOnlyModules: story helper
function AppSurface({ children, hint }: AppSurfaceProps) {
  return (
    <View className="min-h-[380px] flex-1 bg-surface-1">
      <View className="border-border border-b px-5 py-3">
        <View className="h-2.5 w-24 rounded-full bg-muted-foreground/20" />
      </View>
      <View className="gap-3 p-5">
        <View className="h-2.5 w-3/4 rounded-full bg-muted-foreground/15" />
        <View className="h-2.5 w-1/2 rounded-full bg-muted-foreground/15" />
        <View className="h-20 w-full rounded-2xl bg-muted-foreground/[0.06]" />
        <Text className="text-muted-foreground text-sm">{hint}</Text>
      </View>
      {children}
    </View>
  );
}

type Action = { icon: ComponentType<IconProps>; label: string; onPress: () => void };

/** Single row inside the expanded action menu. */
// biome-ignore lint/style/useComponentExportOnlyModules: story helper
function MenuAction({ icon, label, onPress }: Action) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      className="h-11 flex-row items-center gap-2.5 rounded-xl px-3 active:bg-surface-selected"
    >
      <ThemedIcon icon={icon} variant="secondary" size={18} />
      <Text className="text-foreground text-sm">{label}</Text>
    </Pressable>
  );
}

/**
 * The showcase: a plain `+` FAB that morphs into a three-action menu.
 * Tapping an action runs it and folds the FAB back down.
 */
export const ThreeActionMenu: Story = {
  name: '+ FAB → 3-action menu',
  render: () => (
    <AppSurface hint="Tap the + button — the FAB morphs into a menu of three actions. Picking one closes the menu.">
      <MorphingFAB expandedWidth={232} expandedHeight={192} accessibilityLabel="Open actions" triggerTestID="fab-trigger">
        {({ close }) => (
          <View className="gap-1 pt-1">
            <MenuAction icon={CameraLine} label="Take photo" onPress={close} />
            <MenuAction icon={Document2Line} label="Attach file" onPress={close} />
            <MenuAction icon={LinkLine} label="Copy link" onPress={close} />
          </View>
        )}
      </MorphingFAB>
    </AppSurface>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // FAB is collapsed: trigger visible, no menu rows.
    const trigger = await canvas.findByTestId('fab-trigger');
    await userEvent.click(trigger);

    // Morphs open: all three actions are reachable.
    await expect(await screen.findByText('Take photo')).toBeTruthy();
    await expect(await screen.findByText('Attach file')).toBeTruthy();
    await expect(await screen.findByText('Copy link')).toBeTruthy();

    // Picking an action folds the FAB back to the trigger.
    await userEvent.click(await screen.findByText('Take photo'));
    await expect(await canvas.findByTestId('fab-trigger')).toBeTruthy();
    await expect(screen.queryByText('Attach file')).toBeNull();
  },
};

export default meta;
