import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, within } from 'storybook/test';
import { NotFoundGlitch } from './not-found';

const sharedArgs = {
  code: '404',
  title: 'Page not found',
  description: 'The page you are looking for moved, vanished, or never existed.',
  onHome: fn(),
  homeLabel: 'Back home',
  onBrowse: fn(),
  browseLabel: 'Browse components',
};

const meta = {
  title: 'Components/NotFound',
  args: sharedArgs,
} satisfies Meta;

type Story = StoryObj<typeof meta>;
export default meta;

export const Glitch: Story = {
  render: (args) => <NotFoundGlitch {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const code = await canvas.findByTestId('not-found-code');
    await expect(code).toBeTruthy();
    const homeBtn = await canvas.findByText('Back home');
    await expect(homeBtn).toBeTruthy();
  },
};
