import type { Meta, StoryObj } from '@storybook/react';
import { type ComponentProps, useCallback, useState } from 'react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { Choice, ControlCard, Playground, Sample, Section, Toggle, Variants } from '../../../__stories__/story-harness';
import { OTPInput, type OTPStatus } from './otp-input';

const CODE = '123456';

const meta = {
  title: 'Form/OtpInput',
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

const LENGTHS = ['4', '6'] as const;
const SUCCESS_MESSAGE = 'Verified.';
const ERROR_MESSAGE = 'Wrong code, try again.';

// biome-ignore lint/style/useComponentExportOnlyModules: story helper
function OtpPlayground(args: ComponentProps<typeof OTPInput>) {
  const [lengthKey, setLengthKey] = useState<(typeof LENGTHS)[number]>('6');
  const [mask, setMask] = useState(false);
  const [disabled, setDisabled] = useState(false);
  const [value, setValue] = useState('');
  const [status, setStatus] = useState<OTPStatus>('idle');

  const length = Number(lengthKey);
  const expected = CODE.slice(0, length);

  // Editing after a verdict clears it, so the shake/check can be re-triggered
  // without reloading the story.
  const handleChange = useCallback(
    (next: string) => {
      setValue(next);
      setStatus('idle');
      args.onChange?.(next);
    },
    [args.onChange],
  );

  const handleComplete = useCallback(
    (next: string) => {
      setStatus(next === expected ? 'success' : 'error');
      args.onComplete?.(next);
    },
    [expected, args.onComplete],
  );

  const handleLength = useCallback((next: (typeof LENGTHS)[number]) => {
    setLengthKey(next);
    setValue('');
    setStatus('idle');
  }, []);

  return (
    <Playground>
      <ControlCard title="Input options">
        <Choice label="Length" onChange={handleLength} options={LENGTHS} value={lengthKey} />
      </ControlCard>
      <ControlCard title="Options">
        <Toggle label="Mask" onChange={setMask} value={mask} />
        <Toggle label="Disabled" onChange={setDisabled} value={disabled} />
      </ControlCard>

      <OTPInput
        {...args}
        disabled={disabled}
        errorMessage={ERROR_MESSAGE}
        hint={`Enter ${expected} to verify.`}
        length={length}
        mask={mask}
        onChange={handleChange}
        onComplete={handleComplete}
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
            <OTPInput {...args} defaultValue="1234" hint="Digits are hidden." mask={true} />
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
          <Sample label="four slots">
            <OTPInput {...args} hint="Shorter codes just take a lower `length`." length={4} />
          </Sample>
        </Variants>
      </Section>
    </Playground>
  );
}

export default meta;

/** Type into the live field — matching the hint verifies (check draw), anything
 *  else shakes. The rows below hold the states a parent sets via `status`. */
export const Interactive: Story = { render: (args) => <OtpPlayground {...args} /> };

export const Default: Story = {
  name: 'Demo: Type a code',
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
  name: 'Demo: Overwrite a digit',
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
    await expect(args.onComplete).toHaveBeenLastCalledWith('129456');
  },
};
