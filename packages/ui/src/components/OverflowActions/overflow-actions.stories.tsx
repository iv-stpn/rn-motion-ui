import type { Meta, StoryObj } from '@storybook/react';
import { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';
import { expect, fn, userEvent, within } from 'storybook/test';
import { Choice, Controls, Note, Playground, Sample, Section, Toggle, Variants } from '../../__stories__/story-harness';
import { CalendarClock, Eye, GitBranch, Pin } from '../../lib/icons';
import { useThemeColor } from '../../theme/use-theme-color';
import { type OverflowActionItem, OverflowActions, type OverflowActionsSize } from './overflow-actions';

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

const SIZES = ['sm', 'md'] as const satisfies readonly OverflowActionsSize[];
const NO_ACTION = 'no action yet';

type DemoProps = { size?: OverflowActionsSize; label?: string };

// The uncontrolled variant used by the size rows — each rail owns its own state.
// biome-ignore lint/style/useComponentExportOnlyModules: story helper
function Demo({ size, label = 'action rail' }: DemoProps) {
  const iconColor = useThemeColor('foreground');
  const iconSize = size === 'sm' ? 14 : 16;

  const primaryActions = useMemo<OverflowActionItem[]>(
    () => [
      { id: 'preview', label: 'Preview', icon: <Eye color={iconColor} size={iconSize} /> },
      { id: 'pin', label: 'Pin', icon: <Pin color={iconColor} size={iconSize} /> },
    ],
    [iconColor, iconSize],
  );

  const overflowActions = useMemo<OverflowActionItem[]>(
    () => [
      { id: 'branch', label: 'Branch', icon: <GitBranch color={iconColor} size={iconSize} /> },
      { id: 'schedule', label: 'Schedule', icon: <CalendarClock color={iconColor} size={iconSize} /> },
    ],
    [iconColor, iconSize],
  );

  return (
    <OverflowActions
      closeLabel={`Collapse ${label}`}
      openLabel={`Open ${label}`}
      overflowActions={overflowActions}
      primaryActions={primaryActions}
      size={size}
    />
  );
}

// biome-ignore lint/style/useComponentExportOnlyModules: story helper
function OverflowActionsPlayground() {
  const [size, setSize] = useState<OverflowActionsSize>('md');
  const [expanded, setExpanded] = useState(false);
  const [collapseOnAction, setCollapseOnAction] = useState(false);
  const [icons, setIcons] = useState(true);
  const [last, setLast] = useState(NO_ACTION);
  const iconColor = useThemeColor('foreground');
  const iconSize = size === 'sm' ? 14 : 16;

  const primaryActions = useMemo<OverflowActionItem[]>(
    () => [
      { id: 'preview', label: 'Preview', icon: icons ? <Eye color={iconColor} size={iconSize} /> : undefined },
      { id: 'pin', label: 'Pin', icon: icons ? <Pin color={iconColor} size={iconSize} /> : undefined },
    ],
    [icons, iconColor, iconSize],
  );

  const overflowActions = useMemo<OverflowActionItem[]>(
    () => [
      { id: 'branch', label: 'Branch', icon: icons ? <GitBranch color={iconColor} size={iconSize} /> : undefined },
      { id: 'schedule', label: 'Schedule', icon: icons ? <CalendarClock color={iconColor} size={iconSize} /> : undefined },
      { id: 'archive', label: 'Archive', disabled: true },
    ],
    [icons, iconColor, iconSize],
  );

  const handleAction = useCallback((item: OverflowActionItem) => setLast(item.id), []);

  return (
    <Playground>
      <Controls>
        <Choice label="Size" onChange={setSize} options={SIZES} value={size} />
        <Toggle label="Expanded" onChange={setExpanded} value={expanded} />
        <Toggle label="Collapse on action" onChange={setCollapseOnAction} value={collapseOnAction} />
        <Toggle label="Icons" onChange={setIcons} value={icons} />
      </Controls>

      {/* Driving `expanded` from the harness toggle shows the rail is fully
          controllable — the built-in trigger just calls the same setter. */}
      <View className="items-center gap-2">
        <OverflowActions
          closeLabel="Collapse action rail"
          collapseOnAction={collapseOnAction}
          expanded={expanded}
          onAction={handleAction}
          onExpandedChange={setExpanded}
          openLabel="Open action rail"
          overflowActions={overflowActions}
          primaryActions={primaryActions}
          size={size}
        />
        <Note testID="story-last-action">{last}</Note>
      </View>

      {/* The overflow group's width is measured, so a smaller size shrinks both
          the buttons and the distance the toggle travels when it opens. */}
      <Section title="Sizes">
        <Variants direction="column">
          {SIZES.map((option) => (
            <Sample key={option} label={option}>
              <Demo label={`${option} rail`} size={option} />
            </Sample>
          ))}
        </Variants>
      </Section>

      <Section title="Primary actions only (no overflow trigger)">
        <OverflowActions
          onAction={handleAction}
          overflowActions={[]}
          primaryActions={primaryActions}
          openLabel="Open empty rail"
          size={size}
        />
      </Section>
    </Playground>
  );
}

export default meta;

/** One controlled rail with a live action readout, plus the size ladder and the
 *  degenerate case where there is nothing to overflow. */
export const Interactive: Story = { render: () => <OverflowActionsPlayground /> };

export const Default: Story = {
  name: 'Demo: Expand actions',
  render: () => <Demo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The toggle reveals the overflow group; its actions then become visible.
    await userEvent.click(await canvas.findByRole('button', { name: 'Open action rail' }));
    await expect(await canvas.findByRole('button', { name: 'Branch' })).toBeTruthy();
  },
};
