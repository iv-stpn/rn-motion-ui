import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { View } from 'react-native';
import { expect, userEvent, within } from 'storybook/test';
import { Choice, ControlCard, Playground, Sample, Section, Variants } from '../../../__stories__/story-harness';
import { INTERACTIVE_HEIGHT } from '../../../lib/radius';
import { ChoiceGroup } from './choice-group';

const meta = {
  title: 'Form/ChoiceGroup',
  component: ChoiceGroup,
  parameters: { layout: 'centered' },
  args: { variant: 'outline', shape: 'pill', orientation: 'horizontal', size: 'md' },
  argTypes: {
    variant: { control: 'select', options: ['neutral', 'info', 'outline', 'outline-info'] },
    shape: { control: 'select', options: ['rounded', 'pill'] },
    orientation: { control: 'select', options: ['horizontal', 'vertical'] },
    size: { control: 'select', options: ['sm', 'md', 'lg'] },
  },
} satisfies Meta<typeof ChoiceGroup>;

type Story = StoryObj<typeof meta>;

const VARIANTS = ['neutral', 'info', 'outline', 'outline-info'] as const;
const SHAPES = ['rounded', 'pill'] as const;
const SIZES = ['sm', 'md', 'lg'] as const;
const SIZE_LABELS = { sm: 'Small', md: 'Medium', lg: 'Large' } as const;

const OPTIONS = [
  { value: 'left', label: 'Left' },
  { value: 'center', label: 'Center' },
  { value: 'right', label: 'Right' },
];

/** Longer list for the wrap story — six chips cannot fit one row inside w-64. */
const WRAP_OPTIONS = [
  { value: 'one', label: 'One' },
  { value: 'two', label: 'Two' },
  { value: 'three', label: 'Three' },
  { value: 'four', label: 'Four' },
  { value: 'five', label: 'Five' },
  { value: 'six', label: 'Six' },
];

function ChoiceGroupPlayground() {
  const [variant, setVariant] = useState<(typeof VARIANTS)[number]>('outline');
  const [shape, setShape] = useState<(typeof SHAPES)[number]>('pill');
  const [orientation, setOrientation] = useState<'horizontal' | 'vertical'>('horizontal');
  const [size, setSize] = useState<(typeof SIZES)[number]>('md');
  const [selected, setSelected] = useState<string>('center');

  return (
    <Playground>
      <ControlCard title="Options">
        <Choice label="Variant" onChange={setVariant} options={VARIANTS} value={variant} />
        <Choice label="Shape" onChange={setShape} options={SHAPES} value={shape} />
        <Choice label="Orientation" onChange={setOrientation} options={['horizontal', 'vertical']} value={orientation} />
        <Choice label="Size" onChange={setSize} options={SIZES} value={size} />
      </ControlCard>

      <View className="flex-row items-center gap-4">
        <ChoiceGroup
          variant={variant}
          shape={shape}
          orientation={orientation}
          size={size}
          value={selected}
          onValueChange={setSelected}
          items={OPTIONS}
        />
      </View>

      <View className="h-3" />
      <Section title="Variant & Shape">
        <Variants>
          {VARIANTS.map((v) =>
            SHAPES.map((s) => (
              <Sample key={`${v}-${s}`} label={`${v} / ${s}`}>
                <ChoiceGroup variant={v} shape={s} orientation="horizontal" size="md" value="center" items={OPTIONS} />
              </Sample>
            )),
          )}
        </Variants>
      </Section>

      <Section title="Sizes">
        <Variants align="center">
          {SIZES.map((name) => (
            <Sample key={name} label={SIZE_LABELS[name]}>
              <ChoiceGroup variant={variant} shape={shape} orientation="horizontal" size={name} value="center" items={OPTIONS} />
            </Sample>
          ))}
        </Variants>
      </Section>
    </Playground>
  );
}

/** Stateful wrapper so a play fn can drive a real selection change. */
function SelectionStory() {
  const [value, setValue] = useState<string>('center');
  return <ChoiceGroup testID="choice-selection" items={OPTIONS} value={value} onValueChange={setValue} />;
}

export default meta;

/** Drive the variant, shape, orientation, size, and selected value with the controls, or browse the rows below. */
export const Interactive: Story = {
  args: { items: OPTIONS },
  render: () => <ChoiceGroupPlayground />,
};

/** Filled accent background on the selected item. */
export const Neutral: Story = {
  args: { items: OPTIONS },
  render: () => (
    <ChoiceGroup
      variant="neutral"
      shape="pill"
      orientation="horizontal"
      size="md"
      value="center"
      testID="choice-neutral"
      items={OPTIONS}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const group = await canvas.findByTestId('choice-neutral');
    expect(await within(group).findAllByRole('radio')).toHaveLength(3);
    const selected = await within(group).findByRole('radio', { name: 'Center' });
    expect(selected.className).toContain('bg-primary');
    expect(selected.className).not.toContain('border-primary');
  },
};

/** Info-tinted filled accent background on the selected item. */
export const Info: Story = {
  args: { items: OPTIONS },
  render: () => (
    <ChoiceGroup
      variant="info"
      shape="pill"
      orientation="horizontal"
      size="md"
      value="center"
      testID="choice-info"
      items={OPTIONS}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const group = await canvas.findByTestId('choice-info');
    expect(await within(group).findAllByRole('radio')).toHaveLength(3);
    const selected = await within(group).findByRole('radio', { name: 'Center' });
    expect(selected.className).toContain('bg-info');
  },
};

/** Outline — transparent fill with a primary border on the selected item. */
export const Outline: Story = {
  args: { items: OPTIONS },
  render: () => (
    <ChoiceGroup
      variant="outline"
      shape="pill"
      orientation="horizontal"
      size="md"
      value="center"
      testID="choice-outline"
      items={OPTIONS}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const group = await canvas.findByTestId('choice-outline');
    expect(await within(group).findAllByRole('radio')).toHaveLength(3);
    const selected = await within(group).findByRole('radio', { name: 'Center' });
    expect(selected.className).toContain('border-primary');
    // Unselected items keep the neutral hairline border, not the accent.
    const unselected = await within(group).findByRole('radio', { name: 'Left' });
    expect(unselected.className).not.toContain('border-primary');
  },
};

/** Outline-info — transparent fill with an info border on the selected item. */
export const OutlineInfo: Story = {
  args: { items: OPTIONS },
  render: () => (
    <ChoiceGroup
      variant="outline-info"
      shape="pill"
      orientation="horizontal"
      size="md"
      value="center"
      testID="choice-outline-info"
      items={OPTIONS}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const group = await canvas.findByTestId('choice-outline-info');
    expect(await within(group).findAllByRole('radio')).toHaveLength(3);
    const selected = await within(group).findByRole('radio', { name: 'Center' });
    expect(selected.className).toContain('border-info');
  },
};

/** Controlled selection — pressing an item reports its value and the highlight moves. */
export const Selection: Story = {
  args: { items: OPTIONS },
  render: () => <SelectionStory />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const group = await canvas.findByTestId('choice-selection');
    const left = await within(group).findByRole('radio', { name: 'Left' });
    const center = await within(group).findByRole('radio', { name: 'Center' });
    expect(center.getAttribute('aria-checked')).toBe('true');
    await userEvent.click(left);
    await expect(left.getAttribute('aria-checked')).toBe('true');
    await expect(center.getAttribute('aria-checked')).toBe('false');
  },
};

/** Vertical orientation — items stack top-to-bottom. */
export const Vertical: Story = {
  args: { items: OPTIONS },
  render: () => (
    <ChoiceGroup orientation="vertical" shape="rounded" size="md" value="center" testID="choice-vertical" items={OPTIONS} />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const group = await canvas.findByTestId('choice-vertical');
    const radios = await within(group).findAllByRole('radio');
    expect(radios).toHaveLength(3);
    expect(group.className).toContain('flex-col');
    // Vertical items grow from vertical padding instead of the fixed interactive
    // height, so each label keeps its full line box (taller than the fixed
    // height, never clipped).
    const firstRadio = radios[0];
    if (!firstRadio) throw new Error('expected at least one radio');
    expect(firstRadio.getBoundingClientRect().height).toBeGreaterThan(INTERACTIVE_HEIGHT.md);
  },
};

/** Long lists wrap onto additional lines instead of scrolling or stretching. */
export const Wraps: Story = {
  args: { items: WRAP_OPTIONS },
  render: () => (
    <View className="w-64">
      <ChoiceGroup shape="rounded" size="md" value="three" testID="choice-wrapping" items={WRAP_OPTIONS} />
    </View>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const group = await canvas.findByTestId('choice-wrapping');
    const radios = await within(group).findAllByRole('radio');
    expect(radios).toHaveLength(6);
    const firstRadio = radios[0];
    if (!firstRadio) throw new Error('expected at least one radio');
    const itemHeight = firstRadio.getBoundingClientRect().height;
    // Six chips cannot fit one row inside w-64 — the group must wrap to ≥ 2 rows.
    expect(group.getBoundingClientRect().height).toBeGreaterThan(itemHeight * 1.5);
  },
};
