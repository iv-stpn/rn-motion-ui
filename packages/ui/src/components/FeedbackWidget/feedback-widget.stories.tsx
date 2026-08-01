import type { Meta, StoryObj } from '@storybook/react';
import { type ReactNode, useRef, useState } from 'react';
import { View } from 'react-native';
import { expect, screen, userEvent, within } from 'storybook/test';
import { ELEVATION_KEYS, ELEVATIONS, type ElevationKey } from '../../__stories__/story-elevations';
import { Choice, ControlCard, Section, Toggle } from '../../__stories__/story-harness';
import { Text } from '../Text/text';
import { FeedbackWidget } from './feedback-widget';

const meta = {
  title: 'Components/FeedbackWidget',
  component: FeedbackWidget,
  parameters: { layout: 'fullscreen' },
  args: { position: 'bottom-right' },
} satisfies Meta<typeof FeedbackWidget>;

type Story = StoryObj<typeof meta>;

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Always resolves — submitting shows the success view. */
function useSuccessSubmit() {
  return async () => {
    await delay(600);
  };
}

/** Rejects the first attempt, then resolves — submit shows the error view with
 *  a working "Try again" that recovers into the success view. */
function useFailThenRecoverSubmit() {
  const attempts = useRef(0);
  return async () => {
    await delay(600);
    attempts.current += 1;
    if (attempts.current === 1) throw new Error('Simulated failure');
  };
}

type AppSurfaceProps = { children: ReactNode; hint: string };

/** Faux app surface so the floating triggers have context. */
// biome-ignore lint/style/useComponentExportOnlyModules: story helper
function AppSurface({ children, hint }: AppSurfaceProps) {
  return (
    <View className="min-h-[380px] flex-1 bg-surface-1">
      <View className="border-border border-b px-5 py-3">
        <View className="h-2.5 w-24 rounded-full bg-muted-foreground/20" />
      </View>
      <View className="gap-3 p-5">
        <View className="h-2.5 w-3/4 rounded-full bg-muted-foreground/15" />
        <View className="h-2.5 w-1/2 rounded-full bg-muted-foreground/15" />
        <View className="h-20 w-full rounded-2xl bg-muted-foreground/[0.06]" />
        <Text className="text-muted-foreground text-sm">{hint}</Text>
      </View>
      {children}
    </View>
  );
}

const POSITIONS = [
  { value: 'bottom-right', label: 'Bottom right' },
  { value: 'bottom-left', label: 'Bottom left' },
] as const;
type Position = (typeof POSITIONS)[number]['value'];

const OUTCOMES = [
  { value: 'success', label: 'Succeeds' },
  { value: 'fail', label: 'Fails then recovers' },
] as const;
type Outcome = (typeof OUTCOMES)[number]['value'];

const CUSTOM_COPY = { placeholder: 'What could work better?', title: 'Report a bug' } as const;
const PLAYGROUND_HINT =
  'Set the corner, the submit outcome and the panel copy, then tap the message icon to open the panel and send feedback.';

/** Manual playground: pick the submit outcome, then drive the widget yourself.
 *  No `play` function, so nothing auto-clicks — open the trigger, type, submit,
 *  and (on failure) tap Try again to see the recovery. */
// biome-ignore lint/style/useComponentExportOnlyModules: story helper
function FeedbackPlayground() {
  const [position, setPosition] = useState<Position>('bottom-right');
  const [outcome, setOutcome] = useState<Outcome>('success');
  const [elevationKey, setElevationKey] = useState<ElevationKey>('5');
  const [customCopy, setCustomCopy] = useState(false);
  const success = useSuccessSubmit();
  const failThenRecover = useFailThenRecoverSubmit();
  const onSubmit = outcome === 'fail' ? failThenRecover : success;
  const copy = customCopy ? CUSTOM_COPY : {};

  return (
    <AppSurface hint={PLAYGROUND_HINT}>
      <View className="gap-3 px-5">
        <ControlCard title="Options">
          <Choice label="Corner" onChange={setPosition} options={POSITIONS} value={position} />
          <Choice label="Submit" onChange={setOutcome} options={OUTCOMES} value={outcome} />
          <Toggle label="Custom copy" onChange={setCustomCopy} value={customCopy} />
        </ControlCard>
        <Section title="Elevation">
          <View className="items-start">
            <Choice onChange={setElevationKey} options={ELEVATION_KEYS} value={elevationKey} />
          </View>
        </Section>
      </View>
      <FeedbackWidget
        elevation={ELEVATIONS[elevationKey]}
        onSubmit={onSubmit}
        position={position}
        testID="feedback-widget"
        {...copy}
      />
    </AppSurface>
  );
}

export default meta;

/** Both corners, both submit outcomes, every elevation and the copy overrides in one canvas. */
export const Interactive: Story = { render: () => <FeedbackPlayground /> };

/**
 * Two live widgets: the bottom-right one submits successfully, the bottom-left
 * one fails the first attempt then recovers on retry. Open either, type a
 * message and submit to watch the real success / error / recovery flow.
 */
export const Default: Story = {
  name: 'Demo: Submit feedback',
  render: () => {
    const success = useSuccessSubmit();
    const failThenRecover = useFailThenRecoverSubmit();
    return (
      <AppSurface hint="Bottom-right submits successfully. Bottom-left fails once, then recovers on Try again.">
        <FeedbackWidget position="bottom-right" onSubmit={success} testID="feedback-success" />
        <FeedbackWidget position="bottom-left" onSubmit={failThenRecover} testID="feedback-fail" />
      </AppSurface>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // ── Success widget (bottom-right, first in DOM) ──
    const [successTrigger] = await canvas.findAllByTestId('feedback-trigger');
    if (!successTrigger) throw new Error('feedback-trigger not found');
    await userEvent.click(successTrigger);
    await expect(await screen.findByText('Help us improve')).toBeTruthy();
    const input = await screen.findByTestId('feedback-input');
    await userEvent.type(input, 'Love the animations!');
    await userEvent.click(await screen.findByText('Submit'));
    // Success view appears
    await expect(await screen.findByText('Thanks!')).toBeTruthy();
  },
};

/**
 * Failure → recovery in isolation: the first submit fails and surfaces the
 * error view; tapping "Try again" retries and succeeds.
 */
export const ErrorRecovery: Story = {
  name: 'Demo: Error then recover',
  render: () => {
    const failThenRecover = useFailThenRecoverSubmit();
    return (
      <AppSurface hint="Submit fails the first time — tap Try again to recover.">
        <FeedbackWidget onSubmit={failThenRecover} testID="feedback-widget" />
      </AppSurface>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByTestId('feedback-trigger'));
    await expect(await screen.findByText('Help us improve')).toBeTruthy();
    const input = await screen.findByTestId('feedback-input');
    await userEvent.type(input, 'Test error recovery');
    await userEvent.click(await screen.findByText('Submit'));
    // First attempt fails → error view + retry
    await expect(await screen.findByText('Something went wrong')).toBeTruthy();
    await userEvent.click(await screen.findByText('Try again'));
    // Retry succeeds → success view
    await expect(await screen.findByText('Thanks!')).toBeTruthy();
  },
};
