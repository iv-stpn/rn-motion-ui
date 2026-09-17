import type { Meta, StoryObj } from '@storybook/react';
import { type ComponentProps, useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';
import { EyeCloseLine as EyeOff } from 'rn-motion-ui-icons/icons/eye-close-line';
import { EyeLine as Eye } from 'rn-motion-ui-icons/icons/eye-line';
import { MailLine as Mail } from 'rn-motion-ui-icons/icons/mail-line';
import { SearchLine as Search } from 'rn-motion-ui-icons/icons/search-line';
import { expect, fn, userEvent, within } from 'storybook/test';
import { ELEVATION_KEYS, ELEVATIONS, type ElevationKey } from '../../../__stories__/story-elevations';
import { Choice, ControlCard, Playground, Sample, Section, Toggle, Variants } from '../../../__stories__/story-harness';
import { SURFACE_LEVELS } from '../../../lib/elevated';
import { useThemeColors } from '../../../theme/use-theme-color';
import { Input } from './input';

const meta = {
  title: 'Form/Input',
  component: Input,
  parameters: { layout: 'centered' },
  args: { label: 'Email', placeholder: 'you@example.com', onChange: fn(), elevation: 0, floating: false },
  argTypes: {
    size: { control: 'select', options: ['sm', 'md', 'lg'] },
    elevation: { control: { type: 'range', min: 0, max: 8, step: 1 } },
    floating: { control: 'boolean' },
    shape: { control: 'select', options: ['square', 'rounded', 'pill', 'circle'] },
  },
} satisfies Meta<typeof Input>;

type Story = StoryObj<typeof meta>;

const SIZES = ['sm', 'md', 'lg'] as const;
const SHAPES = ['square', 'rounded', 'pill', 'circle'] as const;
const STATES = ['default', 'error', 'success', 'disabled'] as const;
const EMAIL_ERROR = 'Enter a valid email address.';

type FieldState = (typeof STATES)[number];
type RevealButtonProps = { shown: boolean; onToggle: () => void; color: string };

// Reveal toggle for the password sample — its own component so `onPress` stays stable.

function RevealButton({ shown, onToggle, color }: RevealButtonProps) {
  return (
    <Pressable accessibilityLabel={shown ? 'Hide password' : 'Show password'} accessibilityRole="button" onPress={onToggle}>
      {shown ? <EyeOff color={color} size={16} /> : <Eye color={color} size={16} />}
    </Pressable>
  );
}

type FrostedFieldProps = { shape: (typeof SHAPES)[number]; label: string };
function FrostedField({ shape, label }: FrostedFieldProps) {
  return (
    <View className="relative w-full overflow-hidden p-2">
      <View
        className="absolute"
        style={{ top: 0, left: 0, width: 56, height: 56, borderRadius: 28, backgroundColor: '#3b82f6' }}
      />
      <View
        className="absolute"
        style={{ right: 0, bottom: 0, width: 64, height: 64, borderRadius: 32, backgroundColor: '#ec4899' }}
      />
      <Input blurRadius={24} label={label} opacity={0.5} rim={true} shape={shape} />
    </View>
  );
}

function InputPlayground(args: ComponentProps<typeof Input>) {
  const [size, setSize] = useState<(typeof SIZES)[number]>('md');
  const [shape, setShape] = useState<(typeof SHAPES)[number]>('rounded');
  const [elevationKey, setElevationKey] = useState<ElevationKey>('0');
  const [floating, setFloating] = useState(false);
  const [state, setState] = useState<FieldState>('default');
  const [leftIcon, setLeftIcon] = useState(true);
  const [hint, setHint] = useState(false);
  const [glass, setGlass] = useState(false);
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('hunter2');
  const [shown, setShown] = useState(false);

  const colors = useThemeColors();
  const icon = colors['muted-foreground'];
  const toggleShown = useCallback(() => setShown((s) => !s), []);

  // A typed value without an `@` reports the error regardless of the State chip,
  // so the shake + error ring can be reached by typing as well as by switching.
  const typedError = email.length > 0 && !email.includes('@') ? EMAIL_ERROR : undefined;

  return (
    <Playground>
      <ControlCard title="Options">
        <Choice label="Size" onChange={setSize} options={SIZES} value={size} />
        <Choice label="Shape" onChange={setShape} options={SHAPES} value={shape} />
        <Toggle label="Floating" onChange={setFloating} value={floating} />
        <Choice label="Elevation" onChange={setElevationKey} options={ELEVATION_KEYS} value={elevationKey} />
        <Choice label="State" onChange={setState} options={STATES} value={state} />
        <Toggle label="Left icon" onChange={setLeftIcon} value={leftIcon} />
        <Toggle label="Hint" onChange={setHint} value={hint} />
        <Toggle label="Glass" onChange={setGlass} value={glass} />
      </ControlCard>

      <View className="relative w-full overflow-hidden p-2">
        {/* Coloured shapes sit behind the field so the frosted glass has a
            backdrop to blur when the Glass toggle is on. */}
        {glass ? (
          <>
            <View
              className="absolute"
              style={{ top: 0, left: 0, width: 56, height: 56, borderRadius: 28, backgroundColor: '#3b82f6' }}
            />
            <View
              className="absolute"
              style={{ right: 0, bottom: 0, width: 64, height: 64, borderRadius: 32, backgroundColor: '#ec4899' }}
            />
            <View
              className="absolute"
              style={{ top: 8, left: 64, width: 40, height: 40, borderRadius: 20, backgroundColor: '#f59e0b' }}
            />
          </>
        ) : null}
        <Input
          {...args}
          blurRadius={glass ? 24 : 0}
          disabled={state === 'disabled'}
          elevation={ELEVATIONS[elevationKey]}
          error={state === 'error' ? EMAIL_ERROR : typedError}
          floating={floating}
          hint={hint ? 'We only use this to sign you in.' : undefined}
          inputType="email"
          label="Email"
          leftIcon={leftIcon ? <Mail color={icon} size={16} /> : undefined}
          onChange={setEmail}
          opacity={glass ? 0.5 : 1}
          rim={glass}
          shape={shape}
          size={size}
          success={state === 'success'}
          value={email}
        />
      </View>

      <View className="h-3" />
      {/* The field reads its fill and float off the same ladder every other
          surface uses, so the rungs are best compared as a stack. `0` — the
          default — is the flat resting field; `floating` swaps whichever rung's
          shadow for the diffuse halo, which is why the toggle stays live here. */}
      <Section title="Elevation ladder">
        <View className="gap-4">
          <Input {...args} elevation={0} floating={floating} label="Flat (0)" shape={shape} size={size} />
          {SURFACE_LEVELS.map((level) => (
            <Input
              {...args}
              elevation={level}
              floating={floating}
              key={level}
              label={`Elevation ${level}`}
              shape={shape}
              size={size}
            />
          ))}
        </View>
      </Section>

      <Section title="States">
        <Variants direction="column">
          <Sample label="error">
            <Input {...args} error={EMAIL_ERROR} label="Email" value="not-an-email" />
          </Sample>
          <Sample label="success">
            <Input {...args} label="Search" leftIcon={<Search color={icon} size={16} />} success={true} value="Ada" />
          </Sample>
          <Sample label="disabled">
            <Input {...args} disabled={true} label="Email" value="you@example.com" />
          </Sample>
          <Sample label="secure entry with a reveal toggle">
            <Input
              {...args}
              label="Password"
              onChange={setPass}
              rightIcon={<RevealButton color={icon} onToggle={toggleShown} shown={shown} />}
              secureTextEntry={!shown}
              value={pass}
            />
          </Sample>
          <Sample label="multiline">
            <Input {...args} label="Notes" multiline={true} placeholder="Anything else?" />
          </Sample>
        </Variants>
      </Section>

      <Section title="Shapes">
        <View className="gap-4">
          {SHAPES.map((name) => (
            <Input {...args} key={name} label={name} shape={name} />
          ))}
        </View>
      </Section>

      {/* The glass treatment — `blurRadius` frosts the backdrop behind the field,
          `opacity` thins the tint and `rim` layers the specular edge light, the
          same trio the Card / Button / Surface stories expose. */}
      <Section title="Glass">
        <View className="gap-4">
          <FrostedField label="Frosted rounded" shape="rounded" />
          <FrostedField label="Frosted pill" shape="pill" />
        </View>
      </Section>

      <Section title="Sizes">
        <View className="gap-4">
          {SIZES.map((name) => (
            <Input {...args} key={name} label={name} size={name} />
          ))}
        </View>
      </Section>
    </Playground>
  );
}

export default meta;

/** Type in the live field (a value without `@` trips the error shake), or switch
 *  the State chip to jump straight to error / success / disabled. */
export const Interactive: Story = {
  render: (args) => <InputPlayground {...args} />,
};

export const Default: Story = {
  name: 'Demo: Type an email',
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const input = await canvas.findByRole('textbox');
    await userEvent.type(input, 'ada');
    await expect(args.onChange).toHaveBeenCalled();
  },
};
