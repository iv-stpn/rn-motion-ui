import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { View } from 'react-native';
import { expect, userEvent, within } from 'storybook/test';
import { Choice, ControlCard, Playground, Sample, Section, Variants } from '../../../__stories__/story-harness';
import { Button } from '../Button/button';
import { ToggleGroup } from './toggle-group';

const meta = {
  title: 'Form/ToggleGroup',
  component: ToggleGroup,
  parameters: { layout: 'centered' },
  args: { variant: 'spaced', orientation: 'horizontal', size: 'md' },
  argTypes: {
    variant: { control: 'select', options: ['spaced', 'bordered'] },
    orientation: { control: 'select', options: ['horizontal', 'vertical'] },
    size: { control: 'select', options: ['sm', 'md', 'lg'] },
  },
} satisfies Meta<typeof ToggleGroup>;

type Story = StoryObj<typeof meta>;

const VARIANTS = ['spaced', 'bordered'] as const;
const ORIENTATIONS = ['horizontal', 'vertical'] as const;
const SIZES = ['sm', 'md', 'lg'] as const;
const SIZE_LABELS = { sm: 'Small', md: 'Medium', lg: 'Large' } as const;

const OPTIONS = [
  { label: 'Left', value: 'left' },
  { label: 'Center', value: 'center' },
  { label: 'Right', value: 'right' },
];

// biome-ignore lint/style/useComponentExportOnlyModules: story helper
function ToggleGroupPlayground() {
  const [variant, setVariant] = useState<'spaced' | 'bordered'>('spaced');
  const [orientation, setOrientation] = useState<'horizontal' | 'vertical'>('horizontal');
  const [size, setSize] = useState<(typeof SIZES)[number]>('md');
  const [selected, setSelected] = useState<string>('center');

  return (
    <Playground>
      <ControlCard title="Options">
        <Choice label="Variant" onChange={setVariant} options={VARIANTS} value={variant} />
        <Choice label="Orientation" onChange={setOrientation} options={ORIENTATIONS} value={orientation} />
        <Choice label="Size" onChange={setSize} options={SIZES} value={size} />
      </ControlCard>

      <View className="flex-row items-center gap-4">
        <ToggleGroup variant={variant} orientation={orientation} size={size} value={selected} onValueChange={setSelected}>
          {OPTIONS.map((opt) => (
            <Button key={opt.value} value={opt.value} size={size}>
              {opt.label}
            </Button>
          ))}
        </ToggleGroup>
      </View>

      <View className="h-3" />
      <Section title="Variants & Orientation">
        <Variants>
          {VARIANTS.map((v) =>
            ORIENTATIONS.map((o) => (
              <Sample key={`${v}-${o}`} label={`${v} / ${o}`}>
                <ToggleGroup variant={v} orientation={o} size="md" value="center">
                  {OPTIONS.map((opt) => (
                    <Button key={opt.value} value={opt.value} size="md">
                      {o === 'horizontal' ? opt.label : `${opt.label} Button`}
                    </Button>
                  ))}
                </ToggleGroup>
              </Sample>
            )),
          )}
        </Variants>
      </Section>

      <Section title="Sizes">
        <Variants align="center">
          {SIZES.map((name) => (
            <Sample key={name} label={SIZE_LABELS[name]}>
              <ToggleGroup variant={variant} orientation="horizontal" size={name} value="center">
                {OPTIONS.map((opt) => (
                  <Button key={opt.value} value={opt.value} size={name}>
                    {opt.label}
                  </Button>
                ))}
              </ToggleGroup>
            </Sample>
          ))}
        </Variants>
      </Section>
    </Playground>
  );
}

export default meta;

/** Drive the variant, orientation, size, and selected value with the controls, or browse the rows below. */
export const Interactive: Story = {
  render: () => <ToggleGroupPlayground />,
};

/** Spaced: each button keeps its own border-radius, with a gap between them. The selected button uses the primary variant. */
export const Spaced: Story = {
  render: () => (
    <ToggleGroup variant="spaced" orientation="horizontal" size="md" value="center" testID="spaced-toggle">
      {OPTIONS.map((opt) => (
        <Button key={opt.value} value={opt.value} size="md">
          {opt.label}
        </Button>
      ))}
    </ToggleGroup>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const group = await canvas.findByTestId('spaced-toggle');
    // All three buttons render
    const btns = within(group).findAllByRole('button');
    expect(await btns).toHaveLength(3);
    // The selected button ("Center") carries the primary variant class
    const center = await canvas.findByRole('button', { name: 'Center' });
    expect(center.className).toContain('bg');
    // Pressing an unselected button fires onValueChange — the consumer
    // updates `value`, so the group re-renders with the new selection.
    const left = await canvas.findByRole('button', { name: 'Left' });
    await userEvent.click(left);
  },
};

/** Bordered: a segmented control — inner edges get a divider, selection fills the active segment. */
export const Bordered: Story = {
  render: () => (
    <ToggleGroup variant="bordered" orientation="horizontal" size="md" value="center" testID="bordered-toggle">
      {OPTIONS.map((opt) => (
        <Button key={opt.value} value={opt.value} size="md">
          {opt.label}
        </Button>
      ))}
    </ToggleGroup>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const group = await canvas.findByTestId('bordered-toggle');
    // All three buttons render
    const btns = within(group).findAllByRole('button');
    expect(await btns).toHaveLength(3);
    // Inner-facing edges carry a border (border-r on non-last buttons)
    const dividers = group.querySelectorAll(':scope > [class*="border-r"]');
    expect(dividers).toHaveLength(2);
    // The selected button carries a filled variant
    const center = await canvas.findByRole('button', { name: 'Center' });
    expect(center.className).toContain('border');
  },
};

/** Vertical orientation — buttons stack top-to-bottom. First and last items get asymmetric press animations. */
export const Vertical: Story = {
  render: () => (
    <View className="w-50">
      <ToggleGroup variant="bordered" orientation="vertical" size="md" value="center" testID="vertical-toggle">
        {OPTIONS.map((opt) => (
          <Button key={opt.value} value={opt.value} size="md">
            {opt.label}
          </Button>
        ))}
      </ToggleGroup>
    </View>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const group = await canvas.findByTestId('vertical-toggle');
    const btns = within(group).findAllByRole('button');
    expect(await btns).toHaveLength(3);
    expect(group.className).toContain('flex-col');
  },
};
