import type { Meta, StoryObj } from '@storybook/react';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { expect, fn, userEvent, within } from 'storybook/test';
import { CalendarClock, Eye, GitBranch, Pin } from '../../lib/icons';
import { useThemeColor } from '../../theme/use-theme-color';
import { type OverflowActionItem, OverflowActions } from './overflow-actions';

const meta = {
  title: 'Components/OverflowActions',
  component: OverflowActions,
  parameters: { layout: 'centered' },
  args: {
    primaryActions: [],
    overflowActions: [],
    size: 'md',
    onExpandedChange: fn(),
    onAction: fn(),
    openLabel: 'Open action rail',
    closeLabel: 'Collapse action rail',
  },
  argTypes: {
    size: { control: 'select', options: ['sm', 'md'] },
  },
} satisfies Meta<typeof OverflowActions>;

type Story = StoryObj<typeof meta>;

type DemoProps = { size?: 'sm' | 'md' };

// biome-ignore lint/style/useComponentExportOnlyModules: story helper
function Demo({ size }: DemoProps) {
  const [expanded, setExpanded] = useState(false);
  const iconColor = useThemeColor('foreground');

  const primaryActions = useMemo<OverflowActionItem[]>(
    () => [
      { id: 'preview', label: 'Preview', icon: <Eye size={16} color={iconColor} /> },
      { id: 'pin', label: 'Pin', icon: <Pin size={16} color={iconColor} /> },
    ],
    [iconColor],
  );

  const overflowActions = useMemo<OverflowActionItem[]>(
    () => [
      { id: 'branch', label: 'Branch', icon: <GitBranch size={16} color={iconColor} /> },
      { id: 'schedule', label: 'Schedule', icon: <CalendarClock size={16} color={iconColor} /> },
    ],
    [iconColor],
  );

  return (
    <OverflowActions
      primaryActions={primaryActions}
      overflowActions={overflowActions}
      size={size}
      expanded={expanded}
      onExpandedChange={setExpanded}
      openLabel="Open action rail"
      closeLabel="Collapse action rail"
    />
  );
}

export default meta;

export const Default: Story = {
  render: () => <Demo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The toggle reveals the overflow group; its actions then become visible.
    await userEvent.click(await canvas.findByRole('button', { name: 'Open action rail' }));
    await expect(await canvas.findByRole('button', { name: 'Branch' })).toBeTruthy();
  },
};

export const Small: Story = {
  render: () => <Demo size="sm" />,
};

export const Sizes: Story = {
  render: () => (
    <View style={{ gap: 16, alignItems: 'center' }}>
      <Demo size="sm" />
      <Demo size="md" />
    </View>
  ),
};
