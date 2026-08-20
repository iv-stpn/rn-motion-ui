import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { View } from 'react-native';
import { NotificationLine as Notification } from 'rn-motion-ui-icons/icons/notification-line';
import { Settings4Line as Settings } from 'rn-motion-ui-icons/icons/settings-4-line';
import { User2Line as User } from 'rn-motion-ui-icons/icons/user-2-line';
import { fn } from 'storybook/test';
import { Choice, Code, ControlCard, Note, Playground, Sample, Section, Toggle, Variants } from '../../__stories__/story-harness';
import { cn } from '../../lib/cn';
import { SURFACE_CLASSNAME } from '../../lib/elevated';
import { ActionRowGroup, type ActionRowGroupItem } from './action-row-group';
import type { ItemRowSize } from './item-row';
import type { RowGroupVariant } from './row-group';

const onPress = fn();
const SIZES: ItemRowSize[] = ['sm', 'md', 'lg'];
const VARIANTS: RowGroupVariant[] = ['grouped', 'spaced', 'sections'];

function RowGroupPlayground() {
  const [variant, setVariant] = useState<RowGroupVariant>('grouped');
  const [size, setSize] = useState<ItemRowSize>('md');
  const [showDescriptions, setShowDescriptions] = useState(true);

  const description = showDescriptions ? 'Manage your account' : undefined;

  const items: ActionRowGroupItem[] = [
    { id: 'profile', title: 'Profile', description, leftAdornment: { icon: User }, onPress },
    {
      id: 'notifications',
      title: 'Notifications',
      description: showDescriptions ? 'Choose how you hear from us' : undefined,
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
        <Toggle label="Descriptions" value={showDescriptions} onChange={setShowDescriptions} />
      </ControlCard>
      <View className="w-80">
        <ActionRowGroup variant={variant} size={size} items={items} />
      </View>
      <Note>
        <Code>grouped</Code>: flush rows with dividers in a bordered container. <Code>spaced</Code>: rows separated by a
        size-dependent gap. <Code>sections</Code>: padded card with separator lines between rows.
      </Note>
    </Playground>
  );
}

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
                <View className={cn('w-56', v === 'sections' && cn('rounded-2xl p-4', SURFACE_CLASSNAME[3]))}>
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
  title: 'Rows/ActionRowGroup',
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

/** Every variant at every size. */
export const Showcase: Story = {
  name: 'Showcase: variants × sizes',
  render: () => <ShowcasePlayground />,
};
