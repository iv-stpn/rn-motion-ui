import type { Meta, StoryObj } from '@storybook/react';
import { View } from 'react-native';
import { expect, fn, userEvent, within } from 'storybook/test';
import { CalendarClock, FileText, FolderKanban, PackageCheck, RadioTower, ShieldCheck } from '../../lib/icons';
import { BouncyAccordion } from './bouncy-accordion';

const ICON = '#71717a';

const ITEMS = [
  {
    id: 'brief',
    title: 'Release Brief',
    description: 'Collect launch notes, owners, and risks in one compact handoff before the release window opens.',
    icon: <FileText size={16} color={ICON} />,
  },
  {
    id: 'launch',
    title: 'Launch Checklist',
    description: 'Verify copy, links, analytics, rollback steps, and final approvals without leaving the queue.',
    icon: <ShieldCheck size={16} color={ICON} />,
  },
  {
    id: 'campaign',
    title: 'Campaign Notes',
    description: 'Keep channel-specific notes close to the task while preserving a calm collapsed list.',
    icon: <RadioTower size={16} color={ICON} />,
  },
  {
    id: 'calendar',
    title: 'Rollout Calendar',
    description: 'Plan announcements, staging checks, reminders, and quiet periods around the same timeline.',
    icon: <CalendarClock size={16} color={ICON} />,
  },
  {
    id: 'ship',
    title: 'Ship Build',
    description: 'Track the current artifact, deploy status, and final sign-off before marking the release complete.',
    icon: <PackageCheck size={16} color={ICON} />,
  },
  {
    id: 'archive',
    title: 'Archive Assets',
    description: 'Move final copy, images, and source files into the campaign folder once the rollout is done.',
    icon: <FolderKanban size={16} color={ICON} />,
  },
];

const meta = {
  title: 'Components/BouncyAccordion',
  component: BouncyAccordion,
  parameters: { layout: 'centered' },
  args: { items: ITEMS, defaultValue: 'calendar', collapsible: true, onValueChange: fn() },
  decorators: [
    (Story) => (
      <View style={{ width: 360 }}>
        <Story />
      </View>
    ),
  ],
} satisfies Meta<typeof BouncyAccordion>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    // A closed row toggles open on press (aria-expanded flips true).
    const brief = await canvas.findByRole('button', { name: 'Release Brief' });
    await expect(brief).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(brief);
    await expect(args.onValueChange).toHaveBeenCalledWith('brief');
    await expect(brief).toHaveAttribute('aria-expanded', 'true');
  },
};

export const AllClosed: Story = {
  args: { defaultValue: null },
};

export const NotCollapsible: Story = {
  args: { defaultValue: 'brief', collapsible: false },
};
