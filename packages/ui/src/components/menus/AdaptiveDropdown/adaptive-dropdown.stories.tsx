import type { Meta, StoryObj } from '@storybook/react';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { DownLine as ChevronDown } from 'rn-motion-ui-icons/icons/down-line';
import { MoonLine as Moon } from 'rn-motion-ui-icons/icons/moon-line';
import { NotificationLine as Bell } from 'rn-motion-ui-icons/icons/notification-line';
import { Settings1Line as Settings } from 'rn-motion-ui-icons/icons/settings-1-line';
import { User2Line as User } from 'rn-motion-ui-icons/icons/user-2-line';
import { expect, screen, userEvent, within } from 'storybook/test';
import { ELEVATION_KEYS, ELEVATIONS, type ElevationKey } from '../../../__stories__/story-elevations';
import { Choice, ControlCard, Playground, Toggle } from '../../../__stories__/story-harness';
import { TriggerButton, TriggerControls, type TriggerState, useTriggerState } from '../../../__stories__/story-trigger';
import { useThemeColor } from '../../../theme/use-theme-color';
import { Button } from '../../buttons/Button/button';
import { Menu, type MenuEntry } from '../../rows/menu';
import { Text } from '../../typography/Text/text';
import { AdaptiveDropdown, type TriggerRenderProps } from './adaptive-dropdown';

const meta = {
  title: 'Menus/AdaptiveDropdown',
  component: AdaptiveDropdown,
  parameters: { layout: 'centered' },
  // trigger and children are managed by each story's render fn; stubs satisfy the type checker
  args: { trigger: null, children: null },
} satisfies Meta<typeof AdaptiveDropdown>;

type Story = StoryObj<typeof meta>;

const MENU_LABEL = 'Menu';
const CLOSE_MENU_LABEL = 'Close menu';
const CLEAR_LABEL = 'Clear';
const PANEL_TITLE = 'Options';

const ALIGNS = ['start', 'end'] as const;
type Align = (typeof ALIGNS)[number];

const WIDTHS = ['240', '320', '400'] as const;
type WidthKey = (typeof WIDTHS)[number];

const OFFSETS = ['0', '8', '20'] as const;
type OffsetKey = (typeof OFFSETS)[number];

const SCROLL_MAX_HEIGHT = 260;
const LONG_LIST_LENGTH = 18;

const ITEMS: readonly MenuEntry[] = [
  { label: 'Profile', icon: User, id: 'profile' },
  { label: 'Notifications', icon: Bell, id: 'notifications' },
  { label: 'Appearance', icon: Moon, id: 'appearance' },
  { label: 'Settings', icon: Settings, id: 'settings' },
];

const LONG_ITEMS: readonly MenuEntry[] = Array.from({ length: LONG_LIST_LENGTH }, (_, index) => ({
  label: `Item ${index + 1}`,
  id: `item-${index + 1}`,
}));

// The render-prop `trigger` gets `{ open, toggle }`; the chevron tracks the theme so
// the open state stays legible on dark surfaces (a fixed dark hex vanished there).

function PlaygroundTrigger({ open, toggle }: TriggerRenderProps) {
  const openColor = useThemeColor('foreground');
  const closedColor = useThemeColor('muted-foreground');
  return (
    <Button onPress={toggle} rightAdornment={<ChevronDown color={open ? openColor : closedColor} size={16} />} variant="ghost">
      {MENU_LABEL}
    </Button>
  );
}

type SwappableTriggerProps = TriggerRenderProps & Pick<TriggerState, 'kind' | 'size' | 'shape' | 'floating' | 'elevation'>;

// The playground's trigger: the same `{ open, toggle }` render prop as above, but
// the body is a `TriggerButton` so the Trigger chips can swap Button /
// ElevatedButton / bare Pressable under one dropdown.

function SwappableTrigger({ kind, size, shape, floating, elevation, open, toggle }: SwappableTriggerProps) {
  return (
    <TriggerButton
      kind={kind}
      size={size}
      shape={shape}
      floating={floating}
      elevation={ELEVATIONS[elevation]}
      label={open ? CLOSE_MENU_LABEL : MENU_LABEL}
      onPress={toggle}
    />
  );
}

const HEADER_ACTION = (
  <Text className="text-muted-foreground" size="sm">
    {CLEAR_LABEL}
  </Text>
);

function DropdownPlayground() {
  const [align, setAlign] = useState<Align>('start');
  const [widthKey, setWidthKey] = useState<WidthKey>('320');
  const [offsetKey, setOffsetKey] = useState<OffsetKey>('8');
  const [floating, setFloating] = useState(false);
  const [elevationKey, setElevationKey] = useState<ElevationKey>('6');
  const [withTitle, setWithTitle] = useState(true);
  const [withHeaderAction, setWithHeaderAction] = useState(false);
  const [scrollable, setScrollable] = useState(false);
  const [longList, setLongList] = useState(false);
  const [fullSheet, setFullSheet] = useState(false);
  const [controlled, setControlled] = useState(false);
  const [overlay, setOverlay] = useState(true);
  const [closeOnOutside, setCloseOnOutside] = useState(true);
  const [open, setOpen] = useState(false);
  const trigger = useTriggerState();

  const renderContent = useCallback(() => <Menu entries={longList ? LONG_ITEMS : ITEMS} />, [longList]);
  const renderTrigger = useCallback(
    (props: TriggerRenderProps) => (
      <SwappableTrigger
        kind={trigger.kind}
        size={trigger.size}
        shape={trigger.shape}
        floating={trigger.floating}
        elevation={trigger.elevation}
        open={props.open}
        toggle={props.toggle}
      />
    ),
    [trigger.kind, trigger.size, trigger.shape, trigger.floating, trigger.elevation],
  );
  // Only hand `open`/`onOpenChange` over when the toggle is on — omitting them lets
  // the component own its state, which is the other half of the API to exhibit.
  const controlledProps = controlled ? { onOpenChange: setOpen, open } : {};

  return (
    <Playground className="min-w-[340px]">
      <ControlCard title="Dropdown panel">
        <Toggle label="Floating" onChange={setFloating} value={floating} />
        <Choice label="Elevation" onChange={setElevationKey} options={ELEVATION_KEYS} value={elevationKey} />
        <Choice label="Align" onChange={setAlign} options={ALIGNS} value={align} />
        <Choice label="Width" onChange={setWidthKey} options={WIDTHS} value={widthKey} />
        <Choice label="Offset" onChange={setOffsetKey} options={OFFSETS} value={offsetKey} />
      </ControlCard>

      <ControlCard title="Options">
        <Toggle label="Title" onChange={setWithTitle} value={withTitle} />
        <Toggle label="Header action" onChange={setWithHeaderAction} value={withHeaderAction} />
        <Toggle label="Long list" onChange={setLongList} value={longList} />
        <Toggle label="Scrollable" onChange={setScrollable} value={scrollable} />
        <Toggle label="Full sheet" onChange={setFullSheet} value={fullSheet} />
        <Toggle label="Controlled" onChange={setControlled} value={controlled} />
        <Toggle label="Show overlay" onChange={setOverlay} value={overlay} />
        <Toggle label="Close on outside" onChange={setCloseOnOutside} value={closeOnOutside} />
      </ControlCard>

      <TriggerControls state={trigger} />

      <AdaptiveDropdown
        align={align}
        closeOnOutsidePress={closeOnOutside}
        floating={floating}
        elevation={ELEVATIONS[elevationKey]}
        fullSheet={fullSheet}
        headerSuffix={withHeaderAction ? HEADER_ACTION : undefined}
        maxHeight={SCROLL_MAX_HEIGHT}
        offset={Number(offsetKey)}
        overlay={overlay}
        scrollable={scrollable}
        title={withTitle ? PANEL_TITLE : undefined}
        trigger={renderTrigger}
        width={Number(widthKey)}
        {...controlledProps}
      >
        {renderContent}
      </AdaptiveDropdown>
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
        <Menu entries={ITEMS} />
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
