// biome-ignore-all lint/style/noExcessiveLinesPerFile: stories + interaction tests for the press machine kept together for easy editing
import type { Meta, StoryObj } from '@storybook/react';
import { type ComponentProps, useCallback, useState } from 'react';
import { View } from 'react-native';
import { ArrowRightLine as ArrowRight } from 'rn-motion-ui-icons/icons/arrow-right-line';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import {
  Action,
  Choice,
  ControlCard,
  Note,
  Playground,
  Sample,
  Section,
  Toggle,
  Variants,
} from '../../../__stories__/story-harness';
import { useThemeColors } from '../../../theme/use-theme-color';
import { glossyContentColor } from './glossy-button';
import { StatefulButton } from './stateful-button';

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const meta = {
  title: 'Form/StatefulButton',
  component: StatefulButton,
  parameters: { layout: 'centered' },
  args: { children: 'Submit', onPress: fn(() => Promise.resolve()) },
  argTypes: {
    state: { control: 'select', options: ['idle', 'loading', 'success', 'error'] },
  },
} satisfies Meta<typeof StatefulButton>;

type Story = StoryObj<typeof meta>;

const CHIP_OPTIONS = ['none', 'elevated', 'glossy'] as const;
const STATES = ['idle', 'loading', 'success', 'error'] as const;
const OUTCOMES = ['success', 'error'] as const;
const CUSTOM_LABELS = {
  children: 'Upload',
  loadingText: 'Uploading…',
  successText: 'Uploaded!',
  errorText: 'Upload failed',
} as const;

// biome-ignore lint/style/useComponentExportOnlyModules: story helper
function StatefulButtonPlayground(args: ComponentProps<typeof StatefulButton>) {
  const colors = useThemeColors();
  const [chip, setChip] = useState<(typeof CHIP_OPTIONS)[number]>('none');
  const [withIcon, setWithIcon] = useState(false);
  const [shouldAutoReset, setShouldAutoReset] = useState(true);
  const [customLabels, setCustomLabels] = useState(false);
  const [outcome, setOutcome] = useState<(typeof OUTCOMES)[number]>('success');
  const [lastRun, setLastRun] = useState('Idle — press to run.');
  // `shouldReset` is edge-triggered, so the parent raises it and drops it again
  // on the next tick — that's what makes the button resettable more than once.
  const [resetSignal, setResetSignal] = useState(false);
  const requestReset = useCallback(() => {
    setResetSignal(true);
    setTimeout(() => setResetSignal(false), 0);
  }, []);

  // Rejecting drives the machine down its error path; resolving drives success.
  const handlePress = useCallback(async () => {
    setLastRun('Running…');
    await sleep(1200);
    if (outcome === 'error') throw new Error('Upload failed');
  }, [outcome]);
  const handleAfterSuccess = useCallback(() => setLastRun('Resolved → success window ended.'), []);
  const handleAfterError = useCallback((error: unknown) => setLastRun(`Rejected → ${String(error)}`), []);
  // Fires for either kind of reset — the auto one at the window end, or the
  // "Reset now" signal — appending to whatever the run last reported.
  const handleAfterReset = useCallback(() => setLastRun((prev) => `${prev} Re-armed.`), []);

  // Icon colour adapts to the active button style: glossy neutral keys use
  // `foreground`, flat/elevated primary buttons use `primary-foreground`.
  const iconColor = chip === 'glossy' ? glossyContentColor('neutral', colors) : colors['primary-foreground'];

  const shared = {
    ...args,
    ...(customLabels ? CUSTOM_LABELS : {}),
    chip: chip === 'none' ? undefined : chip,
    icon: withIcon ? <ArrowRight size={16} color={iconColor} /> : undefined,
  };

  return (
    <Playground>
      <ControlCard title="Options">
        <Choice label="Chip" onChange={setChip} options={CHIP_OPTIONS} value={chip} />
        <Choice label="Outcome" onChange={setOutcome} options={OUTCOMES} value={outcome} />
        <Toggle label="With icon" onChange={setWithIcon} value={withIcon} />
        <Toggle label="Auto reset" onChange={setShouldAutoReset} value={shouldAutoReset} />
        <Toggle label="Custom labels" onChange={setCustomLabels} value={customLabels} />
        <Action label="Reset now" onPress={requestReset} />
      </ControlCard>

      <Section title="Live — runs a 1.2 s action through the machine">
        <Variants align="center">
          <StatefulButton
            {...shared}
            afterError={handleAfterError}
            afterReset={handleAfterReset}
            afterSuccess={handleAfterSuccess}
            onPress={handlePress}
            shouldAutoReset={shouldAutoReset}
            shouldReset={resetSignal}
          />
          <Note testID="story-last-run">{lastRun}</Note>
        </Variants>
      </Section>

      <View className="h-3" />
      <Section title="Controlled — an explicit `state` bypasses the machine">
        <Variants align="center">
          {STATES.map((state) => (
            <Sample key={state} label={state}>
              <StatefulButton {...shared} state={state} />
            </Sample>
          ))}
        </Variants>
      </Section>
    </Playground>
  );
}

// Drives `shouldReset` from outside the button, the way a real consumer would:
// a sibling control raises the signal and drops it again on the next tick, so it
// can be raised more than once. Used by the external-reset stories below.
// biome-ignore lint/style/useComponentExportOnlyModules: story helper
function ExternalResetHarness(args: ComponentProps<typeof StatefulButton>) {
  const [resetSignal, setResetSignal] = useState(false);
  const requestReset = useCallback(() => {
    setResetSignal(true);
    setTimeout(() => setResetSignal(false), 0);
  }, []);
  return (
    <Variants align="center">
      <StatefulButton {...args} shouldReset={resetSignal} />
      <Action label="Reset now" onPress={requestReset} />
    </Variants>
  );
}

export default meta;

/** Live machine on top (press it), every controlled state below. The toggles
 *  swap the glossy key or the elevated chip in, add the trailing idle icon,
 *  re-arm the button after its terminal window, and rename each state's label;
 *  `Outcome` picks whether the run resolves or rejects. */
export const Interactive: Story = {
  render: (args) => <StatefulButtonPlayground {...args} />,
};

export const RunToSuccess: Story = {
  name: 'Demo: Run to success',
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const button = await canvas.findByRole('button');
    await userEvent.click(button);
    await expect(args.onPress).toHaveBeenCalled();
  },
};

/** Full machine run: press → action → success window → afterSuccess, with the
 *  button held disabled the whole way so the action can't be double-fired. */
export const MachineSuccess: Story = {
  name: 'Demo: Success machine',
  args: {
    onPress: fn(() => Promise.resolve()),
    afterSuccess: fn(),
    minLoadingMs: 50,
    successDurationMs: 100,
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const button = await canvas.findByRole('button');
    await userEvent.click(button);
    await expect(args.onPress).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(args.afterSuccess).toHaveBeenCalledTimes(1));
    // Terminal hold: still disabled after the window — RNW also renders
    // pointer-events:none, so the action can't be double-fired.
    await expect(button).toHaveAttribute('aria-disabled', 'true');
    await expect(args.onPress).toHaveBeenCalledTimes(1);
  },
};

/** Rejection path: afterError receives the rejection, then `shouldAutoReset`
 *  re-arms the button at the end of the error window so a second press runs the
 *  action again. */
export const MachineError: Story = {
  name: 'Demo: Error then retry',
  args: {
    onPress: fn(() => Promise.reject(new Error('nope'))),
    afterError: fn(),
    afterReset: fn(),
    minLoadingMs: 50,
    errorDurationMs: 100,
    shouldAutoReset: true,
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const button = await canvas.findByRole('button');
    await userEvent.click(button);
    await waitFor(() => expect(args.afterError).toHaveBeenCalledTimes(1));
    await expect(args.afterError).toHaveBeenCalledWith(expect.any(Error));
    // The auto-reset re-arms the button and announces it: RNW drops aria-disabled
    // once re-enabled, and afterReset fires after afterError.
    await waitFor(() => expect(args.afterReset).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(button).not.toHaveAttribute('aria-disabled', 'true'));
    await userEvent.click(button);
    await expect(args.onPress).toHaveBeenCalledTimes(2);
  },
};

/** Default (`shouldAutoReset` omitted): the run holds its terminal state
 *  disabled and `afterReset` never fires. Pins that the auto-reset is opt-in. */
export const NoAutoResetByDefault: Story = {
  name: 'Demo: Holds terminal state by default',
  args: {
    onPress: fn(() => Promise.resolve()),
    afterSuccess: fn(),
    afterReset: fn(),
    minLoadingMs: 50,
    successDurationMs: 100,
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const button = await canvas.findByRole('button');
    await userEvent.click(button);
    await waitFor(() => expect(args.afterSuccess).toHaveBeenCalledTimes(1));
    // Window is over; with no auto-reset the button stays held and silent.
    await expect(button).toHaveAttribute('aria-disabled', 'true');
    await expect(args.afterReset).not.toHaveBeenCalled();
  },
};

/** `shouldReset` raised from outside: with `shouldAutoReset` off the button holds
 *  its success, and the parent's signal is what re-arms it — releasing the hold
 *  mid-way, firing `afterReset`, and letting the action run a second time. */
export const ExternalReset: Story = {
  name: 'Demo: External reset releases the hold',
  args: {
    onPress: fn(() => Promise.resolve()),
    afterSuccess: fn(),
    afterReset: fn(),
    minLoadingMs: 50,
    successDurationMs: 100,
  },
  render: (args) => <ExternalResetHarness {...args} />,
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const button = await canvas.findByTestId('button');
    const resetControl = await canvas.findByTestId('story-action-reset-now');

    // Raising the signal on an idle button with nothing in flight is a no-op:
    // there is no state to unwind, so it does not announce a reset that didn't
    // happen.
    await userEvent.click(resetControl);
    await expect(args.afterReset).not.toHaveBeenCalled();

    // Run to success. shouldAutoReset defaults to false, so the button holds
    // there, disabled, and afterReset has nothing to announce yet.
    await userEvent.click(button);
    await waitFor(() => expect(args.afterSuccess).toHaveBeenCalledTimes(1));
    await expect(button).toHaveAttribute('aria-disabled', 'true');
    await expect(args.afterReset).not.toHaveBeenCalled();

    // The parent raises shouldReset: the button returns to idle, re-enables, and
    // announces the reset.
    await userEvent.click(resetControl);
    await waitFor(() => expect(args.afterReset).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(button).not.toHaveAttribute('aria-disabled', 'true'));

    // Re-armed for real: the action runs again.
    await userEvent.click(button);
    await expect(args.onPress).toHaveBeenCalledTimes(2);
  },
};

/** Raising `shouldReset` mid-flight resets instantly — it does not wait for the
 *  pending action. The orphaned promise must not then push the button into
 *  success behind the reset. */
export const ResetMidFlight: Story = {
  name: 'Demo: External reset mid-flight',
  args: {
    onPress: fn(() => sleep(300)),
    afterSuccess: fn(),
    afterReset: fn(),
    minLoadingMs: 50,
    successDurationMs: 100,
  },
  render: (args) => <ExternalResetHarness {...args} />,
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const button = await canvas.findByTestId('button');
    const resetControl = await canvas.findByTestId('story-action-reset-now');

    await userEvent.click(button);
    await waitFor(() => expect(args.onPress).toHaveBeenCalledTimes(1));

    // Reset while the action is still pending: idle and pressable immediately,
    // rather than after the loader's minimum or the success window.
    await userEvent.click(resetControl);
    await waitFor(() => expect(args.afterReset).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(button).not.toHaveAttribute('aria-disabled', 'true'));
    // Back to the idle label. TextSlot paints it twice (the in-flow sizer plus the
    // animated overlay), so this is an -All- query by construction.
    await expect(canvas.getAllByText('Submit').length).toBeGreaterThan(0);

    // Let the orphaned promise settle well past both windows: it stays orphaned,
    // so no success state and no afterSuccess.
    await new Promise((resolve) => setTimeout(resolve, 500));
    await expect(args.afterSuccess).not.toHaveBeenCalled();
    await expect(button).not.toHaveAttribute('aria-disabled', 'true');
  },
};

/** `shouldReset` is edge-triggered, so a parent that leaves it pinned `true`
 *  doesn't pin the button to idle: the run after that still reaches success. A
 *  level-triggered reset would wipe the state the moment the machine left idle. */
export const HeldResetSignal: Story = {
  name: 'Demo: Held reset signal still allows a run',
  args: {
    shouldReset: true,
    shouldAutoReset: true,
    onPress: fn(() => Promise.resolve()),
    afterSuccess: fn(),
    afterReset: fn(),
    minLoadingMs: 50,
    successDurationMs: 100,
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const button = await canvas.findByTestId('button');

    // Mounted with the signal already true: that's not a rising edge, so nothing
    // was reset and the button is a normal idle button.
    await expect(args.afterReset).not.toHaveBeenCalled();

    // The signal stays true for the whole run, which still completes: loading,
    // success window, afterSuccess, then the auto reset back to idle.
    await userEvent.click(button);
    await waitFor(() => expect(args.afterSuccess).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(args.afterReset).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(button).not.toHaveAttribute('aria-disabled', 'true'));
  },
};

/** Glossy key through the full success machine: the key switches from the
 *  translucent neutral glass to the vivid green `success` chip on resolve,
 *  holding its dome, rim and coloured cast rather than overlaying a flat plate. */
export const GlossyMachineSuccess: Story = {
  name: 'Demo: Glossy success machine',
  args: {
    chip: 'glossy' as const,
    onPress: fn(() => Promise.resolve()),
    afterSuccess: fn(),
    minLoadingMs: 50,
    successDurationMs: 100,
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const button = await canvas.findByRole('button');
    await userEvent.click(button);
    await expect(args.onPress).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(args.afterSuccess).toHaveBeenCalledTimes(1));
    await expect(button).toHaveAttribute('aria-disabled', 'true');
    await expect(args.onPress).toHaveBeenCalledTimes(1);
  },
};
