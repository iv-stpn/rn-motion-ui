import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { View } from 'react-native';
import { NotificationLine as Notification } from 'rn-motion-ui-icons/icons/notification-line';
import { Settings4Line as Settings } from 'rn-motion-ui-icons/icons/settings-4-line';
import { User2Line as User } from 'rn-motion-ui-icons/icons/user-2-line';
import { fn } from 'storybook/test';
import { Choice, ControlCard, Note, Playground, Sample, Section, Variants } from '../../__stories__/story-harness';
import { Switch } from '../form/Switch/switch';
import type { ItemRowSize } from './item-row';
import { ActionRowGroup, type ActionRowGroupItem, ItemRowGroup, type ItemRowGroupItem, type RowGroupVariant } from './row-group';

const onPress = fn();
const SIZES: ItemRowSize[] = ['sm', 'md', 'lg'];
const VARIANTS: RowGroupVariant[] = ['grouped', 'spaced'];

// biome-ignore lint/style/useComponentExportOnlyModules: story helper co-located with its stories
function RowGroupPlayground() {
  const [variant, setVariant] = useState<RowGroupVariant>('grouped');
  const [size, setSize] = useState<ItemRowSize>('md');

  const items: ActionRowGroupItem[] = [
    { id: 'profile', title: 'Profile', description: 'Manage your account', leftAdornment: { icon: User }, onPress },
    {
      id: 'notifications',
      title: 'Notifications',
      description: 'Choose how you hear from us',
      leftAdornment: { icon: Notification },
      onPress,
    },
    { id: 'settings', title: 'Settings', leftAdornment: { icon: Settings }, onPress },
  ];

  return (
    <Playground>
      <ControlCard title="Options">
        <Choice label="Variant" options={VARIANTS} value={variant} onChange={setVariant} />
        <Choice label="Size" options={SIZES} value={size} onChange={setSize} />
      </ControlCard>
      <View className="w-72">
        <ActionRowGroup variant={variant} size={size} items={items} />
      </View>
      <Note>
        <code>grouped</code>: flush rows with dividers in a bordered container. <code>spaced</code>: rows separated by a
        size-dependent gap.
      </Note>
    </Playground>
  );
}

// biome-ignore lint/style/useComponentExportOnlyModules: story helper
function ItemRowGroupPlayground() {
  const [wifiOn, setWifiOn] = useState(true);
  const [btOn, setBtOn] = useState(false);

  const items: ItemRowGroupItem[] = [
    {
      id: 'airplane',
      title: 'Airplane mode',
      leftAdornment: { icon: Settings },
      rightAdornment: <Switch isSelected={false} onSelectedChange={fn()} />,
    },
    {
      id: 'wifi',
      title: 'Wi-Fi',
      description: 'Connected to Home Network',
      leftAdornment: { icon: Notification },
      rightAdornment: <Switch isSelected={wifiOn} onSelectedChange={setWifiOn} />,
    },
    {
      id: 'bluetooth',
      title: 'Bluetooth',
      leftAdornment: { icon: User },
      rightAdornment: <Switch isSelected={btOn} onSelectedChange={setBtOn} />,
    },
  ];

  return (
    <Playground>
      <View className="w-72">
        <ItemRowGroup items={items} />
      </View>
      <Note>ItemRow items in a grouped container — trailing controls are the action, not the whole row.</Note>
    </Playground>
  );
}

// biome-ignore lint/style/useComponentExportOnlyModules: story helper
function ShowcasePlayground() {
  const items: ActionRowGroupItem[] = [
    { id: 'profile', title: 'Profile', leftAdornment: { icon: User }, onPress },
    { id: 'notifications', title: 'Notifications', leftAdornment: { icon: Notification }, onPress },
    { id: 'settings', title: 'Settings', leftAdornment: { icon: Settings }, onPress },
  ];

  return (
    <Playground>
      {VARIANTS.map((v) => (
        <Section key={v} title={`Variant: ${v}`}>
          <Variants direction="row" align="stretch">
            {SIZES.map((s) => (
              <Sample key={s} label={`${s}`}>
                <View className="w-56">
                  <ActionRowGroup variant={v} size={s} items={items} />
                </View>
              </Sample>
            ))}
          </Variants>
        </Section>
      ))}
    </Playground>
  );
}

const meta = {
  title: 'RowPrimitive/RowGroup',
  component: ActionRowGroup,
  parameters: { layout: 'centered' },
  args: { items: [{ id: 'test', title: 'Test', onPress }] },
} satisfies Meta<typeof ActionRowGroup>;

type Story = StoryObj<typeof meta>;

export default meta;

/** Toggle between grouped and spaced variants, and change the size. */
export const Interactive: Story = {
  render: () => <RowGroupPlayground />,
};

/** ItemRow items in a grouped container — trailing controls like switches. */
export const WithItemRows: Story = {
  render: () => <ItemRowGroupPlayground />,
};

/** Every variant at every size with ActionRow items. */
export const Showcase: Story = {
  name: 'Showcase: variants × sizes',
  render: () => <ShowcasePlayground />,
};
