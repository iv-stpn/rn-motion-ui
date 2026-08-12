import type { Meta, StoryObj } from '@storybook/react';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { Home2Line as Home } from 'rn-motion-ui-icons/icons/home-2-line';
import { expect, userEvent, within } from 'storybook/test';
import { Choice, ControlCard, Note, Playground, Sample, Section, Variants } from '../../../__stories__/story-harness';
import { Text } from '../../typography/Text/text';
import { type BreadcrumbItem, Breadcrumbs, type BreadcrumbsSize } from './breadcrumbs';

const TRAIL: BreadcrumbItem[] = [
  { id: '', label: 'Files' },
  { id: 'documents', label: 'Documents' },
  { id: 'documents/reports', label: 'Reports' },
];

const DEEP_TRAIL: BreadcrumbItem[] = [
  { id: '', label: 'Files' },
  { id: 'a', label: 'Documents' },
  { id: 'a/b', label: 'Reports' },
  { id: 'a/b/c', label: '2024' },
  { id: 'a/b/c/d', label: 'Q1' },
];

const noop = () => {
  /* static sample */
};

/** A trail that reads as a path rather than as steps. */
const SLASH = '/';
const SLASH_SEPARATOR = <Text className="text-muted-foreground">{SLASH}</Text>;

const meta = {
  title: 'Display/Breadcrumbs',
  component: Breadcrumbs,
  parameters: { layout: 'centered' },
  args: { items: TRAIL, onNavigate: noop, size: 'sm' },
  argTypes: {
    size: { control: 'select', options: ['sm', 'base'] },
    maxVisible: { control: { type: 'range', min: 2, max: 6, step: 1 } },
    scrollable: { control: 'boolean' },
  },
} satisfies Meta<typeof Breadcrumbs>;

type Story = StoryObj<typeof meta>;

const SIZES = ['sm', 'base'] as const satisfies readonly BreadcrumbsSize[];

function BreadcrumbsPlayground() {
  const [size, setSize] = useState<BreadcrumbsSize>('sm');
  const [trail, setTrail] = useState<BreadcrumbItem[]>(DEEP_TRAIL);

  // Pressing a level truncates the trail there, which is what navigating to it
  // means — the story stands in for a router or a folder store.
  const handleNavigate = useCallback((id: string) => {
    setTrail((current) => current.slice(0, current.findIndex((item) => item.id === id) + 1));
  }, []);

  return (
    <Playground>
      <ControlCard title="Options">
        <Choice label="Size" onChange={setSize} options={SIZES} value={size} />
      </ControlCard>

      <Sample label="Press a level to go there">
        <Breadcrumbs items={trail} onNavigate={handleNavigate} size={size} />
      </Sample>

      <Note>{`Current level: ${trail.at(-1)?.label ?? '—'}`}</Note>
    </Playground>
  );
}

export const Interactive: Story = { render: () => <BreadcrumbsPlayground /> };

/**
 * The trail names every level above the current one, and each is a way back. The
 * last one is the current level: plain text rather than a control, since it goes
 * nowhere — which is also what marks it as current to a screen reader.
 */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Earlier levels are buttons named for where they lead.
    await canvas.findByLabelText('Go to Files');
    await canvas.findByLabelText('Go to Documents');

    // The current level is text, not a control.
    await canvas.findByText('Reports');
    expect(canvas.queryByLabelText('Go to Reports')).toBeNull();
  },
};

/** Two text scales; the separator and any leading icon follow the label size. */
export const Sizes: Story = {
  render: () => (
    <Variants direction="column">
      {SIZES.map((size) => (
        <Sample key={size} label={size}>
          <Breadcrumbs items={TRAIL} onNavigate={noop} size={size} />
        </Sample>
      ))}
    </Variants>
  ),
};

/**
 * `maxVisible` caps the rendered levels and collapses the middle behind a `…`.
 * Nothing becomes unreachable: pressing it reveals what was hidden. Without it a
 * deep trail scrolls horizontally instead, keeping one line.
 */
export const Collapsed: Story = {
  args: { items: DEEP_TRAIL, maxVisible: 3 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Root and the two levels nearest the current one; the middle is folded away.
    await canvas.findByLabelText('Go to Files');
    await canvas.findByText('Q1');
    expect(canvas.queryByLabelText('Go to Documents')).toBeNull();

    // The gap says how much it hides, and pressing it hands those levels back.
    const ellipsis = await canvas.findByLabelText('Show 2 hidden levels');
    await userEvent.click(ellipsis);
    await canvas.findByLabelText('Go to Documents');
    await canvas.findByLabelText('Go to Reports');
  },
};

/** An icon rides ahead of a label — a house for the root reads faster than a word. */
export const WithIcon: Story = {
  args: { items: [{ icon: Home, id: '', label: 'Home' }, ...TRAIL.slice(1)] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByLabelText('Go to Home');
  },
};

/**
 * `separator` replaces the chevron with anything — here a slash, for a trail that
 * reads as a path. `scrollable={false}` lets a long trail wrap instead of scroll.
 */
export const CustomSeparator: Story = {
  render: () => (
    <View className="gap-4">
      <Sample label="Slash separator">
        <Breadcrumbs items={TRAIL} onNavigate={noop} separator={SLASH_SEPARATOR} />
      </Sample>
      <Sample label="Wrapping instead of scrolling">
        <Breadcrumbs items={DEEP_TRAIL} onNavigate={noop} scrollable={false} />
      </Sample>
    </View>
  ),
};

/**
 * `currentId` picks which level is the destination. Passing `null` makes every
 * level pressable — for a trail whose leaf is not where you are.
 */
export const AllPressable: Story = {
  args: { currentId: null },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByLabelText('Go to Reports');
  },
};

export const Accessibility: Story = {
  name: 'Accessibility',
  render: () => (
    <Section title="Roles and names">
      <Breadcrumbs items={TRAIL} onNavigate={noop} />
    </Section>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // The trail is a list, named so a reader can announce what it is.
    await canvas.findByLabelText('Breadcrumb');

    // Every level that leads somewhere is a button with an accessible name.
    await canvas.findByRole('button', { name: 'Go to Documents' });

    // The current level is not one — it leads nowhere, and that is what says so.
    expect(canvas.queryByRole('button', { name: 'Go to Reports' })).toBeNull();
  },
};

export default meta;
