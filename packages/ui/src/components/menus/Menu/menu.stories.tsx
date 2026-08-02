import type { Meta, StoryObj } from '@storybook/react';
import { type ReactNode, useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';
import { expect, screen, userEvent, waitFor, within } from 'storybook/test';
import { Choice, ControlCard, Note, Playground, Sample, Section, Toggle, Variants } from '../../../__stories__/story-harness';
import { SURFACE_CLASSNAME } from '../../../lib/elevated';
import { Bell, Copy, Moon, Pencil, Share, Trash2, User } from '../../../lib/icons';
import { Button } from '../../form/Button/button';
import { Switch } from '../../form/Switch/switch';
import { Text } from '../../typography/Text/text';
import { AdaptiveDropdown, type ContentRenderProps, type TriggerRenderProps } from '../AdaptiveDropdown/adaptive-dropdown';
import type { MenuItemMode, MenuItemSize } from '../MenuItem/menu-item';
import { Menu, type MenuActionEntry, type MenuEntry } from './menu';

const meta = {
  title: 'Menus/Menu',
  component: Menu,
  parameters: { layout: 'centered' },
  // Every story builds its own list; a stub satisfies the type checker.
  args: { entries: [] },
} satisfies Meta<typeof Menu>;

type Story = StoryObj<typeof meta>;

const SIZES = ['sm', 'md', 'lg'] as const satisfies readonly MenuItemSize[];
const MODES = ['menu', 'sidebar'] as const satisfies readonly MenuItemMode[];
const GUTTERS = ['auto', 'on', 'off'] as const;

const MENU_LABEL = 'Item actions';
const TRIGGER_LABEL = 'Actions';
const GROUP_LABEL = 'Manage';
const DANGER_LABEL = 'Delete';
const DISABLED_LABEL = 'Move to…';
const EDIT_LABEL = 'Edit';
const DROPDOWN_TEST_ID = 'menu-dropdown';

const FRAMED_NOTE = 'Framed: surface, radius and width come from the container; the top and bottom inset from the list.';
const BARE_NOTE = 'Bare: the list has no frame of its own — rows go edge to edge, on whatever is behind them.';

type PanelProps = { children: ReactNode; width?: number; framed?: boolean };

/**
 * Stand-in for the panel a dropdown would supply — surface, radius and width, all
 * of which belong to the container rather than to the list inside it. It supplies
 * no inset: the list caps its own top and bottom.
 *
 * `framed={false}` drops the whole frame, which is what the list looks like on its
 * own: rows edge to edge, no surface of their own, nothing between them and
 * whatever they were dropped into.
 */
// biome-ignore lint/style/useComponentExportOnlyModules: story helper co-located with its stories
function Panel({ children, width = 260, framed = true }: PanelProps) {
  return (
    <View className={framed ? `overflow-hidden rounded-2xl ${SURFACE_CLASSNAME[3]}` : undefined} style={{ width }}>
      {children}
    </View>
  );
}

type DensityRowProps = { label: string };

/** A `node` entry: something that is not a row at all, living in the same list. */
// biome-ignore lint/style/useComponentExportOnlyModules: story helper co-located with its stories
function DensityRow({ label }: DensityRowProps) {
  const [dense, setDense] = useState(false);
  return (
    <View className="px-3 py-1.5">
      <Switch isSelected={dense} label={label} onSelectedChange={setDense} testID="story-node-switch" theme="info" />
    </View>
  );
}

type PlaygroundFlags = {
  withLabel: boolean;
  withSeparators: boolean;
  withNode: boolean;
  withIcons: boolean;
  withDestructive: boolean;
  withDisabled: boolean;
};

/** The playground's list, assembled from the toggles with `&&` — falsy entries drop out. */
function buildEntries(flags: PlaygroundFlags): MenuEntry[] {
  const { withLabel, withSeparators, withNode, withIcons, withDestructive, withDisabled } = flags;
  return [
    withLabel && { type: 'label' as const, label: GROUP_LABEL },
    { id: 'edit', label: EDIT_LABEL, icon: withIcons ? Pencil : undefined },
    { id: 'share', label: 'Share', icon: withIcons ? Share : undefined },
    { id: 'duplicate', label: 'Duplicate', icon: withIcons ? Copy : undefined },
    withDisabled && { id: 'move', label: DISABLED_LABEL, disabled: true },
    withSeparators && { type: 'separator' as const },
    withNode && <DensityRow key="density" label="Dense rows" />,
    withNode && withSeparators && { type: 'separator' as const },
    withDestructive && { id: 'delete', label: DANGER_LABEL, icon: withIcons ? Trash2 : undefined, destructive: true },
  ];
}

// biome-ignore lint/style/useComponentExportOnlyModules: story helper co-located with its stories
function MenuPlayground() {
  const [size, setSize] = useState<MenuItemSize>('md');
  const [mode, setMode] = useState<MenuItemMode>('menu');
  const [iconGutter, setIconGutter] = useState<(typeof GUTTERS)[number]>('auto');
  const [withLabel, setWithLabel] = useState(true);
  const [withSeparators, setWithSeparators] = useState(true);
  const [withNode, setWithNode] = useState(false);
  const [withIcons, setWithIcons] = useState(true);
  const [withDestructive, setWithDestructive] = useState(true);
  const [withDisabled, setWithDisabled] = useState(false);
  const [framed, setFramed] = useState(true);
  const [chosen, setChosen] = useState<string | null>(null);

  const entries = useMemo(
    () => buildEntries({ withLabel, withSeparators, withNode, withIcons, withDestructive, withDisabled }),
    [withLabel, withSeparators, withNode, withIcons, withDestructive, withDisabled],
  );

  const handleSelect = useCallback((entry: MenuActionEntry) => setChosen(entry.id), []);

  const frameNote = framed ? FRAMED_NOTE : BARE_NOTE;

  return (
    <Playground className="min-w-[320px]">
      <ControlCard title="List">
        <Choice label="Size" onChange={setSize} options={SIZES} value={size} />
        <Choice label="Mode" onChange={setMode} options={MODES} value={mode} />
        <Choice label="Icon gutter" onChange={setIconGutter} options={GUTTERS} value={iconGutter} />
        <Toggle label="Dropdown container" onChange={setFramed} value={framed} />
      </ControlCard>

      <ControlCard title="Entries">
        <Toggle label="Group label" onChange={setWithLabel} value={withLabel} />
        <Toggle label="Separators" onChange={setWithSeparators} value={withSeparators} />
        <Toggle label="Node entry" onChange={setWithNode} value={withNode} />
        <Toggle label="Icons" onChange={setWithIcons} value={withIcons} />
        <Toggle label="Destructive row" onChange={setWithDestructive} value={withDestructive} />
        <Toggle label="Disabled row" onChange={setWithDisabled} value={withDisabled} />
      </ControlCard>

      <Panel framed={framed}>
        <Menu
          accessibilityLabel={MENU_LABEL}
          entries={entries}
          iconGutter={iconGutter}
          mode={mode}
          onSelect={handleSelect}
          size={size}
        />
      </Panel>
      <Note testID="story-chosen">{chosen ? `Chose: ${chosen}` : 'Nothing chosen yet'}</Note>
      <Note>{frameNote}</Note>
    </Playground>
  );
}

const ANATOMY_ENTRIES: MenuEntry[] = [
  { type: 'label', label: 'Group caption' },
  { id: 'item', label: 'Action row', icon: User },
  { id: 'active', label: 'Active row', icon: Bell, active: true },
  { id: 'trailing', label: 'With a hint', icon: Moon, trailing: <Kbd hint="⌘ D" /> },
  { id: 'disabled', label: 'Disabled row', disabled: true },
  { type: 'separator' },
  { type: 'node', node: <DensityRow label="Any node at all" /> },
  { type: 'separator' },
  { id: 'destructive', label: 'Destructive row', icon: Trash2, destructive: true },
];

type KbdProps = { hint: string };

// biome-ignore lint/style/useComponentExportOnlyModules: story helper co-located with its stories
function Kbd({ hint }: KbdProps) {
  return (
    <Text className="rounded border border-border bg-surface-2 px-1.5 py-0.5 text-[10px] text-muted-foreground">{hint}</Text>
  );
}

// biome-ignore lint/style/useComponentExportOnlyModules: story helper co-located with its stories
function SizesShowcase() {
  return (
    <Playground>
      <Section title="Every entry type, at every size">
        <Variants>
          {SIZES.map((size) => (
            <Sample key={size} label={size}>
              <Panel width={220}>
                <Menu accessibilityLabel={`${MENU_LABEL} ${size}`} entries={ANATOMY_ENTRIES} size={size} />
              </Panel>
            </Sample>
          ))}
        </Variants>
      </Section>
    </Playground>
  );
}

/** The dropdown demo: one list, wired to the panel's own `close`. */
// biome-ignore lint/style/useComponentExportOnlyModules: story helper co-located with its stories
function DropdownDemo() {
  const [chosen, setChosen] = useState<string | null>(null);
  const [hidden, setHidden] = useState(false);

  const toggleHidden = useCallback(() => setHidden((value) => !value), []);

  const entries = useMemo<MenuEntry[]>(
    () => [
      { type: 'label', label: GROUP_LABEL },
      { id: 'edit', label: EDIT_LABEL, icon: Pencil, onSelect: () => setChosen(EDIT_LABEL) },
      { id: 'share', label: 'Share', icon: Share, onSelect: () => setChosen('Share') },
      { id: 'move', label: DISABLED_LABEL, disabled: true },
      { type: 'separator' },
      // Stays put: a row that toggles something should not take the panel with it.
      { id: 'hidden', label: 'Show hidden files', active: hidden, closeOnSelect: false, onSelect: toggleHidden },
      { type: 'separator' },
      { id: 'delete', label: DANGER_LABEL, icon: Trash2, destructive: true, onSelect: () => setChosen(DANGER_LABEL) },
    ],
    [hidden, toggleHidden],
  );

  const renderTrigger = useCallback(
    ({ toggle }: TriggerRenderProps) => (
      <Button onPress={toggle} variant="outline">
        {TRIGGER_LABEL}
      </Button>
    ),
    [],
  );

  const renderContent = useCallback(
    ({ close }: ContentRenderProps) => <Menu accessibilityLabel={MENU_LABEL} entries={entries} onClose={close} />,
    [entries],
  );

  return (
    <View className="items-center gap-3">
      <AdaptiveDropdown testID={DROPDOWN_TEST_ID} trigger={renderTrigger} width={260}>
        {renderContent}
      </AdaptiveDropdown>
      <Note testID="story-chosen">{chosen ? `Chose: ${chosen}` : 'Nothing chosen yet'}</Note>
    </View>
  );
}

export default meta;

/** Every knob in one canvas: size, mode, icon gutter, and each entry type on a toggle. */
export const Interactive: Story = { render: () => <MenuPlayground /> };

/** Action rows, a caption, separators, a bare node, and a destructive row — at all three sizes. */
export const Anatomy: Story = {
  name: 'Anatomy: the four entry types',
  render: () => <SizesShowcase />,
};

/**
 * The intended use: the list inside an `AdaptiveDropdown`, with rows wired to the
 * panel's own `close`. The toggle row sets `closeOnSelect: false` and stays put.
 */
export const InDropdown: Story = {
  name: 'Demo: inside a dropdown',
  render: () => <DropdownDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByText(TRIGGER_LABEL));

    // The panel mounts in a Modal, so it answers `screen` rather than the canvas.
    const menu = await screen.findByRole('menu', { name: MENU_LABEL });

    // Rows are commands; the group caption is not one — readable, never offered.
    await expect(await within(menu).findByRole('menuitem', { name: EDIT_LABEL })).toBeTruthy();
    await expect(within(menu).getByText(GROUP_LABEL)).toBeInTheDocument();
    await expect(within(menu).queryByRole('menuitem', { name: GROUP_LABEL })).toBeNull();

    // A disabled row stays announced, and says it is disabled.
    const disabled = within(menu).getByRole('menuitem', { name: DISABLED_LABEL });
    await expect(disabled).toHaveAttribute('aria-disabled', 'true');

    // `closeOnSelect: false` — the toggle flips and the panel stays open.
    await userEvent.click(within(menu).getByRole('menuitem', { name: 'Show hidden files' }));
    await expect(await screen.findByRole('menu', { name: MENU_LABEL })).toBeTruthy();

    // An ordinary row closes the panel and reports its selection.
    await userEvent.click(within(menu).getByRole('menuitem', { name: EDIT_LABEL }));
    await expect(await canvas.findByTestId('story-chosen')).toHaveTextContent(`Chose: ${EDIT_LABEL}`);
    await waitFor(async () => await expect(screen.queryByRole('menu', { name: MENU_LABEL })).toBeNull());
  },
};
