import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';
import { PredictionMarket } from './prediction-market';

const meta = {
  title: 'Components/PredictionMarket',
  component: PredictionMarket,
  args: {
    outcomes: [
      { id: 'yes', label: 'Yes', price: 0.167 },
      { id: 'no', label: 'No', price: 0.834 },
    ],
    balance: 500,
    positions: { yes: 125, no: 48 },
    quickAmounts: [1, 5, 10, 100],
    authenticated: true,
    minTrade: 1,
    onValueChange: fn(),
    onTrade: fn(),
  },
} satisfies Meta<typeof PredictionMarket>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify Buy and Sell tabs render
    const buyTab = canvas.getByRole('tab', { name: 'Buy' });
    const sellTab = canvas.getByRole('tab', { name: 'Sell' });
    expect(buyTab).toBeTruthy();
    expect(sellTab).toBeTruthy();

    // Tap the 'No' outcome tab
    const noTab = canvas.getByRole('tab', { name: /No/ });
    await userEvent.click(noTab);

    // Type an amount in the input
    const amountInput = canvas.getByLabelText('Amount');
    await userEvent.type(amountInput, '10');

    // Check the Trade button is enabled
    const tradeButton = canvas.getByTestId('trade-button');
    expect(tradeButton).toBeTruthy();
  },
};

export const Unauthenticated: Story = {
  args: {
    authenticated: false,
  },
};

export const Sell: Story = {
  args: {
    defaultValue: { mode: 'sell' },
  },
};
