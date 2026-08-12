import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { View } from 'react-native';
import { NotificationLine as Notification } from 'rn-motion-ui-icons/icons/notification-line';
import { Settings4Line as Settings } from 'rn-motion-ui-icons/icons/settings-4-line';
import { User2Line as User } from 'rn-motion-ui-icons/icons/user-2-line';
import { fn } from 'storybook/test';
import { Choice, ControlCard, Note, Playground, Sample, Section, Toggle, Variants } from '../../__stories__/story-harness';
import { Switch } from '../form/Switch/switch';
import type { ItemRowSize } from './item-row';
import { ItemRowGroup, type ItemRowGroupItem } from './item-row-group';
import type { RowGroupVariant } from './row-group';

const SIZES: ItemRowSize[] = ['sm', 'md', 'lg'];
const VARIANTS: RowGroupVariant[] = ['grouped', 'spaced', 'sections'];

function ItemRowGroupPlayground() {
  const [variant, setVariant] = useState<RowGroupVariant>('grouped');
  const [size, setSize] = useState<ItemRowSize>('md');
  const [wifiOn, setWifiOn] = useState(true);
  const [btOn, setBtOn] = useState(false);
  const [showDescriptions, setShowDescriptions] = useState(true);

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
      description: showDescriptions ? 'Connected to Home Network' : undefined,
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
      <ControlCard title="Options">
        <Choice label="Variant" options={VARIANTS} value={variant} onChange={setVariant} />
        <Choice label="Size" options={SIZES} value={size} onChange={setSize} />
        <Toggle label="Descriptions" value={showDescriptions} onChange={setShowDescriptions} />
      </ControlCard>
      <View className="w-80">
        <ItemRowGroup variant={variant} size={size} items={items} />
      </View>
      <Note>
        <code>grouped</code>: flush rows with dividers in a bordered container. <code>spaced</code>: rows separated by a
        size-dependent gap. <code>sections</code>: padded card with separator lines between rows.
      </Note>
    </Playground>
  );
}

function ShowcasePlayground() {
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
      rightAdornment: <Switch isSelected={true} onSelectedChange={fn()} />,
    },
    {
      id: 'bluetooth',
      title: 'Bluetooth',
      leftAdornment: { icon: User },
      rightAdornment: <Switch isSelected={false} onSelectedChange={fn()} />,
    },
  ];

  return (
    <Playground>
      {VARIANTS.map((variant) => (
        <Section key={variant} title={`Variant: ${variant}`}>
          <Variants direction="row" align="stretch">
            {SIZES.map((size) => (
              <Sample key={size} label={`${size}`}>
                <View className="w-56">
                  <ItemRowGroup variant={variant} size={size} items={items} />
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
  title: 'Rows/ItemRowGroup',
  component: ItemRowGroup,
  parameters: { layout: 'centered' },
  args: { items: [{ id: 'test', title: 'Test' }] },
} satisfies Meta<typeof ItemRowGroup>;

type Story = StoryObj<typeof meta>;

export default meta;

/** Toggle between grouped, spaced, and sections variants, change the size, and flip descriptions on/off. */
export const Interactive: Story = {
  render: () => <ItemRowGroupPlayground />,
};

/** Every variant at every size. */
export const Showcase: Story = {
  name: 'Showcase: variants × sizes',
  render: () => <ShowcasePlayground />,
};
