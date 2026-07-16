import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { expect, fn, userEvent, within } from 'storybook/test';
import { Eye, EyeOff, Mail, Search } from '../../lib/icons';
import { Input } from './input';

const meta = {
  title: 'Components/Input',
  component: Input,
  parameters: { layout: 'centered' },
  args: { label: 'Email', placeholder: 'you@example.com', onChange: fn() },
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const input = await canvas.findByRole('textbox');
    await userEvent.type(input, 'ada');
    await expect(args.onChange).toHaveBeenCalled();
  },
};

export const WithLeftIcon: Story = {
  args: { label: 'Email', leftIcon: <Mail size={16} color="#737373" /> },
};

export const ErrorState: Story = {
  name: 'Error',
  args: {
    label: 'Email',
    value: 'not-an-email',
    error: 'Enter a valid email address.',
    leftIcon: <Mail size={16} color="#737373" />,
  },
};

export const Success: Story = {
  args: {
    label: 'Search',
    value: 'Ada',
    success: true,
    leftIcon: <Search size={16} color="#737373" />,
  },
};

export const Disabled: Story = { args: { label: 'Email', value: 'you@example.com', disabled: true } };

export const Interactive: Story = {
  render: (args) => {
    const [email, setEmail] = useState('');
    const [pass, setPass] = useState('hunter2');
    const [query, setQuery] = useState('Ada');
    const [show, setShow] = useState(false);
    const emailError = email.length > 0 && !email.includes('@') ? 'Enter a valid email address.' : undefined;

    return (
      <View style={{ gap: 20, width: 288 }}>
        <Input
          {...args}
          label="Email"
          keyboardType="email-address"
          autoCapitalize="none"
          placeholder="you@example.com"
          leftIcon={<Mail size={16} color="#737373" />}
          value={email}
          onChange={setEmail}
          error={emailError}
        />
        <Input
          {...args}
          label="Password"
          secureTextEntry={!show}
          value={pass}
          onChange={setPass}
          rightIcon={
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={show ? 'Hide password' : 'Show password'}
              onPress={() => setShow((s) => !s)}
            >
              {show ? <EyeOff size={16} color="#737373" /> : <Eye size={16} color="#737373" />}
            </Pressable>
          }
        />
        <Input
          {...args}
          label="Search"
          leftIcon={<Search size={16} color="#737373" />}
          value={query}
          onChange={setQuery}
          success={query.length > 1}
        />
      </View>
    );
  },
};
