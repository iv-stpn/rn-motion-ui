import type { Meta, StoryObj } from '@storybook/react';
import { type ComponentProps, useCallback, useState } from 'react';
import { View } from 'react-native';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { Choice, Controls, Note, Playground, Sample, Section, Toggle, Variants } from '../../__stories__/story-harness';
import { ArrowRight } from '../../lib/icons';
import { useThemeColors } from '../../theme/use-theme-color';
import { glossyContentColor } from './glossy-button';
import { StatefulButton } from './stateful-button';

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const meta = {
  title: 'Components/StatefulButton',
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
  const [autoReset, setAutoReset] = useState(true);
  const [customLabels, setCustomLabels] = useState(false);
  const [outcome, setOutcome] = useState<(typeof OUTCOMES)[number]>('success');
  const [lastRun, setLastRun] = useState('Idle — press to run.');

  // Rejecting drives the machine down its error path; resolving drives success.
  const handlePress = useCallback(async () => {
    setLastRun('Running…');
    await sleep(1200);
    if (outcome === 'error') throw new Error('Upload failed');
  }, [outcome]);
  const handleAfterSuccess = useCallback(() => setLastRun('Resolved → success window ended.'), []);
  const handleAfterError = useCallback((error: unknown) => setLastRun(`Rejected → ${String(error)}`), []);

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
      <Controls>
        <Choice label="Chip" onChange={setChip} options={CHIP_OPTIONS} value={chip} />
        <Toggle label="With icon" onChange={setWithIcon} value={withIcon} />
        <Toggle label="Auto reset" onChange={setAutoReset} value={autoReset} />
        <Toggle label="Custom labels" onChange={setCustomLabels} value={customLabels} />
        <Choice label="Outcome" onChange={setOutcome} options={OUTCOMES} value={outcome} />
      </Controls>

      <Section title="Live — runs a 1.2 s action through the machine">
        <Variants align="center">
          <StatefulButton
            {...shared}
            afterError={handleAfterError}
            afterSuccess={handleAfterSuccess}
            autoReset={autoReset}
            onPress={handlePress}
          />
          <Note testID="story-last-run">{lastRun}</Note>
        </Variants>
      </Section>

      <View style={{ height: 12 }} />
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

/** Rejection path: afterError receives the rejection, then autoReset re-arms
 *  the button so a second press runs the action again. */
export const MachineError: Story = {
  name: 'Demo: Error then retry',
  args: {
    onPress: fn(() => Promise.reject(new Error('nope'))),
    afterError: fn(),
    minLoadingMs: 50,
    errorDurationMs: 100,
    autoReset: true,
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const button = await canvas.findByRole('button');
    await userEvent.click(button);
    await waitFor(() => expect(args.afterError).toHaveBeenCalledTimes(1));
    await expect(args.afterError).toHaveBeenCalledWith(expect.any(Error));
    // autoReset re-arms the button: RNW drops aria-disabled once re-enabled.
    await waitFor(() => expect(button).not.toHaveAttribute('aria-disabled', 'true'));
    await userEvent.click(button);
    await expect(args.onPress).toHaveBeenCalledTimes(2);
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
