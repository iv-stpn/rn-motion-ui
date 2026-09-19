import type { Meta, StoryObj } from '@storybook/react';
import { expect, screen, userEvent, within } from 'storybook/test';
import { Playground, Section } from '../../../__stories__/story-harness';
import { Button } from '../../buttons/Button/button';
import { AdaptiveModal } from '../AdaptiveModal/adaptive-modal';
import { ModalPresenter, present } from './modal-presenter';

const meta = {
  title: 'Menus/ModalPresenter',
  component: ModalPresenter,
} satisfies Meta<typeof ModalPresenter>;

type Story = StoryObj<typeof meta>;

export default meta;

/** Queues two modals up front; each opens only after the previous fully closes. */
function ChainDemo() {
  const handleChain = () => {
    present('first', ({ open, close, done }) => (
      <AdaptiveModal open={open} onOpenChange={(next) => !next && close()} onAfterClose={done} title="First">
        <Button onPress={close} testID="first-done">
          Done
        </Button>
      </AdaptiveModal>
    ));
    present('second', ({ open, close, done }) => (
      <AdaptiveModal open={open} onOpenChange={(next) => !next && close()} onAfterClose={done} title="Second">
        <Button onPress={close} testID="second-done">
          Done
        </Button>
      </AdaptiveModal>
    ));
  };

  return (
    <Playground>
      <Section title="chained presentation">
        <Button onPress={handleChain}>Chain</Button>
      </Section>
    </Playground>
  );
}

/** Two `present()` calls queue in FIFO order: the first modal presents, and the
 *  second only presents once the first's `onAfterClose` has released its native
 *  Modal. Modal content mounts in a portal, so the play queries `screen`. */
export const Chained: Story = {
  render: () => (
    <>
      <ModalPresenter />
      <ChainDemo />
    </>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByText('Chain'));

    await expect(await screen.findByText('First')).toBeTruthy();
    await userEvent.click(await screen.findByTestId('first-done'));

    await expect(await screen.findByText('Second')).toBeTruthy();
    await userEvent.click(await screen.findByTestId('second-done'));
  },
};
