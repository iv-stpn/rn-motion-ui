import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, within } from 'storybook/test';
import { NotFoundGlitch, NotFoundMagnetic, NotFoundSpotlight, NotFoundStacked, NotFoundTerminal } from './not-found';

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

export const Magnetic: Story = {
  render: (args) => <NotFoundMagnetic {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const title = await canvas.findByText('Page not found');
    await expect(title).toBeTruthy();
  },
};

export const Spotlight: Story = {
  render: (args) => <NotFoundSpotlight {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const code = await canvas.findByTestId('not-found-code');
    await expect(code).toBeTruthy();
  },
};

export const Stacked: Story = {
  render: (args) => <NotFoundStacked {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const code = await canvas.findByTestId('not-found-code');
    await expect(code).toBeTruthy();
    const title = await canvas.findByText('Page not found');
    await expect(title).toBeTruthy();
  },
};

export const Terminal: Story = {
  render: (args) => <NotFoundTerminal {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // TextReveal uses accessibilityLabel on the whole view; find by the container testID
    const codeView = await canvas.findByTestId('not-found-code');
    await expect(codeView).toBeTruthy();
    const title = await canvas.findByText('Page not found');
    await expect(title).toBeTruthy();
  },
};
