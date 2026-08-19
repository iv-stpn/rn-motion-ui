import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { View } from 'react-native';
import { User2Line as User } from 'rn-motion-ui-icons/icons/user-2-line';
import { fn } from 'storybook/test';
import { Choice, ControlCard, Note, Playground, Sample, Section, Toggle, Variants } from '../../__stories__/story-harness';
import { Button } from '../form/Button/button';
import { Switch } from '../form/Switch/switch';
import { ItemRow, type ItemRowAdornment, type ItemRowSize, type ItemRowVariant } from './item-row';

const onPress = fn();

const OPEN_LABEL = 'Open';

const SIZES: ItemRowSize[] = ['sm', 'md', 'lg'];
const VARIANTS: ItemRowVariant[] = ['default', 'outline', 'muted'];

/** Use-case mode: the trailing control is the action, not the whole row. */
type ModeKey = 'button' | 'switch';

const MODES = ['button', 'switch'] as const satisfies readonly ModeKey[];

const MODE_NOTES: Record<ModeKey, string> = {
  button: 'The row is static — the trailing button is the action.',
  switch: 'The row is static — the trailing switch is the action.',
};

/** Right adornment per mode: a Button or a Switch. */
function rightAdornmentFor(
  mode: ModeKey,
  switched: boolean,
  setSwitched: (next: boolean) => void,
  disabled: boolean,
): ItemRowAdornment {
  switch (mode) {
    case 'button':
      return (
        <Button size="sm" variant="inverse" onPress={onPress} disabled={disabled}>
          {OPEN_LABEL}
        </Button>
      );
    case 'switch':
      return <Switch isSelected={switched} onSelectedChange={setSwitched} isDisabled={disabled} />;
    default:
      return mode satisfies never;
  }
}

function ItemRowPlayground() {
  const [disabled, setDisabled] = useState(false);
  const [showDescription, setShowDescription] = useState(true);
  const [showLeft, setShowLeft] = useState(true);
  const [switched, setSwitched] = useState(false);
  const [size, setSize] = useState<ItemRowSize>('md');
  const [variant, setVariant] = useState<ItemRowVariant>('default');
  const [mode, setMode] = useState<ModeKey>('button');

  return (
    <Playground>
      <ControlCard title="Options">
        <Choice label="Mode" options={MODES} value={mode} onChange={setMode} />
        <Choice label="Size" options={SIZES} value={size} onChange={setSize} />
        <Choice label="Variant" options={VARIANTS} value={variant} onChange={setVariant} />
        <Toggle label="Description" value={showDescription} onChange={setShowDescription} />
        <Toggle label="Left icon" value={showLeft} onChange={setShowLeft} />
        <Toggle label="Disabled" value={disabled} onChange={setDisabled} />
      </ControlCard>
      <View className="w-72">
        <ItemRow
          title="Profile settings"
          description={showDescription ? 'Manage your account and preferences' : undefined}
          leftAdornment={showLeft ? { icon: User } : undefined}
          rightAdornment={rightAdornmentFor(mode, switched, setSwitched, disabled)}
          size={size}
          variant={variant}
          disabled={disabled}
        />
      </View>
      <Note>{MODE_NOTES[mode]}</Note>
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
                  <ItemRow
                    title="Profile settings"
                    description="Manage your account"
                    leftAdornment={{ icon: User }}
                    rightAdornment={
                      <Button size="sm" variant="inverse" onPress={onPress}>
                        {OPEN_LABEL}
                      </Button>
                    }
                    size={s}
                    variant={v}
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

const meta = {
  title: 'Rows/ItemRow',
  component: ItemRow,
  parameters: { layout: 'centered' },
  args: { title: 'Profile settings' },
} satisfies Meta<typeof ItemRow>;

type Story = StoryObj<typeof meta>;

export default meta;

/** Mode (button / switch), size, variant, adornments, and disabled state. */
export const Interactive: Story = {
  render: () => <ItemRowPlayground />,
};

/** Every variant at every size — static rows with a trailing button. */
export const Showcase: Story = {
  name: 'Showcase: variants × sizes',
  render: () => <ShowcasePlayground />,
};
