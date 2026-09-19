import type { Meta, StoryObj } from '@storybook/react';
import { View } from 'react-native';
import { expect, fn, screen, userEvent } from 'storybook/test';
import { Playground, Section } from '../../../__stories__/story-harness';
import { Text } from '../../typography/Text/text';
import { Spotlight, type SpotlightStep } from './spotlight';
import { SpotlightTarget } from './spotlight-target';

/** A two-step tour over one highlighted element. */
const STEPS = [
  { id: 'welcome', target: 'tour-target', title: 'Welcome', body: 'This is the first stop.' },
  { id: 'done', target: 'tour-target', title: 'All set', body: 'You finished the tour.' },
] satisfies readonly SpotlightStep[];

const meta = {
  title: 'Display/Spotlight',
  component: Spotlight,
  args: { steps: STEPS, onComplete: fn(), onSkip: fn(), onStepChange: fn() },
} satisfies Meta<typeof Spotlight>;

type Story = StoryObj<typeof meta>;

export default meta;

/** The step-by-step tour: dim + hole, a tooltip, and Back/Skip/Next controls that
 *  walk the steps and fire `onComplete` on the last Next. Modal content mounts in
 *  a portal, so the play queries the whole document rather than the canvas. */
export const Tour: Story = {
  render: ({ onComplete, onSkip, onStepChange }) => (
    <Playground>
      <Section title="spotlight tour">
        <SpotlightTarget testID="tour-target">
          <View className="h-14 w-48 items-center justify-center rounded-xl bg-surface-3">
            <Text size="sm">Highlighted element</Text>
          </View>
        </SpotlightTarget>
        <Spotlight
          defaultOpen={true}
          steps={STEPS}
          onComplete={onComplete}
          onSkip={onSkip}
          onStepChange={onStepChange}
          testID="spotlight"
        />
      </Section>
    </Playground>
  ),
  play: async ({ args }) => {
    await expect(await screen.findByText('Welcome')).toBeTruthy();

    await userEvent.click(await screen.findByTestId('spotlight-next'));
    await expect(await screen.findByText('All set')).toBeTruthy();
    await expect(args.onStepChange).toHaveBeenCalledWith(1);

    // The final step's Next is the Done control.
    await userEvent.click(await screen.findByTestId('spotlight-next'));
    await expect(args.onComplete).toHaveBeenCalled();
  },
};

/** Dismissing via Skip closes the tour and fires `onSkip` rather than `onComplete`. */
export const Skip: Story = {
  render: ({ onComplete, onSkip }) => (
    <Playground>
      <Section title="spotlight skip">
        <SpotlightTarget testID="skip-target">
          <View className="h-14 w-48 items-center justify-center rounded-xl bg-surface-3">
            <Text size="sm">Skip me</Text>
          </View>
        </SpotlightTarget>
        <Spotlight
          defaultOpen={true}
          steps={[{ id: 'only', target: 'skip-target', title: 'One step' }]}
          onComplete={onComplete}
          onSkip={onSkip}
          testID="spotlight"
        />
      </Section>
    </Playground>
  ),
  play: async ({ args }) => {
    await userEvent.click(await screen.findByTestId('spotlight-skip'));
    await expect(args.onSkip).toHaveBeenCalled();
    await expect(args.onComplete).not.toHaveBeenCalled();
  },
};
