import type { Meta, StoryObj } from '@storybook/react';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { expect, screen, userEvent, within } from 'storybook/test';
import { ELEVATION_KEYS, ELEVATIONS, type ElevationKey } from '../../__stories__/story-elevations';
import { Choice, Controls, Note, Playground, Section, Toggle } from '../../__stories__/story-harness';
import { TRIGGER_KINDS, TriggerButton, type TriggerKind } from '../../__stories__/story-trigger';
import { Bell, ChevronDown, Moon, Settings, User } from '../../lib/icons';
import { useThemeColor } from '../../theme/use-theme-color';
import { Button } from '../Button/button';
import { MenuItem } from '../MenuItem/menu-item';
import { Text } from '../Text/text';
import { AdaptiveDropdown, type ContentRenderProps, type TriggerRenderProps } from './adaptive-dropdown';

const meta = {
  title: 'Components/AdaptiveDropdown',
  component: AdaptiveDropdown,
  parameters: { layout: 'centered' },
  // trigger and children are managed by each story's render fn; stubs satisfy the type checker
  args: { trigger: null, children: null },
} satisfies Meta<typeof AdaptiveDropdown>;

type Story = StoryObj<typeof meta>;

const MENU_LABEL = 'Menu';
const CLOSE_MENU_LABEL = 'Close menu';
const CLOSE_LABEL = 'Close';
const CLEAR_LABEL = 'Clear';
const PANEL_TITLE = 'Options';
const SMALL_SCREEN_NOTE =
  'Narrow viewports swap the floating panel for a bottom sheet, where "Full sheet" stretches it to the full height.';

const ALIGNS = ['start', 'end'] as const;
type Align = (typeof ALIGNS)[number];

const WIDTHS = ['240', '320', '400'] as const;
type WidthKey = (typeof WIDTHS)[number];

const OFFSETS = ['0', '8', '20'] as const;
type OffsetKey = (typeof OFFSETS)[number];

const SCROLL_MAX_HEIGHT = 260;
const LONG_LIST_LENGTH = 18;

type MenuEntry = { label: string; icon?: typeof User };

const ITEMS: readonly MenuEntry[] = [
  { label: 'Profile', icon: User },
  { label: 'Notifications', icon: Bell },
  { label: 'Appearance', icon: Moon },
  { label: 'Settings', icon: Settings },
];

const LONG_ITEMS: readonly MenuEntry[] = Array.from({ length: LONG_LIST_LENGTH }, (_, index) => ({
  label: `Item ${index + 1}`,
}));

type MenuBodyProps = { long?: boolean; onClose?: () => void };

// biome-ignore lint/style/useComponentExportOnlyModules: story helper co-located with its stories
function MenuBody({ long = false, onClose }: MenuBodyProps) {
  const rows = long ? LONG_ITEMS : ITEMS;
  return (
    <View className="py-1">
      {rows.map((row) => (
        <MenuItem icon={row.icon} key={row.label} label={row.label} />
      ))}
      {onClose ? (
        <View className="px-4 pt-2">
          <Button onPress={onClose} size="sm" className="self-start" variant="outline">
            {CLOSE_LABEL}
          </Button>
        </View>
      ) : null}
    </View>
  );
}

// The render-prop `trigger` gets `{ open, toggle }`; the chevron tracks the theme so
// the open state stays legible on dark surfaces (a fixed dark hex vanished there).
// biome-ignore lint/style/useComponentExportOnlyModules: story helper co-located with its stories
function PlaygroundTrigger({ open, toggle }: TriggerRenderProps) {
  const openColor = useThemeColor('foreground');
  const closedColor = useThemeColor('muted-foreground');
  return (
    <Button onPress={toggle} rightAdornment={<ChevronDown color={open ? openColor : closedColor} size={16} />} variant="outline">
      {MENU_LABEL}
    </Button>
  );
}

type SwappableTriggerProps = TriggerRenderProps & { kind: TriggerKind };

// The playground's trigger: the same `{ open, toggle }` render prop as above, but
// the body is a `TriggerButton` so the Trigger chips can swap Button /
// ElevatedButton / GlossyButton / bare Pressable under one dropdown.
// biome-ignore lint/style/useComponentExportOnlyModules: story helper co-located with its stories
function SwappableTrigger({ kind, open, toggle }: SwappableTriggerProps) {
  return <TriggerButton buttonVariant="outline" kind={kind} label={open ? CLOSE_MENU_LABEL : MENU_LABEL} onPress={toggle} />;
}

const HEADER_ACTION = (
  <Text className="text-muted-foreground" size="sm">
    {CLEAR_LABEL}
  </Text>
);

// biome-ignore lint/style/useComponentExportOnlyModules: story helper co-located with its stories
function DropdownPlayground() {
  const [align, setAlign] = useState<Align>('start');
  const [widthKey, setWidthKey] = useState<WidthKey>('320');
  const [offsetKey, setOffsetKey] = useState<OffsetKey>('8');
  const [elevationKey, setElevationKey] = useState<ElevationKey>('5');
  const [withTitle, setWithTitle] = useState(true);
  const [withClose, setWithClose] = useState(true);
  const [withHeaderAction, setWithHeaderAction] = useState(false);
  const [scrollable, setScrollable] = useState(false);
  const [longList, setLongList] = useState(false);
  const [fullSheet, setFullSheet] = useState(false);
  const [controlled, setControlled] = useState(false);
  const [open, setOpen] = useState(false);
  const [triggerKind, setTriggerKind] = useState<TriggerKind>('button');

  const renderContent = useCallback(({ close }: ContentRenderProps) => <MenuBody long={longList} onClose={close} />, [longList]);
  const renderTrigger = useCallback(
    (props: TriggerRenderProps) => <SwappableTrigger kind={triggerKind} open={props.open} toggle={props.toggle} />,
    [triggerKind],
  );
  // Only hand `open`/`onOpenChange` over when the toggle is on — omitting them lets
  // the component own its state, which is the other half of the API to exhibit.
  const controlledProps = controlled ? { onOpenChange: setOpen, open } : {};
  const openNote = controlled ? `Controlled — open: ${String(open)}` : 'Uncontrolled';

  return (
    <Playground className="min-w-[340px]">
      <Controls>
        <Choice label="Align" onChange={setAlign} options={ALIGNS} value={align} />
        <Choice label="Width" onChange={setWidthKey} options={WIDTHS} value={widthKey} />
        <Choice label="Offset" onChange={setOffsetKey} options={OFFSETS} value={offsetKey} />
        <Toggle label="Title" onChange={setWithTitle} value={withTitle} />
        <Toggle label="Close button" onChange={setWithClose} value={withClose} />
        <Toggle label="Header action" onChange={setWithHeaderAction} value={withHeaderAction} />
        <Toggle label="Long list" onChange={setLongList} value={longList} />
        <Toggle label="Scrollable" onChange={setScrollable} value={scrollable} />
        <Toggle label="Full sheet" onChange={setFullSheet} value={fullSheet} />
        <Toggle label="Controlled" onChange={setControlled} value={controlled} />
        <Choice label="Trigger" onChange={setTriggerKind} options={TRIGGER_KINDS} value={triggerKind} />
      </Controls>

      <Section title="Elevation">
        <View className="items-start">
          <Choice onChange={setElevationKey} options={ELEVATION_KEYS} value={elevationKey} />
        </View>
      </Section>

      <Section>
        <AdaptiveDropdown
          align={align}
          elevation={ELEVATIONS[elevationKey]}
          fullSheet={fullSheet}
          headerRight={withHeaderAction ? HEADER_ACTION : undefined}
          maxHeight={SCROLL_MAX_HEIGHT}
          offset={Number(offsetKey)}
          scrollable={scrollable}
          showClose={withClose}
          title={withTitle ? PANEL_TITLE : undefined}
          trigger={renderTrigger}
          width={Number(widthKey)}
          {...controlledProps}
        >
          {renderContent}
        </AdaptiveDropdown>
        <Note testID="story-open">{openNote}</Note>
      </Section>
      <Note>{SMALL_SCREEN_NOTE}</Note>
    </Playground>
  );
}

export default meta;

/** Every panel knob in one canvas: alignment, width, offset, elevation, header slots, scrolling, controlled state. */
export const Interactive: Story = { render: () => <DropdownPlayground /> };

/** Uncontrolled dropdown — manages its own open state. */
export const Default: Story = {
  name: 'Demo: Open the menu',
  render: () => (
    <View className="items-center">
      <AdaptiveDropdown trigger={PlaygroundTrigger}>
        <MenuBody />
      </AdaptiveDropdown>
    </View>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Click the trigger to open the dropdown panel.
    await userEvent.click(await canvas.findByText(MENU_LABEL));
    // Panel content mounts in a Modal — use screen to query outside the canvas.
    await expect(await screen.findByText('Profile')).toBeTruthy();
    await expect(await screen.findByText('Notifications')).toBeTruthy();
  },
};
