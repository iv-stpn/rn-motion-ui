import type { Meta, StoryObj } from '@storybook/react';
import { useCallback, useState } from 'react';
import { Modal, View } from 'react-native';
import { expect, screen, userEvent, waitFor, within } from 'storybook/test';
import { ELEVATION_KEYS, ELEVATIONS, type ElevationKey } from '../../../__stories__/story-elevations';
import { Action, Choice, ControlCard, Playground, Toggle, Variants } from '../../../__stories__/story-harness';
import { TriggerButton, TriggerControls, useTriggerState } from '../../../__stories__/story-trigger';
import { useMountEffect } from '../../../hooks/use-mount-effect';
import { ActionFeedbackModal, type ActionFeedbackState } from './action-feedback-modal';

const meta = {
  title: 'Menus/ActionFeedbackModal',
  component: ActionFeedbackModal,
  parameters: { layout: 'centered' },
  args: {
    open: false,
    state: 'loading',
    onOpenChange: () => undefined,
  },
  argTypes: {
    state: { control: 'select', options: ['loading', 'success', 'error'] },
  },
} satisfies Meta<typeof ActionFeedbackModal>;

type Story = StoryObj<typeof meta>;

const OPEN_LABEL = 'Show modal';

const OUTCOMES = ['success', 'error'] as const;
const RESOLVE_MS = 1800;

const COPY = {
  loadingMessage: 'Processing…',
  successLabel: 'Done!',
  successMessage: 'The operation completed successfully.',
  errorTitle: 'Operation failed',
  errorMessage: 'Something went wrong. Please try again.',
  dismissLabel: 'Dismiss',
} as const;

const TAGLINE = 'This may take a moment';
const RUN_LABEL = 'Run the action';

const ESCAPE_LABEL = 'Close';

type LoadingEscapeHatchProps = { onClose: () => void };

/**
 * Story-only escape hatch for a `loading` modal.
 *
 * `loading` is non-dismissible by design: the backdrop is disabled and
 * `OverlayShell` ignores request-close. In a story that resolves nothing, that
 * leaves the modal on screen forever — its full-screen backdrop covers the
 * canvas, so a button rendered next to the trigger would be painted under it
 * and unclickable. So the escape button gets its own `Modal`, stacked on top.
 *
 * Layering is DOM order: react-native-web portals each `Modal` into a fresh
 * `div` on `document.body`, and both roots are `position: fixed` siblings in
 * the root stacking context, so the one appended last paints on top. Mounting
 * is therefore deferred one frame — `ActionFeedbackModal`'s own portal is
 * created in `OverlayShell`'s post-effect render pass, and this one has to land
 * after it.
 *
 * Mount it only while loading (`visible && state === 'loading'`): its layer
 * swallows pointer events across the viewport, which is harmless while nothing
 * underneath is interactive but would eat the error state's backdrop tap.
 *
 * Story chrome, not a pattern to copy: a real caller resolves `loading` from
 * its own async work instead of stacking modals. Two simultaneous `Modal`s are
 * well-behaved on web and Android but can race iOS's presentation queue.
 */

function LoadingEscapeHatch({ onClose }: LoadingEscapeHatchProps) {
  const [mounted, setMounted] = useState(false);

  useMountEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(frame);
  });

  if (!mounted) return null;

  return (
    <Modal visible={true} transparent={true} animationType="none" statusBarTranslucent={true} onRequestClose={onClose}>
      <View className="flex-1 items-end p-4">
        <Action label={ESCAPE_LABEL} onPress={onClose} />
      </View>
    </Modal>
  );
}

function FeedbackPlayground() {
  const [visible, setVisible] = useState(false);
  const [state, setState] = useState<ActionFeedbackState>('loading');
  const [outcome, setOutcome] = useState<'success' | 'error'>('success');
  const [withText, setWithText] = useState(true);
  const [withTagline, setWithTagline] = useState(false);
  const [elevationKey, setElevationKey] = useState<ElevationKey>('6');
  const trigger = useTriggerState();

  // The real flow: open on `loading`, then resolve to the chosen outcome.
  const run = useCallback(() => {
    setState('loading');
    setVisible(true);
    setTimeout(() => setState(outcome), RESOLVE_MS);
  }, [outcome]);

  const jumpTo = useCallback((next: ActionFeedbackState) => {
    setState(next);
    setVisible(true);
  }, []);
  const showLoading = useCallback(() => jumpTo('loading'), [jumpTo]);
  const showSuccess = useCallback(() => jumpTo('success'), [jumpTo]);
  const showError = useCallback(() => jumpTo('error'), [jumpTo]);
  const handleClose = useCallback(() => setVisible(false), []);

  const text = withText ? COPY : {};

  return (
    <Playground>
      <ControlCard title="Overlay">
        <Choice label="Resolves to" onChange={setOutcome} options={OUTCOMES} value={outcome} />
        <Choice label="Elevation" onChange={setElevationKey} options={ELEVATION_KEYS} value={elevationKey} />
      </ControlCard>

      <ControlCard title="Optional text">
        <Toggle label="Message text" onChange={setWithText} value={withText} />
        <Toggle label="Tagline" onChange={setWithTagline} value={withTagline} />
      </ControlCard>

      <ControlCard title="Jump to">
        <Variants>
          <Action label="Loading" onPress={showLoading} />
          <Action label="Success" onPress={showSuccess} />
          <Action label="Error" onPress={showError} />
        </Variants>
      </ControlCard>

      <TriggerControls state={trigger} />

      <TriggerButton kind={trigger.kind} size={trigger.size} shape={trigger.shape} label={RUN_LABEL} onPress={run} />

      <ActionFeedbackModal
        elevation={ELEVATIONS[elevationKey]}
        onOpenChange={handleClose}
        state={state}
        tagline={withTagline ? TAGLINE : undefined}
        open={visible}
        {...text}
      />
      {visible && state === 'loading' ? <LoadingEscapeHatch onClose={handleClose} /> : null}
    </Playground>
  );
}

export default meta;

/**
 * Run the action to watch the vessel morph loading → success / error, or jump
 * straight to a state. Only the error state is dismissable; the loading state
 * gets a story-only Close button so jumping to it is not a dead end.
 */
export const Interactive: Story = {
  render: () => <FeedbackPlayground />,
};

/**
 * Spinner with an optional loading message. Nothing resolves this one, so it
 * carries the story-only Close button — see `LoadingEscapeHatch`.
 */
export const Loading: Story = {
  name: 'Demo: Loading state',
  render: () => {
    const [visible, setVisible] = useState(false);
    const handleOpen = useCallback(() => setVisible(true), []);
    const handleClose = useCallback(() => setVisible(false), []);
    return (
      <View>
        <TriggerButton label={OPEN_LABEL} onPress={handleOpen} />
        <ActionFeedbackModal
          open={visible}
          state="loading"
          loadingMessage="Saving changes…"
          tagline="This may take a moment"
          onOpenChange={handleClose}
        />
        {visible ? <LoadingEscapeHatch onClose={handleClose} /> : null}
      </View>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole('button', { name: OPEN_LABEL }));
    await expect(await screen.findByText('Saving changes…')).toBeTruthy();
    await expect(await screen.findByText('This may take a moment')).toBeTruthy();
    // The loading "icon" is the Loader's bouncing dots inside the morph vessel.
    // Each dot paints `muted-foreground`; if that token stays oklch,
    // react-native-web drops the inline backgroundColor and the dots vanish
    // against the card — so assert a dot actually paints a colour.
    const doc = canvasElement.ownerDocument;
    const win = doc.defaultView;
    if (!win) throw new Error('window unavailable');
    // The dots paint in after the modal portals; poll until one is actually
    // coloured instead of assuming a fixed settle delay is enough — under
    // parallel test load the render races the clock, so a 400 ms nap flakes.
    // The generous timeout (over the 1000 ms default) absorbs the same race.
    await waitFor(
      () => {
        const vessel = Array.from(doc.querySelectorAll('div')).find((d) =>
          (d.getAttribute('class') ?? '').includes('rounded-full'),
        );
        if (!vessel) throw new Error('morph vessel not found');
        const dotIsColoured = Array.from(vessel.querySelectorAll('div')).some(
          (d) => win.getComputedStyle(d).backgroundColor !== 'rgba(0, 0, 0, 0)',
        );
        expect(dotIsColoured).toBe(true);
      },
      { timeout: 3000 },
    );
    // The escape hatch must actually reach the user. Its layering is DOM order,
    // not z-index — both Modal roots are `position: fixed` siblings on
    // document.body — and `userEvent` dispatches straight at the node without
    // hit-testing, so a click alone would pass even with the button buried
    // under the loading backdrop. Assert the real paint order first.
    const closeButton = await screen.findByTestId('story-action-close');
    const box = closeButton.getBoundingClientRect();
    const topmost = doc.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
    // Name what actually paints there, so a regression reports the offending
    // layer instead of a bare `false`.
    const topmostLabel = topmost?.closest('[data-testid]')?.getAttribute('data-testid') ?? topmost?.className ?? 'nothing';
    await expect(topmostLabel).toBe('story-action-close');
    await userEvent.click(closeButton);
    await waitFor(() => expect(screen.queryByText('Saving changes…')).toBeNull());
  },
};

/** Success state — auto-closes after 2.5 s in the real component. */
export const Success: Story = {
  name: 'Demo: Success state',
  render: () => {
    const [visible, setVisible] = useState(false);
    const handleOpen = useCallback(() => setVisible(true), []);
    const handleClose = useCallback(() => setVisible(false), []);
    return (
      <View>
        <TriggerButton label={OPEN_LABEL} onPress={handleOpen} />
        <ActionFeedbackModal
          open={visible}
          state="success"
          successLabel="Changes saved!"
          successMessage="Your profile was updated."
          tagline="Closing automatically…"
          onOpenChange={handleClose}
        />
      </View>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole('button', { name: OPEN_LABEL }));
    await expect(await screen.findByText('Changes saved!')).toBeTruthy();
    // Let the morph vessel's backgroundColor animation (300 ms) settle.
    await new Promise((r) => setTimeout(r, 500));
    // The check glyph sits inside the morph vessel: svg → glyph wrapper → vessel.
    // The vessel must paint its success tint; if it stays transparent the white
    // glyph is invisible against the card — the bug this guards against (oklch
    // theme colours must be resolved to sRGB or Reanimated drops them).
    const doc = canvasElement.ownerDocument;
    const win = doc.defaultView;
    const svg = doc.querySelector('svg');
    const vessel = svg?.parentElement?.parentElement;
    if (!(win && vessel)) throw new Error('morph vessel not found');
    await expect(win.getComputedStyle(vessel).backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
  },
};

/** Error state — dismissable via button or backdrop tap. */
export const ErrorState: Story = {
  name: 'Demo: Error state',
  render: () => {
    const [visible, setVisible] = useState(false);
    const handleOpen = useCallback(() => setVisible(true), []);
    const handleClose = useCallback(() => setVisible(false), []);
    return (
      <View>
        <TriggerButton label={OPEN_LABEL} onPress={handleOpen} />
        <ActionFeedbackModal
          open={visible}
          state="error"
          errorTitle="Upload failed"
          errorMessage="The file could not be uploaded. Check your connection and try again."
          dismissLabel="Got it"
          onOpenChange={handleClose}
        />
      </View>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole('button', { name: OPEN_LABEL }));
    await expect(await screen.findByText('Upload failed')).toBeTruthy();
    await expect(await screen.findByRole('button', { name: 'Got it' })).toBeTruthy();
    await new Promise((r) => setTimeout(r, 500));
    // The X glyph sits inside the morph vessel (svg → glyph wrapper → vessel),
    // which must paint its danger tint or the white glyph vanishes against
    // the card. See the Success story for the full rationale.
    const doc = canvasElement.ownerDocument;
    const win = doc.defaultView;
    const svg = doc.querySelector('svg');
    const vessel = svg?.parentElement?.parentElement;
    if (!(win && vessel)) throw new Error('morph vessel not found');
    await expect(win.getComputedStyle(vessel).backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
  },
};

/**
 * Minimal variant — no optional text at all, so the morph icon is the only
 * content: the vessel resolves loading → success, then auto-closes.
 */
export const Minimal: Story = {
  name: 'Demo: No optional text',
  render: () => {
    const [visible, setVisible] = useState(false);
    const [state, setState] = useState<ActionFeedbackState>('loading');

    const handleOpen = useCallback(() => {
      setState('loading');
      setVisible(true);
      setTimeout(() => setState('success'), 1800);
    }, []);
    const handleClose = useCallback(() => setVisible(false), []);

    return (
      <View>
        <TriggerButton label={OPEN_LABEL} onPress={handleOpen} />
        <ActionFeedbackModal open={visible} state={state} onOpenChange={handleClose} />
      </View>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole('button', { name: OPEN_LABEL }));
    const doc = canvasElement.ownerDocument;
    // With no text props the state block would render as an empty flex child of
    // the `gap-4` column, adding a stray 16px gap under the icon. Assert no
    // childless content wrapper exists — in loading, and again after success.
    const strayGapWrapper = () =>
      Array.from(doc.querySelectorAll('div')).find(
        (d) => (d.getAttribute('class') ?? '').includes('gap-1.5') && d.childElementCount === 0,
      );
    await expect(strayGapWrapper()).toBeUndefined();
    await new Promise((r) => setTimeout(r, 2200));
    await expect(strayGapWrapper()).toBeUndefined();
  },
};
