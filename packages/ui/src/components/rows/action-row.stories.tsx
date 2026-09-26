import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { View } from 'react-native';
import { NotificationLine as Notification } from 'rn-motion-ui-icons/icons/notification-line';
import { User2Line as User } from 'rn-motion-ui-icons/icons/user-2-line';
import { expect, fn } from 'storybook/test';
import { Choice, Code, ControlCard, Note, Playground, Sample, Section, Toggle, Variants } from '../../__stories__/story-harness';
import { ActionRow, type ItemRowSize, type ItemRowVariant } from './action-row';

const onPress = fn();

const SIZES: ItemRowSize[] = ['sm', 'md', 'lg'];
const VARIANTS: ItemRowVariant[] = ['default', 'outline', 'muted'];

function ActionRowPlayground() {
  const [disabled, setDisabled] = useState(false);
  const [showDescription, setShowDescription] = useState(true);
  const [showLeft, setShowLeft] = useState(true);
  const [showChevron, setShowChevron] = useState(true);
  const [size, setSize] = useState<ItemRowSize>('md');
  const [variant, setVariant] = useState<ItemRowVariant>('default');

  return (
    <Playground>
      <ControlCard title="Options">
        <Choice label="Size" options={SIZES} value={size} onChange={setSize} />
        <Choice label="Variant" options={VARIANTS} value={variant} onChange={setVariant} />
        <Toggle label="Description" value={showDescription} onChange={setShowDescription} />
        <Toggle label="Left icon" value={showLeft} onChange={setShowLeft} />
        <Toggle label="Chevron" value={showChevron} onChange={setShowChevron} />
        <Toggle label="Disabled" value={disabled} onChange={setDisabled} />
      </ControlCard>
      <View className="w-72">
        <ActionRow
          title="Profile settings"
          description={showDescription ? 'Manage your account and preferences' : undefined}
          leftAdornment={showLeft ? { icon: User } : undefined}
          rightAdornment={showChevron ? undefined : null}
          size={size}
          variant={variant}
          disabled={disabled}
          onPress={onPress}
        />
      </View>
      <Note>
        The chevron is shown by default when <Code>rightAdornment</Code> is omitted. Toggle Chevron off to pass <Code>null</Code>,
        hiding the trailing slot. Hover or press the row to see the surface overlays.
      </Note>
    </Playground>
  );
}

function ShowcasePlayground() {
  return (
    <Playground>
      {VARIANTS.map((v) => (
        <Section key={v} title={`Variant: ${v}`}>
          <Variants direction="row" align="stretch">
            {SIZES.map((s) => (
              <Sample key={s} label={`${s}`}>
                <View className="w-64">
                  <ActionRow
                    title="Profile settings"
                    description="Manage your account"
                    leftAdornment={{ icon: User }}
                    size={s}
                    variant={v}
                    onPress={onPress}
                  />
                </View>
              </Sample>
            ))}
          </Variants>
        </Section>
      ))}
    </Playground>
  );
}

function CustomRightAdornmentStory() {
  return (
    <Playground>
      <View className="flex w-72 flex-col" style={{ gap: 8 }}>
        <ActionRow
          title="Notifications"
          description="3 unread messages"
          leftAdornment={{ icon: Notification }}
          onPress={onPress}
        />
        <ActionRow title="Sign out" leftAdornment={{ icon: User }} rightAdornment={null} onPress={onPress} variant="outline" />
        <ActionRow
          title="Disabled action"
          description="This row cannot be pressed"
          leftAdornment={{ icon: User }}
          disabled={true}
          onPress={onPress}
        />
      </View>
      <View className="w-72 overflow-hidden rounded-[20px] bg-surface-2">
        <ActionRow
          testID="inset-profile-row"
          title="Profile"
          leftAdornment={{ icon: User }}
          separator="inset"
          className="min-h-12 rounded-none"
          onPress={onPress}
        />
        <ActionRow
          testID="inset-notification-row"
          title="Notifications"
          leftAdornment={{ icon: Notification }}
          className="min-h-12 rounded-none"
          onPress={onPress}
        />
      </View>
      <Note>
        The first row uses the default chevron. The second passes <Code>rightAdornment={'{null}'}</Code> to hide it. The third
        shows a disabled row — it dims and press is suppressed.
      </Note>
    </Playground>
  );
}

const meta = {
  title: 'Rows/ActionRow',
  component: ActionRow,
  parameters: { layout: 'centered' },
  args: { title: 'Profile settings', onPress },
} satisfies Meta<typeof ActionRow>;

type Story = StoryObj<typeof meta>;

export default meta;

/** Size, variant, adornments, disabled, and default-chevron toggle. */
export const Interactive: Story = {
  render: () => <ActionRowPlayground />,
};

/** Every variant at every size with default chevron and onPress. */
export const Showcase: Story = {
  name: 'Showcase: variants × sizes',
  render: () => <ShowcasePlayground />,
};

/** Override or suppress the default chevron with a custom right adornment. */
export const CustomRightAdornment: Story = {
  name: 'Custom right adornment',
  render: () => <CustomRightAdornmentStory />,
  play: async ({ canvas, userEvent }) => {
    const row = canvas.getByTestId('inset-profile-row');
    const separator = canvas.getByTestId('inset-profile-row-separator');
    const icon = row.querySelector('svg');
    if (!icon) throw new Error('Missing leading row icon');
    const rowBounds = row.getBoundingClientRect();
    const iconBounds = icon.getBoundingClientRect();
    expect(Math.abs(iconBounds.top + iconBounds.height / 2 - (rowBounds.top + rowBounds.height / 2))).toBeLessThan(1);
    expect(separator.getBoundingClientRect().left - row.getBoundingClientRect().left).toBe(12);
    expect(separator.getBoundingClientRect().right).toBe(row.getBoundingClientRect().right);
    expect(canvas.queryByTestId('inset-notification-row-separator')).toBeNull();
    await userEvent.click(row);
    expect(onPress).toHaveBeenCalled();
  },
};
