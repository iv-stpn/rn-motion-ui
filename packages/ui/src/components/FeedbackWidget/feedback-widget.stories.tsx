import type { Meta, StoryObj } from '@storybook/react';
import { type ReactNode, useCallback, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { expect, screen, userEvent, within } from 'storybook/test';
import { Button } from '../Button/button';
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

/** Faux app surface so the floating triggers have context. */
// biome-ignore lint/style/useComponentExportOnlyModules: story helper
function AppSurface({ children, hint }: { children: ReactNode; hint: string }) {
  return (
    <View className="flex-1 bg-surface" style={{ minHeight: 380 }}>
      <View className="border-border border-b px-5 py-3">
        <View className="h-2.5 w-24 rounded-full bg-muted-foreground/20" />
      </View>
      <View style={{ gap: 12, padding: 20 }}>
        <View className="h-2.5 w-3/4 rounded-full bg-muted-foreground/15" />
        <View className="h-2.5 w-1/2 rounded-full bg-muted-foreground/15" />
        <View className="h-20 w-full rounded-xl bg-muted-foreground/[0.06]" />
        <Text className="text-muted-foreground text-sm">{hint}</Text>
      </View>
      {children}
    </View>
  );
}

type InteractiveOutcome = 'success' | 'fail';
const SUCCEEDS_LABEL = 'Succeeds';
const FAILS_LABEL = 'Fails then recovers';

/** Manual playground: pick the submit outcome, then drive the widget yourself.
 *  No `play` function, so nothing auto-clicks — open the trigger, type, submit,
 *  and (on failure) tap Try again to see the recovery. */
// biome-ignore lint/style/useComponentExportOnlyModules: story helper
function InteractiveDemo() {
  const [outcome, setOutcome] = useState<InteractiveOutcome>('success');
  const selectSuccess = useCallback(() => setOutcome('success'), []);
  const selectFail = useCallback(() => setOutcome('fail'), []);
  const success = useSuccessSubmit();
  const failThenRecover = useFailThenRecoverSubmit();
  const onSubmit = outcome === 'fail' ? failThenRecover : success;

  return (
    <AppSurface hint="Pick a submit outcome, then tap the message icon in the corner to open the panel and send feedback.">
      <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingTop: 8 }}>
        <Button size="sm" variant={outcome === 'success' ? 'primary' : 'secondary'} onPress={selectSuccess}>
          {SUCCEEDS_LABEL}
        </Button>
        <Button size="sm" variant={outcome === 'fail' ? 'primary' : 'secondary'} onPress={selectFail}>
          {FAILS_LABEL}
        </Button>
      </View>
      <FeedbackWidget position="bottom-right" onSubmit={onSubmit} testID="feedback-widget" />
    </AppSurface>
  );
}

export default meta;

/**
 * Two live widgets: the bottom-right one submits successfully, the bottom-left
 * one fails the first attempt then recovers on retry. Open either, type a
 * message and submit to watch the real success / error / recovery flow.
 */
export const Default: Story = {
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

export const BottomLeft: Story = {
  render: () => {
    const success = useSuccessSubmit();
    return (
      <AppSurface hint="Press the message icon in the corner to open the feedback panel.">
        <FeedbackWidget position="bottom-left" onSubmit={success} testID="feedback-widget" />
      </AppSurface>
    );
  },
};

export const Interactive: Story = {
  render: () => <InteractiveDemo />,
};
