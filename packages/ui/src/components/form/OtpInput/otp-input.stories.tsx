import type { Meta, StoryObj } from '@storybook/react';
import { type ComponentProps, useCallback, useRef, useState } from 'react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { Choice, ControlCard, Playground, Sample, Section, Toggle, Variants } from '../../../__stories__/story-harness';
import { OTPInput, type OtpInputRef, type OtpInputStatus } from './otp-input';

const CODE = '123456';

const meta = {
  title: 'Form/OtpInput',
  component: OTPInput,
  parameters: { layout: 'centered' },
  args: {
    label: 'Verification code',
    hint: `Enter ${CODE} to verify.`,
    onTextChange: fn(),
    onFilled: fn(),
  },
  argTypes: {
    status: { control: 'select', options: ['idle', 'error', 'success'] },
    numberOfDigits: { control: 'number' },
    secureTextEntry: { control: 'boolean' },
    type: { control: 'select', options: ['alpha', 'numeric', 'alphanumeric'] },
  },
} satisfies Meta<typeof OTPInput>;

type Story = StoryObj<typeof meta>;

const LENGTHS = ['4', '6'] as const;
const SUCCESS_MESSAGE = 'Verified.';
const ERROR_MESSAGE = 'Wrong code, try again.';

function OtpPlayground(args: ComponentProps<typeof OTPInput>) {
  const [lengthKey, setLengthKey] = useState<(typeof LENGTHS)[number]>('6');
  const [secureTextEntry, setSecureTextEntry] = useState(false);
  const [disabled, setDisabled] = useState(false);
  const [value, setValue] = useState('');
  const [status, setStatus] = useState<OtpInputStatus>('idle');
  const ref = useRef<OtpInputRef>(null);

  const numberOfDigits = Number(lengthKey);
  const expected = CODE.slice(0, numberOfDigits);

  // Editing after a verdict clears it, so the shake/check can be re-triggered
  // without reloading the story.
  const handleChange = useCallback(
    (next: string) => {
      setValue(next);
      setStatus('idle');
      args.onTextChange?.(next);
    },
    [args.onTextChange],
  );

  const handleFilled = useCallback(
    (next: string) => {
      setStatus(next === expected ? 'success' : 'error');
      args.onFilled?.(next);
    },
    [expected, args.onFilled],
  );

  const handleLength = useCallback((next: (typeof LENGTHS)[number]) => {
    setLengthKey(next);
    setValue('');
    setStatus('idle');
  }, []);

  return (
    <Playground>
      <ControlCard title="Input options">
        <Choice label="Number of digits" onChange={handleLength} options={LENGTHS} value={lengthKey} />
      </ControlCard>
      <ControlCard title="Options">
        <Toggle label="Mask (secureTextEntry)" onChange={setSecureTextEntry} value={secureTextEntry} />
        <Toggle label="Disabled" onChange={setDisabled} value={disabled} />
      </ControlCard>

      <OTPInput
        {...args}
        ref={ref}
        disabled={disabled}
        errorMessage={ERROR_MESSAGE}
        hint={`Enter ${expected} to verify.`}
        numberOfDigits={numberOfDigits}
        secureTextEntry={secureTextEntry}
        onTextChange={handleChange}
        onFilled={handleFilled}
        status={status}
        successMessage={SUCCESS_MESSAGE}
        value={value}
      />

      {/* The states below are `status`-driven and read-only — a real form would set
          `status` from its own validation, which is what the live field above does. */}
      <Section title="States">
        <Variants direction="column">
          <Sample label="partially filled">
            <OTPInput {...args} defaultValue="123" hint="Keep going." />
          </Sample>
          <Sample label="masked">
            <OTPInput {...args} defaultValue="1234" hint="Digits are hidden." secureTextEntry={true} />
          </Sample>
          <Sample label="success">
            <OTPInput {...args} defaultValue={CODE} status="success" successMessage={SUCCESS_MESSAGE} />
          </Sample>
          <Sample label="error">
            <OTPInput {...args} defaultValue="000000" errorMessage={ERROR_MESSAGE} status="error" />
          </Sample>
          <Sample label="disabled">
            <OTPInput {...args} defaultValue="12" disabled={true} hint="Locked while we re-send." />
          </Sample>
          <Sample label="four digits">
            <OTPInput {...args} hint="Shorter codes just take a lower `numberOfDigits`." numberOfDigits={4} />
          </Sample>
          <Sample label="with placeholder">
            <OTPInput {...args} hint="Placeholder shown in empty slots." placeholder="0" />
          </Sample>
          <Sample label="focus color">
            <OTPInput {...args} defaultValue="12" focusColor="#6366f1" hint="Indigo focus ring." />
          </Sample>
          <Sample label="alpha type">
            <OTPInput {...args} type="alpha" hint="Only letters accepted." placeholder="A" />
          </Sample>
        </Variants>
      </Section>
    </Playground>
  );
}

export default meta;

/** Type into the live field — matching the hint verifies (check drawn), anything
 *  else shakes. The rows below hold the states a parent sets via `status`. */
export const Interactive: Story = { render: (args) => <OtpPlayground {...args} /> };

export const Default: Story = {
  name: 'Demo: Type a code',
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const input = await canvas.findByRole('textbox');
    await userEvent.type(input, CODE);
    await expect(args.onTextChange).toHaveBeenCalled();
    await expect(args.onFilled).toHaveBeenCalledWith(CODE);
  },
};

// Retyping a slot of an already-complete code keeps the value full-length while
// its content changes, so onFilled must re-fire to let the parent re-validate.
export const Retype: Story = {
  name: 'Demo: Overwrite a digit',
  args: { defaultValue: '' },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const input = await canvas.findByRole('textbox');
    if (!(input instanceof HTMLInputElement)) throw new Error('expected an input element');
    await userEvent.type(input, CODE);
    await expect(args.onFilled).toHaveBeenLastCalledWith(CODE);
    // Retype a slot of the already-complete code: the value stays full-length
    // (6 -> 6) while its content changes, never dipping below `numberOfDigits`. Drive
    // the input event directly with the replacement — a faithful stand-in for
    // select-all + paste that dodges the harness collapsing programmatic
    // selections.
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    setValue?.call(input, '923456');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await expect(args.onFilled).toHaveBeenLastCalledWith('923456');
  },
};

// Tapping any slot (not just the first empty one) moves the edit caret there, so
// a previous digit can be re-selected and overwritten in place.
export const ReselectCell: Story = {
  name: 'Demo: Tap to reselect',
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
    await expect(args.onFilled).toHaveBeenLastCalledWith('129456');
  },
};
