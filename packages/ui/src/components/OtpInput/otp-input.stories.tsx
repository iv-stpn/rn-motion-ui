import type { Meta, StoryObj } from '@storybook/react';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
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

type Story = StoryObj<typeof meta>;

export default meta;

export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const input = await canvas.findByRole('textbox');
    await userEvent.type(input, CODE);
    await expect(args.onChange).toHaveBeenCalled();
    await expect(args.onComplete).toHaveBeenCalledWith(CODE);
  },
};

// Retyping a slot of an already-complete code keeps the value full-length while
// its content changes, so onComplete must re-fire to let the parent re-validate.
export const Retype: Story = {
  args: { defaultValue: '' },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const input = await canvas.findByRole('textbox');
    if (!(input instanceof HTMLInputElement)) throw new Error('expected an input element');
    await userEvent.type(input, CODE);
    await expect(args.onComplete).toHaveBeenLastCalledWith(CODE);
    // Retype a slot of the already-complete code: the value stays full-length
    // (6 -> 6) while its content changes, never dipping below `length`. Drive the
    // input event directly with the replacement — a faithful stand-in for
    // select-all + paste that dodges the harness collapsing programmatic
    // selections. Pre-fix onComplete only fired on the incomplete->complete
    // transition, so this edit was swallowed and the parent never re-validated.
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    setValue?.call(input, '923456');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await expect(args.onComplete).toHaveBeenLastCalledWith('923456');
  },
};

// Tapping any slot (not just the first empty one) moves the edit caret there, so
// a previous digit can be re-selected and overwritten in place.
export const ReselectCell: Story = {
  args: { defaultValue: CODE },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const input = await canvas.findByRole('textbox');
    if (!(input instanceof HTMLInputElement)) throw new Error('expected an input element');

    // Tap slot index 2 — the tap positions the edit anchor there and focuses.
    const slot = canvas.getByTestId('otp-input-slot-2');
    await userEvent.click(slot);
    await waitFor(() => expect(input.selectionStart).toBe(2));

    // Type a digit into the reselected cell. RNW's controlled caret is racy across
    // focus->render->layout-effect, so the real browser can leave the hidden DOM
    // caret at slot 3 and insert the digit ONE SLOT TOO FAR RIGHT: raw becomes
    // '1239456', not '1293456'. That drift is the bug the user hit — a plain diff
    // blames slot 3 and yields '123956' (the NEXT cell). We reproduce the drifted
    // raw here; the anchor (slot 2) must still land the digit in slot 2 -> '129456'.
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    setValue?.call(input, '1239456');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await expect(args.onComplete).toHaveBeenLastCalledWith('129456');
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
    const handleChange = useCallback(
      (v: string) => {
        setValue(v);
        if (status !== 'idle') setStatus('idle');
      },
      [status],
    );
    const handleComplete = useCallback((v: string) => setStatus(v === CODE ? 'success' : 'error'), []);
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
          onChange={handleChange}
          onComplete={handleComplete}
        />
      </View>
    );
  },
};
