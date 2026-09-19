import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { View } from 'react-native';
import { expect, screen, userEvent, waitFor, within } from 'storybook/test';
import { Action, Choice, ControlCard, Playground, Section, Toggle, Variants } from '../../../__stories__/story-harness';
import { Button } from '../../buttons/Button/button';
import type { ToastPosition, ToastSize, ToastVariant } from './toast-types';
import { Toaster, toast } from './toaster';

const meta = {
  title: 'Display/Toaster',
  component: Toaster,
  parameters: { layout: 'centered' },
  args: { position: 'bottom', duration: 4000, offset: 16, glass: false, pill: false, size: 'md' },
  argTypes: {
    position: { control: 'select', options: ['top', 'bottom'] },
    duration: { control: { type: 'range', min: 0, max: 12_000, step: 500 } },
    offset: { control: { type: 'range', min: 0, max: 80, step: 4 } },
    glass: { control: 'boolean' },
    pill: { control: 'boolean' },
    size: { control: 'select', options: ['sm', 'md', 'lg'] },
  },
} satisfies Meta<typeof Toaster>;

type Story = StoryObj<typeof meta>;

const POSITIONS = ['top', 'bottom'] as const;
const OFFSETS = ['0', '16', '32', '64'] as const;
const SIZES = ['sm', 'md', 'lg'] as const;
const VARIANTS: readonly ToastVariant[] = ['primary', 'secondary', 'accent', 'neutral', 'danger', 'success', 'warning', 'info'];
const LABEL: Record<ToastVariant, string> = {
  primary: 'Primary',
  secondary: 'Secondary',
  accent: 'Accent',
  neutral: 'Neutral',
  danger: 'Danger',
  success: 'Success',
  warning: 'Warning',
  info: 'Info',
};

/** The catalogue: option controls set the `<Toaster>` defaults (position,
 *  offset, glass, pill) and the per-toast duration, then a row of Buttons fires
 *  one toast per variant honouring those options. */
function ToasterPlayground() {
  const [position, setPosition] = useState<ToastPosition>('bottom');
  const [offset, setOffset] = useState<(typeof OFFSETS)[number]>('16');
  const [size, setSize] = useState<ToastSize>('md');
  const [glass, setGlass] = useState(false);
  const [pill, setPill] = useState(false);
  const [sticky, setSticky] = useState(false);

  const fire = (variant: ToastVariant) => toast(LABEL[variant], { variant, duration: sticky ? 0 : undefined });

  return (
    <Playground>
      <Toaster position={position} offset={Number(offset)} glass={glass} pill={pill} size={size} />
      <ControlCard title="Options">
        <Choice label="Position" onChange={setPosition} options={POSITIONS} value={position} />
        <Choice label="Offset" onChange={setOffset} options={OFFSETS} value={offset} />
        <Choice label="Size" onChange={setSize} options={SIZES} value={size} />
        <Toggle label="Glass" onChange={setGlass} value={glass} />
        <Toggle label="Pill" onChange={setPill} value={pill} />
        <Toggle label="Sticky" onChange={setSticky} value={sticky} />
      </ControlCard>

      <Section title="Variants — fire a toast (tap to dismiss)">
        <Variants>
          {VARIANTS.map((variant) => (
            <Button key={variant} variant={variant} onPress={() => fire(variant)}>
              {LABEL[variant]}
            </Button>
          ))}
        </Variants>
      </Section>
    </Playground>
  );
}

export default meta;

/** Drive position, offset, glass, pill, and duration with the controls, then
 *  fire any variant from the row below. */
export const Interactive: Story = {
  render: () => <ToasterPlayground />,
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

/** The `pill` prop: every toast renders as a fully-rounded capsule. */
export const Pill: Story = {
  args: { pill: true },
  render: (args) => (
    <View>
      <Toaster {...args} />
      <Action label="Toast" onPress={() => toast('Pill capsule', { duration: 0 })} />
    </View>
  ),
};
