import type { Meta, StoryObj } from '@storybook/react';
import { View } from 'react-native';
import { EditLine } from 'rn-motion-ui-icons/icons/edit-line';
import { Share2Line } from 'rn-motion-ui-icons/icons/share-2-line';
import { expect, fn, userEvent, within } from 'storybook/test';
import { Playground, Section } from '../../../__stories__/story-harness';
import { DetailHeader, type DetailHeaderAction } from './detail-header';

const meta = {
  title: 'Navigation/DetailHeader',
  component: DetailHeader,
  parameters: { layout: 'centered' },
  args: {
    title: 'Document title',
    onLeadingPress: fn(),
    onAction: fn(),
  },
} satisfies Meta<typeof DetailHeader>;

type Story = StoryObj<typeof meta>;

const ACTIONS = [
  { id: 'share', label: 'Share', icon: Share2Line },
  { id: 'edit', label: 'Edit', icon: EditLine },
  { id: 'done', label: 'Done' },
] satisfies readonly DetailHeaderAction[];

export default meta;

/** The standard detail header: a back affordance, a truncating title and a mix
 *  of icon and labelled trailing actions, each on the `${testID}-action-<id>`
 *  testID. */
export const Back: Story = {
  render: ({ onLeadingPress, onAction }) => (
    <Playground>
      <Section title="back + title + trailing actions">
        <View className="w-96 overflow-hidden rounded-xl border border-border">
          <DetailHeader
            title="Document title"
            leading="back"
            actions={ACTIONS}
            onLeadingPress={onLeadingPress}
            onAction={onAction}
            testID="story-header"
          />
        </View>
      </Section>
    </Playground>
  ),
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const leading = await canvas.findByTestId('story-header-leading');
    await userEvent.click(leading);
    await expect(args.onLeadingPress).toHaveBeenCalled();

    const share = await canvas.findByTestId('story-header-action-share');
    await userEvent.click(share);
    await expect(args.onAction).toHaveBeenCalledWith(expect.objectContaining({ id: 'share' }));
  },
};

/** The modal/pane form: a close ✕ instead of a back arrow. */
export const Close: Story = {
  render: () => (
    <View className="w-96 overflow-hidden rounded-xl border border-border">
      <DetailHeader title="New folder" leading="close" actions={[{ id: 'done', label: 'Done' }]} testID="story-close" />
    </View>
  ),
};

/** No leading affordance — the title sits flush left. */
export const NoLeading: Story = {
  render: () => (
    <View className="w-96 overflow-hidden rounded-xl border border-border">
      <DetailHeader
        title="Settings"
        leading="none"
        actions={[{ id: 'edit', label: 'Edit', icon: EditLine }]}
        testID="story-nolead"
      />
    </View>
  ),
};
