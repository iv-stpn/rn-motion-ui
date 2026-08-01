import type { Meta, StoryObj } from '@storybook/react';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { expect, fn, userEvent, within } from 'storybook/test';
import { Choice, ControlCard, Note, Playground, Section, Toggle } from '../../../__stories__/story-harness';
import { CalendarClock, FileText, FolderKanban, PackageCheck, RadioTower, ShieldCheck } from '../../../lib/icons';
import { useThemeColor } from '../../../theme/use-theme-color';
import { BouncyAccordion, type BouncyAccordionItem } from './bouncy-accordion';

// Icons need an explicit colour (RN icons don't inherit currentColor). The meta
// args are static, so they use a fixed grey; the playground re-tints the same set
// from the theme so it tracks light/dark.
const STATIC_ICON = '#71717a';

const SOURCE = [
  {
    id: 'brief',
    title: 'Release Brief',
    description: 'Collect launch notes, owners, and risks in one compact handoff before the release window opens.',
    Icon: FileText,
  },
  {
    id: 'launch',
    title: 'Launch Checklist',
    description: 'Verify copy, links, analytics, rollback steps, and final approvals without leaving the queue.',
    Icon: ShieldCheck,
  },
  {
    id: 'campaign',
    title: 'Campaign Notes',
    description: 'Keep channel-specific notes close to the task while preserving a calm collapsed list.',
    Icon: RadioTower,
  },
  {
    id: 'calendar',
    title: 'Rollout Calendar',
    description: 'Plan announcements, staging checks, reminders, and quiet periods around the same timeline.',
    Icon: CalendarClock,
  },
  {
    id: 'ship',
    title: 'Ship Build',
    description: 'Track the current artifact, deploy status, and final sign-off before marking the release complete.',
    Icon: PackageCheck,
  },
  {
    id: 'archive',
    title: 'Archive Assets',
    description: 'Move final copy, images, and source files into the campaign folder once the rollout is done.',
    Icon: FolderKanban,
  },
] as const;

const ITEMS: BouncyAccordionItem[] = SOURCE.map(({ id, title, description, Icon }) => ({
  id,
  title,
  description,
  icon: <Icon color={STATIC_ICON} size={16} />,
}));

const meta = {
  title: 'Display/BouncyAccordion',
  component: BouncyAccordion,
  parameters: { layout: 'centered' },
  args: { items: ITEMS, defaultValue: 'calendar', collapsible: true, onValueChange: fn() },
  decorators: [
    (Story) => (
      <View className="w-[360px]">
        <Story />
      </View>
    ),
  ],
} satisfies Meta<typeof BouncyAccordion>;

type Story = StoryObj<typeof meta>;

const NOTHING_OPEN = 'nothing open';
const COUNTS = [
  { value: '3', label: '3 rows' },
  { value: '6', label: '6 rows' },
] as const;

type CountKey = (typeof COUNTS)[number]['value'];

// biome-ignore lint/style/useComponentExportOnlyModules: story helper
function BouncyAccordionPlayground() {
  const [collapsible, setCollapsible] = useState(true);
  const [icons, setIcons] = useState(true);
  const [countKey, setCountKey] = useState<CountKey>('6');
  const [lockLast, setLockLast] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const iconColor = useThemeColor('muted-foreground');

  const items = useMemo<BouncyAccordionItem[]>(() => {
    const count = Number(countKey);
    return SOURCE.slice(0, count).map(({ id, title, description, Icon }, index) => ({
      id,
      title,
      description,
      icon: icons ? <Icon color={iconColor} size={16} /> : undefined,
      disabled: lockLast && index === count - 1,
    }));
  }, [countKey, icons, iconColor, lockLast]);

  return (
    <Playground>
      <ControlCard title="Options">
        <Choice label="Rows" onChange={setCountKey} options={COUNTS} value={countKey} />
        <Toggle label="Collapsible" onChange={setCollapsible} value={collapsible} />
        <Toggle label="Icons" onChange={setIcons} value={icons} />
        <Toggle label="Lock last row" onChange={setLockLast} value={lockLast} />
      </ControlCard>

      {/* With `collapsible` off, pressing the open row keeps it open — one row is
          always expanded. With it on, the same press closes it and `value` is null. */}
      <View className="gap-2">
        <BouncyAccordion collapsible={collapsible} items={items} onValueChange={setOpen} value={open} />
        <Note testID="story-open">{open ?? NOTHING_OPEN}</Note>
      </View>

      <View className="h-3" />
      {/* Rows adjacent to the open one detach: the group's corner radii and the gap
          between rows spring apart, which is the whole point of the bounce. */}
      <Section title="Pre-opened, not collapsible">
        <BouncyAccordion collapsible={false} defaultValue="brief" items={items} />
      </Section>
    </Playground>
  );
}

export default meta;

/** One controlled accordion with a live value readout, plus the non-collapsible
 *  variant that always keeps a row open. "Lock last row" disables a row. */
export const Interactive: Story = { render: () => <BouncyAccordionPlayground /> };

export const Default: Story = {
  name: 'Demo: Expand a row',
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
