import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { View } from 'react-native';
import { AddLine } from 'rn-motion-ui-icons/icons/add-line';
import { Document2Line } from 'rn-motion-ui-icons/icons/document-2-line';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { useThemeColor } from '../../../theme/use-theme-color';
import { Button } from '../../buttons/Button/button';
import { Text } from '../../typography/Text/text';
import { ActionFAB, type ActionFABItem } from './action-fab';

const items = [
  { id: 'note', label: 'New note', icon: Document2Line, onPress: fn(), testID: 'action-note' },
  { id: 'disabled', label: 'Unavailable action', icon: AddLine, disabled: true, onPress: fn(), testID: 'action-disabled' },
  { id: 'folder', label: 'New folder', icon: AddLine, onPress: fn(), testID: 'action-folder' },
  { id: 'view', label: 'List view', icon: Document2Line, selected: true, onPress: fn(), testID: 'action-view' },
] satisfies ActionFABItem[];

const meta = {
  title: 'Menus/ActionFAB',
  component: ActionFAB,
  parameters: { layout: 'centered' },
  args: { title: 'Create', items },
  decorators: [
    (Story) => (
      <View className="h-[420px] w-[360px] bg-background p-6">
        <Text weight="semibold">Your workspace</Text>
        <Text className="mt-2 text-muted-foreground">Actions rise above a button that stays in place.</Text>
        <Story />
      </View>
    ),
  ],
} satisfies Meta<typeof ActionFAB>;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByTestId('action-fab-trigger');
    const before = trigger.getBoundingClientRect();
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    await userEvent.click(trigger);
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(canvas.getByTestId('action-fab-close')).toHaveAccessibleName('Close actions');
    const menu = canvas.getByTestId('action-fab-menu');
    await expect(menu).toHaveAttribute('role', 'menu');
    await expect(menu).toHaveAccessibleName('Create');
    await waitFor(() => expect(canvas.getByTestId('action-note')).toHaveFocus());
    await expect(canvas.getByTestId('action-disabled')).toHaveAttribute('aria-disabled', 'true');
    await expect(canvas.getByTestId('action-view')).toHaveAttribute('aria-selected', 'true');
    await userEvent.keyboard('{ArrowDown}');
    await expect(canvas.getByTestId('action-folder')).toHaveFocus();
    await userEvent.keyboard('{End}');
    await expect(canvas.getByTestId('action-view')).toHaveFocus();
    await userEvent.tab();
    await expect(canvas.getByTestId('action-fab-close')).toHaveFocus();
    await userEvent.tab();
    await expect(canvas.getByTestId('action-note')).toHaveFocus();
    const after = trigger.getBoundingClientRect();
    await expect(after.x + after.width / 2).toBeCloseTo(before.x + before.width / 2, 3);
    await expect(after.y + after.height / 2).toBeCloseTo(before.y + before.height / 2, 3);
    await expect(trigger.offsetWidth).toBe(before.width);
    await expect(trigger.offsetHeight).toBe(before.height);
    await waitFor(() => expect(menu.getBoundingClientRect().bottom).toBeLessThan(before.top - 8));
    await userEvent.keyboard('{Escape}');
    await expect(trigger).toHaveFocus();
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(trigger);
    await userEvent.click(canvas.getByTestId('action-fab-backdrop'));
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(trigger);
    await userEvent.click(canvas.getByTestId('action-folder'));
    await expect(items[2]?.onPress).toHaveBeenCalledOnce();
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(trigger);
    await userEvent.click(canvas.getByTestId('action-fab-close'));
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  },
};

export const Scrollable: Story = {
  args: {
    title: 'Views',
    position: 'bottom-left',
    defaultOpen: true,
    items: Array.from({ length: 16 }, (_, index) => ({
      id: `view-${index}`,
      label: `View ${index + 1}`,
      icon: Document2Line,
      onPress: fn(),
      testID: `view-${index}`,
    })),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const root = canvas.getByTestId('action-fab').getBoundingClientRect();
    const menu = canvas.getByTestId('action-fab-menu');
    await waitFor(() => expect(menu.getBoundingClientRect().top).toBeGreaterThanOrEqual(root.top + 15));
    await expect(menu.scrollHeight).toBeGreaterThan(menu.clientHeight);
    await userEvent.keyboard('{End}');
    await expect(canvas.getByTestId('view-15')).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    await expect(canvas.getByTestId('action-fab-trigger')).toHaveAttribute('aria-expanded', 'false');
  },
};

export const SingleAction: Story = {
  args: { items: items.slice(0, 1) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByTestId('action-fab-trigger');
    await expect(trigger).toHaveAccessibleName('New note');
    await expect(trigger).not.toHaveAttribute('aria-haspopup');
    await userEvent.click(trigger);
    await expect(items[0]?.onPress).toHaveBeenCalledOnce();
    await expect(canvas.queryByTestId('action-note')).not.toBeInTheDocument();
  },
};

export const DisabledSingleAction: Story = {
  args: { items: items.slice(1, 2) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByTestId('action-fab-trigger');
    await expect(trigger).toHaveAttribute('aria-disabled', 'true');
    await expect(canvas.queryByTestId('action-note')).not.toBeInTheDocument();
    await expect(items[1]?.onPress).not.toHaveBeenCalled();
  },
};

function ControlledExample() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button testID="open-actions" onPress={() => setOpen(true)}>
        Open actions
      </Button>
      <ActionFAB title="Create" items={items} open={open} onOpenChange={setOpen} />
    </>
  );
}

export const Controlled: Story = {
  render: () => <ControlledExample />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByTestId('open-actions'));
    await expect(canvas.getByTestId('action-fab-trigger')).toHaveAttribute('aria-expanded', 'true');
    await userEvent.keyboard('{Escape}');
    await expect(canvas.getByTestId('action-fab-trigger')).toHaveAttribute('aria-expanded', 'false');
    await expect(canvas.getByTestId('open-actions')).toHaveFocus();
  },
};

export const Blur: Story = { args: { overlay: 'blur' }, play: Default.play };

export const NoBackdrop: Story = { args: { overlay: 'none' }, play: Default.play };

function ReferenceExample() {
  const iconColor = useThemeColor('accent-foreground');
  return (
    <ActionFAB
      title="Create"
      overlay="blur"
      iconColor={iconColor}
      triggerClassName="bg-accent"
      items={['New message', 'New label', 'New folder'].map((label) => ({ id: label, label, onPress: fn() }))}
    />
  );
}

export const Reference: Story = { render: () => <ReferenceExample /> };

export const TextOnly: Story = {
  args: {
    title: 'Create',
    overlay: 'blur',
    items: ['New message', 'New label', 'New folder'].map((label) => ({ id: label, label, onPress: fn() })),
  },
};

export default meta;
