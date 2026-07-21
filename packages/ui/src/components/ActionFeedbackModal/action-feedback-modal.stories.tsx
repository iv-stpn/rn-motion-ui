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
