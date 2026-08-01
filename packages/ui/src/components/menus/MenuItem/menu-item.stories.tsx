import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { View } from 'react-native';
import { fn } from 'storybook/test';
import { Choice, ControlCard, Playground, Sample, Section, Toggle, Variants } from '../../../__stories__/story-harness';
import { ChevronRight, User } from '../../../lib/icons';
import { Text } from '../../typography/Text/text';
import { MenuItem, type MenuItemMode, type MenuItemSize } from './menu-item';

const onPress = fn();

type HintChipProps = { hint: string };

// Hint chip matching CommandPalette's trailing hint style
// biome-ignore lint/style/useComponentExportOnlyModules: story helper co-located with its stories
function HintChip({ hint }: HintChipProps) {
  return (
    <Text className="rounded border border-border bg-surface-2 px-1.5 py-0.5 text-[10px] text-muted-foreground">{hint}</Text>
  );
}

const meta = {
  title: 'Menus/MenuItem',
  component: MenuItem,
  parameters: { layout: 'centered' },
  args: { label: 'Menu item', onPress },
} satisfies Meta<typeof MenuItem>;

type Story = StoryObj<typeof meta>;

type TrailingKey = 'none' | 'hint' | 'chevron';
const TRAILING_OPTS = ['none', 'hint', 'chevron'] as const satisfies readonly TrailingKey[];

const SIZES: MenuItemSize[] = ['sm', 'md', 'lg'];
const MODES: MenuItemMode[] = ['menu', 'sidebar'];

function trailingNode(key: TrailingKey) {
  if (key === 'hint') return <HintChip hint="⌘ K" />;
  if (key === 'chevron') return <ChevronRight size={14} />;
}

// biome-ignore lint/style/useComponentExportOnlyModules: story helper co-located with its stories
function MenuItemPlayground() {
  const [active, setActive] = useState(false);
  const [showIcon, setShowIcon] = useState(true);
  const [iosMode, setIosMode] = useState(false);
  const [mode, setMode] = useState<MenuItemMode>('menu');
  const [trailingKey, setTrailingKey] = useState<TrailingKey>('none');
  const [size, setSize] = useState<MenuItemSize>('md');

  return (
    <Playground>
      <ControlCard title="Options">
        <Choice label="Trailing" options={TRAILING_OPTS} value={trailingKey} onChange={setTrailingKey} />
        <Choice label="Size" options={SIZES} value={size} onChange={setSize} />
        <Toggle label="Active" value={active} onChange={setActive} />
        <Toggle label="Icon" value={showIcon} onChange={setShowIcon} />
        <Toggle label="iOS style" value={iosMode} onChange={setIosMode} />
        {!iosMode && <Choice label="Mode" options={MODES} value={mode} onChange={setMode} />}
      </ControlCard>
      <View className="w-64 py-1">
        <MenuItem
          label="Menu item"
          icon={showIcon ? User : undefined}
          size={size}
          active={active}
          mode={mode}
          trailing={trailingNode(trailingKey)}
          // theme-exempt: decorative iOS accent colour
          iconBackgroundColor={iosMode ? '#3b82f6' : undefined}
          onPress={onPress}
        />
      </View>
    </Playground>
  );
}

// biome-ignore lint/style/useComponentExportOnlyModules: story helper co-located with its stories
function ModesShowcase() {
  return (
    <Playground>
      {MODES.map((m) => (
        <Section key={m} title={`Mode: ${m}`}>
          <Variants direction="column">
            {SIZES.map((s) => (
              <Sample key={s} label={s}>
                <View className="w-48 gap-0.5">
                  <MenuItem label="Inactive" icon={User} size={s} mode={m} active={false} onPress={onPress} />
                  <MenuItem label="Active" icon={User} size={s} mode={m} active={true} onPress={onPress} />
                  <MenuItem label="No icon" size={s} mode={m} active={false} onPress={onPress} />
                </View>
              </Sample>
            ))}
          </Variants>
        </Section>
      ))}
    </Playground>
  );
}

export default meta;

/** Active toggle, icon, iOS mode, and trailing variants in a single interactive panel. */
export const Interactive: Story = {
  render: () => <MenuItemPlayground />,
};

/** Menu vs sidebar — weight, text colour, and icon treatment at every size. */
export const Modes: Story = {
  name: 'Modes: menu vs sidebar',
  render: () => <ModesShowcase />,
};
