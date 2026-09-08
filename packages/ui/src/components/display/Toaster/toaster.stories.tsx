import type { Meta, StoryObj } from '@storybook/react';
import { View } from 'react-native';
import { expect, screen, userEvent, waitFor, within } from 'storybook/test';
import { Action, Playground, Section, Variants } from '../../../__stories__/story-harness';
import type { ToastVariant } from './toast-types';
import { Toaster, toast } from './toaster';

const meta = {
  title: 'Display/Toaster',
  component: Toaster,
  parameters: { layout: 'centered' },
  args: { position: 'bottom', duration: 4000, offset: 16, glass: false },
  argTypes: {
    position: { control: 'select', options: ['top', 'bottom'] },
    duration: { control: { type: 'range', min: 0, max: 12_000, step: 500 } },
    offset: { control: { type: 'range', min: 0, max: 80, step: 4 } },
    glass: { control: 'boolean' },
  },
} satisfies Meta<typeof Toaster>;

type Story = StoryObj<typeof meta>;

const VARIANTS: readonly ToastVariant[] = ['default', 'success', 'error', 'warning', 'info'];
const LABEL: Record<ToastVariant, string> = {
  default: 'Default',
  success: 'Success',
  error: 'Error',
  warning: 'Warning',
  info: 'Info',
};

function fire(variant: ToastVariant) {
  switch (variant) {
    case 'success':
      toast.success('Saved!', { duration: 0 });
      break;
    case 'error':
      toast.error('Something went wrong.', { duration: 0 });
      break;
    case 'warning':
      toast.warning('Heads up.', { duration: 0 });
      break;
    case 'info':
      toast.info('For your information.', { duration: 0 });
      break;
    default:
      toast('Hello!', { duration: 0 });
  }
}

export default meta;

/** Fire one toast per variant. Each stays until tapped (or `dismiss()`ed). */
export const Interactive: Story = {
  render: (args) => (
    <View>
      <Toaster {...args} />
      <Playground>
        <Section title="Fire a toast (tap to dismiss)">
          <Variants>
            {VARIANTS.map((variant) => (
              <Action key={variant} label={LABEL[variant]} onPress={() => fire(variant)} />
            ))}
          </Variants>
        </Section>
      </Playground>
    </View>
  ),
};

/** The imperative API: call `toast.success(...)` and the toast appears, then
 *  dismisses itself when told. Sonner owns the DOM on web, so the assertion is
 *  against the document body — including that the toast shrinks to its content
 *  (well under Sonner's 356px fixed box) instead of stretching full-width. */
export const Announces: Story = {
  name: 'Demo: Announces success',
  render: (args) => (
    <View>
      <Toaster {...args} />
      <Action label="Save" onPress={() => toast.success('Saved!', { duration: 0 })} />
    </View>
  ),
  play: async ({ canvasElement }) => {
    await userEvent.click(await within(canvasElement).findByTestId('story-action-save'));
    await waitFor(() => expect(screen.getByText('Saved!')).toBeInTheDocument());
    const toastEl = screen.getByText('Saved!').closest('[data-sonner-toast]');
    expect(toastEl).not.toBeNull();
    const width = toastEl?.getBoundingClientRect().width ?? 0;
    expect(width).toBeGreaterThan(0);
    expect(width).toBeLessThan(356);
    toast.dismiss();
  },
};

/** The `glass` prop: every toast renders frosted instead of an opaque surface. */
export const Glass: Story = {
  args: { glass: true },
  render: (args) => (
    <View>
      <Toaster {...args} />
      <Action label="Toast" onPress={() => toast('Frosted glass', { duration: 0 })} />
    </View>
  ),
};
