import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { View } from 'react-native';
import { expect, fn, userEvent, within } from 'storybook/test';
import { OTPInput, type OTPStatus } from './otp-input';

const CODE = '123456';

const meta = {
  title: 'Components/OtpInput',
  component: OTPInput,
  parameters: { layout: 'centered' },
  args: {
    label: 'Verification code',
    hint: `Enter ${CODE} to verify.`,
    onChange: fn(),
    onComplete: fn(),
  },
  argTypes: {
    status: { control: 'select', options: ['idle', 'error', 'success'] },
    length: { control: 'number' },
    mask: { control: 'boolean' },
  },
} satisfies Meta<typeof OTPInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const input = await canvas.findByRole('textbox');
    await userEvent.type(input, CODE);
    await expect(args.onChange).toHaveBeenCalled();
    await expect(args.onComplete).toHaveBeenCalledWith(CODE);
  },
};

export const Filled: Story = { args: { defaultValue: '1234', hint: 'Keep going.' } };
export const Masked: Story = { args: { defaultValue: '1234', mask: true } };
export const Success: Story = {
  args: { defaultValue: CODE, status: 'success', successMessage: 'Verified.' },
};
export const ErrorState: Story = {
  name: 'Error',
  args: { defaultValue: '000000', status: 'error', errorMessage: 'Wrong code, try again.' },
};
export const Disabled: Story = { args: { defaultValue: '12', disabled: true } };

export const Interactive: Story = {
  render: (args) => {
    const [value, setValue] = useState('');
    const [status, setStatus] = useState<OTPStatus>('idle');
    return (
      <View style={{ alignItems: 'center' }}>
        <OTPInput
          {...args}
          label="Verification code"
          hint={`Enter ${CODE} to verify.`}
          successMessage="Verified."
          errorMessage="Wrong code, try again."
          value={value}
          status={status}
          onChange={(v) => {
            setValue(v);
            if (status !== 'idle') setStatus('idle');
          }}
          onComplete={(v) => setStatus(v === CODE ? 'success' : 'error')}
        />
      </View>
    );
  },
};
