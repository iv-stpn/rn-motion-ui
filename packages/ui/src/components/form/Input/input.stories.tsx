import type { Meta, StoryObj } from '@storybook/react';
import { type ComponentProps, useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';
import { EyeCloseLine as EyeOff } from 'rn-motion-ui-icons/icons/eye-close-line';
import { EyeLine as Eye } from 'rn-motion-ui-icons/icons/eye-line';
import { MailLine as Mail } from 'rn-motion-ui-icons/icons/mail-line';
import { SearchLine as Search } from 'rn-motion-ui-icons/icons/search-line';
import { expect, fn, userEvent, within } from 'storybook/test';
import { Choice, ControlCard, Playground, Sample, Section, Toggle, Variants } from '../../../__stories__/story-harness';
import { useThemeColors } from '../../../theme/use-theme-color';
import { Input } from './input';

const meta = {
  title: 'Form/Input',
  component: Input,
  parameters: { layout: 'centered' },
  args: { label: 'Email', placeholder: 'you@example.com', onChange: fn() },
  argTypes: {
    size: { control: 'select', options: ['sm', 'md', 'lg'] },
    variant: { control: 'select', options: ['surface', 'filled'] },
    shape: { control: 'select', options: ['rounded', 'pill'] },
  },
} satisfies Meta<typeof Input>;

type Story = StoryObj<typeof meta>;

const SIZES = ['sm', 'md', 'lg'] as const;
const SHAPES = ['rounded', 'pill'] as const;
const VARIANTS = ['surface', 'filled'] as const;
const STATES = ['default', 'error', 'success', 'disabled'] as const;
const EMAIL_ERROR = 'Enter a valid email address.';

type FieldState = (typeof STATES)[number];
type RevealButtonProps = { shown: boolean; onToggle: () => void; color: string };

// Reveal toggle for the password sample — its own component so `onPress` stays stable.
// biome-ignore lint/style/useComponentExportOnlyModules: story helper
function RevealButton({ shown, onToggle, color }: RevealButtonProps) {
  return (
    <Pressable accessibilityLabel={shown ? 'Hide password' : 'Show password'} accessibilityRole="button" onPress={onToggle}>
      {shown ? <EyeOff color={color} size={16} /> : <Eye color={color} size={16} />}
    </Pressable>
  );
}

// biome-ignore lint/style/useComponentExportOnlyModules: story helper
function InputPlayground(args: ComponentProps<typeof Input>) {
  const [size, setSize] = useState<(typeof SIZES)[number]>('md');
  const [shape, setShape] = useState<(typeof SHAPES)[number]>('rounded');
  const [variant, setVariant] = useState<(typeof VARIANTS)[number]>('surface');
  const [state, setState] = useState<FieldState>('default');
  const [leftIcon, setLeftIcon] = useState(true);
  const [hint, setHint] = useState(false);
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
        <Choice label="Variant" onChange={setVariant} options={VARIANTS} value={variant} />
        <Choice label="State" onChange={setState} options={STATES} value={state} />
        <Toggle label="Left icon" onChange={setLeftIcon} value={leftIcon} />
        <Toggle label="Hint" onChange={setHint} value={hint} />
      </ControlCard>

      <Input
        {...args}
        disabled={state === 'disabled'}
        error={state === 'error' ? EMAIL_ERROR : typedError}
        hint={hint ? 'We only use this to sign you in.' : undefined}
        inputType="email"
        label="Email"
        leftIcon={leftIcon ? <Mail color={icon} size={16} /> : undefined}
        onChange={setEmail}
        shape={shape}
        size={size}
        success={state === 'success'}
        variant={variant}
        value={email}
      />

      <View className="h-3" />
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
          <Sample label="pill shape">
            <Input {...args} label="Search" leftIcon={<Search color={icon} size={16} />} shape="pill" />
          </Sample>
          <Sample label="multiline">
            <Input {...args} label="Notes" multiline={true} placeholder="Anything else?" />
          </Sample>
        </Variants>
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
