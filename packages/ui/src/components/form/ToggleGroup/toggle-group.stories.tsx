import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { View } from 'react-native';
import { expect, userEvent, within } from 'storybook/test';
import { Choice, ControlCard, Playground, Sample, Section, Variants } from '../../../__stories__/story-harness';
import { INTERACTIVE_HEIGHT } from '../../../lib/radius';
import { ToggleGroup } from './toggle-group';

const meta = {
  title: 'Form/ToggleGroup',
  component: ToggleGroup,
  parameters: { layout: 'centered' },
  args: { containerVariant: 'bordered', shape: 'pill', orientation: 'horizontal', size: 'md' },
  argTypes: {
    containerVariant: { control: 'select', options: ['bordered', 'connected'] },
    shape: { control: 'select', options: ['rounded', 'pill'] },
    orientation: { control: 'select', options: ['horizontal', 'vertical'] },
    size: { control: 'select', options: ['sm', 'md', 'lg'] },
  },
} satisfies Meta<typeof ToggleGroup>;

type Story = StoryObj<typeof meta>;

const CONTAINER_VARIANTS = ['bordered', 'connected'] as const;
const SHAPES = ['rounded', 'pill'] as const;
const ORIENTATIONS = ['horizontal', 'vertical'] as const;
const SIZES = ['sm', 'md', 'lg'] as const;
const SIZE_LABELS = { sm: 'Small', md: 'Medium', lg: 'Large' } as const;

const OPTIONS = [
  { value: 'left', label: 'Left' },
  { value: 'center', label: 'Center' },
  { value: 'right', label: 'Right' },
];

function ToggleGroupPlayground() {
  const [containerVariant, setContainerVariant] = useState<(typeof CONTAINER_VARIANTS)[number]>('bordered');
  const [shape, setShape] = useState<(typeof SHAPES)[number]>('pill');
  const [orientation, setOrientation] = useState<(typeof ORIENTATIONS)[number]>('horizontal');
  const [size, setSize] = useState<(typeof SIZES)[number]>('md');
  const [selected, setSelected] = useState<string>('center');

  return (
    <Playground>
      <ControlCard title="Options">
        <Choice label="Container variant" onChange={setContainerVariant} options={CONTAINER_VARIANTS} value={containerVariant} />
        <Choice label="Shape" onChange={setShape} options={SHAPES} value={shape} />
        <Choice label="Orientation" onChange={setOrientation} options={ORIENTATIONS} value={orientation} />
        <Choice label="Size" onChange={setSize} options={SIZES} value={size} />
      </ControlCard>

      <View className="flex-row items-center gap-4">
        <ToggleGroup
          containerVariant={containerVariant}
          shape={shape}
          orientation={orientation}
          size={size}
          value={selected}
          onValueChange={setSelected}
          items={OPTIONS}
        />
      </View>

      <View className="h-3" />
      <Section title="Container variant & Shape">
        <Variants>
          {CONTAINER_VARIANTS.map((v) =>
            SHAPES.map((s) => (
              <Sample key={`${v}-${s}`} label={`${v} / ${s}`}>
                <ToggleGroup containerVariant={v} shape={s} orientation="horizontal" size="md" value="center" items={OPTIONS} />
              </Sample>
            )),
          )}
        </Variants>
      </Section>

      <Section title="Sizes">
        <Variants align="center">
          {SIZES.map((name) => (
            <Sample key={name} label={SIZE_LABELS[name]}>
              <ToggleGroup
                containerVariant={containerVariant}
                shape={shape}
                orientation="horizontal"
                size={name}
                value="center"
                items={OPTIONS}
              />
            </Sample>
          ))}
        </Variants>
      </Section>
    </Playground>
  );
}

export default meta;

/** Drive the container variant, shape, orientation, size, and selected value with the controls, or browse the rows below. */
export const Interactive: Story = {
  args: { items: OPTIONS },
  render: () => <ToggleGroupPlayground />,
};

/** Bordered / rounded: segmented control with an outer border. Dividers adjacent to the selected item are suppressed. */
export const BorderedRounded: Story = {
  args: { items: OPTIONS },
  render: () => (
    <ToggleGroup
      containerVariant="bordered"
      shape="rounded"
      orientation="horizontal"
      size="md"
      value="center"
      testID="bordered-rounded"
      items={OPTIONS}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const group = await canvas.findByTestId('bordered-rounded');
    const radios = await within(group).findAllByRole('radio');
    expect(radios).toHaveLength(3);
    // Outer border present
    expect(group.className).toContain('border');
    expect(group.className).toContain('rounded-interactive');
    // Selected item (center, index 1) suppresses adjacent dividers — only 1 divider remains
    const dividers = group.querySelectorAll(':scope > [class*="border-r"]');
    expect(dividers.length).toBeLessThanOrEqual(1);
    // The horizontal strip hugs its items' height — it must not stretch beyond
    // the item height plus its border.
    const firstRadio = radios[0];
    if (!firstRadio) throw new Error('expected at least one radio');
    const itemHeight = firstRadio.getBoundingClientRect().height;
    expect(group.getBoundingClientRect().height).toBeLessThanOrEqual(itemHeight + 4);
  },
};

/** Bordered / pill: segmented control with a fully-rounded outer container. Dividers adjacent to the selected item are suppressed. */
export const BorderedPill: Story = {
  args: { items: OPTIONS },
  render: () => (
    <ToggleGroup
      containerVariant="bordered"
      shape="pill"
      orientation="horizontal"
      size="md"
      value="center"
      testID="bordered-pill"
      items={OPTIONS}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const group = await canvas.findByTestId('bordered-pill');
    const radios = within(group).findAllByRole('radio');
    expect(await radios).toHaveLength(3);
    expect(group.className).toContain('rounded-full');
    expect(group.className).toContain('border');
    const left = await canvas.findByRole('radio', { name: 'Left' });
    await userEvent.click(left);
  },
};

/** Connected / rounded: segmented control with an outer border but no internal dividers between items. */
export const ConnectedRounded: Story = {
  args: { items: OPTIONS },
  render: () => (
    <ToggleGroup
      containerVariant="connected"
      shape="rounded"
      orientation="horizontal"
      size="md"
      value="center"
      testID="connected-rounded"
      items={OPTIONS}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const group = await canvas.findByTestId('connected-rounded');
    const radios = within(group).findAllByRole('radio');
    expect(await radios).toHaveLength(3);
    // Has outer border
    expect(group.className).toContain('border');
    // No internal dividers
    const dividers = group.querySelectorAll(':scope > [class*="border-r"]');
    expect(dividers).toHaveLength(0);
    const left = await canvas.findByRole('radio', { name: 'Left' });
    await userEvent.click(left);
  },
};

/** Connected / pill: segmented control with a fully-rounded outer border and no internal dividers. */
export const ConnectedPill: Story = {
  args: { items: OPTIONS },
  render: () => (
    <ToggleGroup
      containerVariant="connected"
      shape="pill"
      orientation="horizontal"
      size="md"
      value="center"
      testID="connected-pill"
      items={OPTIONS}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const group = await canvas.findByTestId('connected-pill');
    const radios = within(group).findAllByRole('radio');
    expect(await radios).toHaveLength(3);
    expect(group.className).toContain('rounded-full');
    expect(group.className).toContain('border');
    // No internal dividers
    const dividers = group.querySelectorAll(':scope > [class*="border-r"]');
    expect(dividers).toHaveLength(0);
    const left = await canvas.findByRole('radio', { name: 'Left' });
    await userEvent.click(left);
  },
};

/** Vertical orientation — items stack top-to-bottom. */
export const Vertical: Story = {
  args: { items: OPTIONS },
  render: () => (
    <View className="w-50">
      <ToggleGroup
        containerVariant="bordered"
        shape="rounded"
        orientation="vertical"
        size="md"
        value="center"
        testID="vertical-toggle"
        items={OPTIONS}
      />
    </View>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const group = await canvas.findByTestId('vertical-toggle');
    const radios = await within(group).findAllByRole('radio');
    expect(radios).toHaveLength(3);
    expect(group.className).toContain('flex-col');
    // Vertical items grow from vertical padding instead of the fixed interactive
    // height, so each label keeps its full line box (taller than the fixed
    // height, never clipped).
    const firstRadio = radios[0];
    if (!firstRadio) throw new Error('expected at least one radio');
    const itemHeight = firstRadio.getBoundingClientRect().height;
    expect(itemHeight).toBeGreaterThan(INTERACTIVE_HEIGHT.md);
  },
};
