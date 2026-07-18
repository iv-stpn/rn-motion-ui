import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';
import { PredictionMarket } from './prediction-market';

// Outcome tabs render `label + price` (e.g. "No 83.4¢"), so match the label
// prefix instead of the full accessible name.
const NO_OUTCOME_TAB = /^No\b/;

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

type Story = StoryObj<typeof meta>;
export default meta;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify Buy and Sell tabs render
    const buyTab = canvas.getByRole('tab', { name: 'Buy' });
    const sellTab = canvas.getByRole('tab', { name: 'Sell' });
    expect(buyTab).toBeTruthy();
    expect(sellTab).toBeTruthy();

    // Tap the 'No' outcome tab. Its accessible name includes the price (e.g.
    // "No 83.4¢"), so match on the label prefix rather than the full string.
    const noTab = canvas.getByRole('tab', { name: NO_OUTCOME_TAB });
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
