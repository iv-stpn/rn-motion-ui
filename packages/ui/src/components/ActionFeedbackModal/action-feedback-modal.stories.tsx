import type { Meta, StoryObj } from '@storybook/react';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { expect, screen, userEvent, within } from 'storybook/test';
import { Button } from '../Button/button';
import { ActionFeedbackModal, type ActionFeedbackState } from './action-feedback-modal';

const meta = {
  title: 'Components/ActionFeedbackModal',
  component: ActionFeedbackModal,
  parameters: { layout: 'centered' },
  args: {
    visible: false,
    state: 'loading',
    onClose: () => undefined,
  },
  argTypes: {
    state: { control: 'select', options: ['loading', 'success', 'error'] },
  },
} satisfies Meta<typeof ActionFeedbackModal>;

type Story = StoryObj<typeof meta>;

const OPEN_LABEL = 'Show modal';
const SIMULATE_SUCCESS_LABEL = 'Simulate success';
const SIMULATE_ERROR_LABEL = 'Simulate error';

// Matches a CSS `matrix(...)` / `matrix3d(...)` transform so we can pull the
// translateY term (2D: parts[5]; 3D: parts[13]) off a Reanimated-animated dot.
const TRANSFORM_MATRIX = /matrix(?:3d)?\(([^)]+)\)/;
const translateYOf = (el: Element, win: Window & typeof globalThis): number => {
  const t = win.getComputedStyle(el).transform;
  if (!t || t === 'none') return 0;
  const m = t.match(TRANSFORM_MATRIX);
  if (!m || m[1] === undefined) return 0;
  const parts = m[1].split(',').map((n) => Number.parseFloat(n.trim()));
  const ty = parts.length === 16 ? parts[13] : parts[5];
  return ty ?? 0;
};

export default meta;

/** Spinner with an optional loading message. */
export const Loading: Story = {
  render: () => {
    const [visible, setVisible] = useState(false);
    const handleOpen = useCallback(() => setVisible(true), []);
    const handleClose = useCallback(() => setVisible(false), []);
    return (
      <View>
        <Button onPress={handleOpen}>{OPEN_LABEL}</Button>
        <ActionFeedbackModal
          visible={visible}
          state="loading"
          loadingMessage="Saving changes…"
          tagline="This may take a moment"
          onClose={handleClose}
        />
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
    await new Promise((r) => setTimeout(r, 400));
    const doc = canvasElement.ownerDocument;
    const win = doc.defaultView;
    if (!win) throw new Error('window unavailable');
    const vessel = Array.from(doc.querySelectorAll('div')).find((d) => (d.getAttribute('class') ?? '').includes('rounded-full'));
    if (!vessel) throw new Error('morph vessel not found');
    const dotIsColoured = Array.from(vessel.querySelectorAll('div')).some(
      (d) => win.getComputedStyle(d).backgroundColor !== 'rgba(0, 0, 0, 0)',
    );
    await expect(dotIsColoured).toBe(true);
  },
};

/** Success state — auto-closes after 2.5 s in the real component. */
export const Success: Story = {
  render: () => {
    const [visible, setVisible] = useState(false);
    const handleOpen = useCallback(() => setVisible(true), []);
    const handleClose = useCallback(() => setVisible(false), []);
    return (
      <View>
        <Button onPress={handleOpen}>{OPEN_LABEL}</Button>
        <ActionFeedbackModal
          visible={visible}
          state="success"
          successLabel="Changes saved!"
          successMessage="Your profile was updated."
          tagline="Closing automatically…"
          onClose={handleClose}
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
  render: () => {
    const [visible, setVisible] = useState(false);
    const handleOpen = useCallback(() => setVisible(true), []);
    const handleClose = useCallback(() => setVisible(false), []);
    return (
      <View>
        <Button onPress={handleOpen}>{OPEN_LABEL}</Button>
        <ActionFeedbackModal
          visible={visible}
          state="error"
          errorTitle="Upload failed"
          errorMessage="The file could not be uploaded. Check your connection and try again."
          dismissLabel="Got it"
          onClose={handleClose}
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
    // which must paint its destructive tint or the white glyph vanishes against
    // the card. See the Success story for the full rationale.
    const doc = canvasElement.ownerDocument;
    const win = doc.defaultView;
    const svg = doc.querySelector('svg');
    const vessel = svg?.parentElement?.parentElement;
    if (!(win && vessel)) throw new Error('morph vessel not found');
    await expect(win.getComputedStyle(vessel).backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
  },
};

/** Interactive demo: trigger loading → success / error transitions. */
export const Interactive: Story = {
  render: () => {
    const [visible, setVisible] = useState(false);
    const [state, setState] = useState<ActionFeedbackState>('loading');

    const trigger = useCallback((outcome: 'success' | 'error') => {
      setState('loading');
      setVisible(true);
      setTimeout(() => setState(outcome), 1800);
    }, []);

    const handleSuccess = useCallback(() => trigger('success'), [trigger]);
    const handleError = useCallback(() => trigger('error'), [trigger]);
    const handleClose = useCallback(() => setVisible(false), []);

    return (
      <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}>
        <Button onPress={handleSuccess}>{SIMULATE_SUCCESS_LABEL}</Button>
        <Button variant="secondary" onPress={handleError}>
          {SIMULATE_ERROR_LABEL}
        </Button>
        <ActionFeedbackModal
          visible={visible}
          state={state}
          loadingMessage="Processing…"
          successLabel="Done!"
          successMessage="The operation completed successfully."
          errorTitle="Operation failed"
          errorMessage="Something went wrong. Please try again."
          dismissLabel="Dismiss"
          onClose={handleClose}
        />
      </View>
    );
  },
};

/** Loading state — asserts the dots loader keeps cycling, not just one bounce. */
export const LoadingLoops: Story = {
  render: () => {
    const [visible, setVisible] = useState(false);
    const handleOpen = useCallback(() => setVisible(true), []);
    const handleClose = useCallback(() => setVisible(false), []);
    return (
      <View>
        <Button onPress={handleOpen}>{OPEN_LABEL}</Button>
        <ActionFeedbackModal visible={visible} state="loading" loadingMessage="Saving changes…" onClose={handleClose} />
      </View>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole('button', { name: OPEN_LABEL }));
    const doc = canvasElement.ownerDocument;
    const win = doc.defaultView;
    if (!win) throw new Error('window unavailable');

    // Find a bouncing dot inside the morph vessel: a descendant div whose
    // computed transform is a non-zero translateY matrix.
    const findDot = (): Element | null => {
      const vessel = Array.from(doc.querySelectorAll('div')).find((d) =>
        (d.getAttribute('class') ?? '').includes('rounded-full'),
      );
      if (!vessel) return null;
      return Array.from(vessel.querySelectorAll('div')).find((d) => translateYOf(d, win) !== 0) ?? null;
    };

    // Wait for the entrance + first bounce to start.
    await new Promise((r) => setTimeout(r, 600));
    let dot = findDot();
    for (let i = 0; i < 10 && !dot; i += 1) {
      await new Promise((r) => setTimeout(r, 100));
      dot = findDot();
    }
    if (!dot) throw new Error('animated dot not found');

    // Sample translateY for ~3 s while forcing re-renders (theme-class toggles
    // on <html>). Each toggle re-renders the Loader/MorphIcon (useThemeColor(s)
    // subscribe to the class) and churns the MorphIcon <AnimatePresence> presence
    // context, which used to make the dots' loop rebuild and freeze at the
    // translateY target after one cycle. The loader must keep cycling across
    // these re-renders — the tail samples must still show full-amplitude motion.
    const toggleTheme = () => doc.documentElement.classList.toggle('dark');
    const samples: number[] = [];
    for (let ms = 0; ms <= 3000; ms += 250) {
      samples.push(translateYOf(dot, win));
      toggleTheme();
      await new Promise((r) => setTimeout(r, 250));
    }
    const range = (xs: number[]) => Math.max(...xs) - Math.min(...xs);
    // Full bounce amplitude is ~size*0.3 (≈8px); require clearly-non-frozen
    // motion (>5px) both overall and in the final second (tail).
    await expect(range(samples)).toBeGreaterThan(5);
    await expect(range(samples.slice(-5))).toBeGreaterThan(5);
  },
};

/** Minimal variant — no optional text, just the icon + default labels. */
export const Minimal: Story = {
  render: () => {
    const [visible, setVisible] = useState(false);
    const handleOpen = useCallback(() => setVisible(true), []);
    const handleClose = useCallback(() => setVisible(false), []);
    return (
      <View>
        <Button onPress={handleOpen}>{OPEN_LABEL}</Button>
        <ActionFeedbackModal visible={visible} state="loading" onClose={handleClose} />
      </View>
    );
  },
};
