import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { View } from 'react-native';
import { expect, userEvent, within } from 'storybook/test';
import { Choice, ControlCard, Playground, Sample, Section, Variants } from '../../../__stories__/story-harness';
import { Button } from '../Button/button';
import { ButtonGroup } from './button-group';

const meta = {
  title: 'Form/ButtonGroup',
  component: ButtonGroup,
  parameters: { layout: 'centered' },
  args: { variant: 'spaced', orientation: 'horizontal', size: 'md' },
  argTypes: {
    variant: { control: 'select', options: ['spaced', 'bordered'] },
    orientation: { control: 'select', options: ['horizontal', 'vertical'] },
    size: { control: 'select', options: ['sm', 'md', 'lg'] },
  },
} satisfies Meta<typeof ButtonGroup>;

type Story = StoryObj<typeof meta>;

const VARIANTS = ['spaced', 'bordered'] as const;
const ORIENTATIONS = ['horizontal', 'vertical'] as const;
const SIZES = ['sm', 'md', 'lg'] as const;
const SIZE_LABELS = { sm: 'Small', md: 'Medium', lg: 'Large' } as const;

const BUTTONS = [
  { label: 'Left', variant: 'secondary' as const },
  { label: 'Center', variant: 'primary' as const },
  { label: 'Right', variant: 'secondary' as const },
];

// biome-ignore lint/style/useComponentExportOnlyModules: story helper
function ButtonGroupPlayground() {
  const [variant, setVariant] = useState<'spaced' | 'bordered'>('spaced');
  const [orientation, setOrientation] = useState<'horizontal' | 'vertical'>('horizontal');
  const [size, setSize] = useState<(typeof SIZES)[number]>('md');

  return (
    <Playground>
      <ControlCard title="Options">
        <Choice label="Variant" onChange={setVariant} options={VARIANTS} value={variant} />
        <Choice label="Orientation" onChange={setOrientation} options={ORIENTATIONS} value={orientation} />
        <Choice label="Size" onChange={setSize} options={SIZES} value={size} />
      </ControlCard>

      <View className="flex-row items-center gap-4">
        <ButtonGroup variant={variant} orientation={orientation} size={size}>
          {BUTTONS.map((btn) => (
            <Button key={btn.label} variant={btn.variant} size={size}>
              {btn.label}
            </Button>
          ))}
        </ButtonGroup>
      </View>

      <View className="h-3" />
      <Section title="Variants & Orientation">
        <Variants>
          {VARIANTS.map((v) =>
            ORIENTATIONS.map((o) => (
              <Sample key={`${v}-${o}`} label={`${v} / ${o}`}>
                <ButtonGroup variant={v} orientation={o} size="md">
                  {BUTTONS.map((btn) => (
                    <Button key={btn.label} variant={btn.variant} size="md">
                      {o === 'horizontal' ? btn.label : `${btn.label} Button`}
                    </Button>
                  ))}
                </ButtonGroup>
              </Sample>
            )),
          )}
        </Variants>
      </Section>

      <Section title="Sizes">
        <Variants align="center">
          {SIZES.map((name) => (
            <Sample key={name} label={SIZE_LABELS[name]}>
              <ButtonGroup variant={variant} orientation="horizontal" size={name}>
                {BUTTONS.map((btn) => (
                  <Button key={btn.label} variant={btn.variant} size={name}>
                    {btn.label}
                  </Button>
                ))}
              </ButtonGroup>
            </Sample>
          ))}
        </Variants>
      </Section>
    </Playground>
  );
}

export default meta;

/** Drive the variant, orientation, and size with the controls, or browse the rows below. */
export const Interactive: Story = {
  render: () => <ButtonGroupPlayground />,
};

/** Spaced: buttons have a gap between them and keep their own border-radius. */
export const Spaced: Story = {
  render: () => (
    <ButtonGroup variant="spaced" orientation="horizontal" size="md" testID="spaced-group">
      {BUTTONS.map((btn) => (
        <Button key={btn.label} variant={btn.variant} size="md">
          {btn.label}
        </Button>
      ))}
    </ButtonGroup>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const centerBtn = await canvas.findByRole('button', { name: 'Center' });
    // Press the middle button — its own pressScale handles the animation
    await userEvent.click(centerBtn);
  },
};

/** Bordered: buttons sit flush inside a shared border with dividers between them. */
export const Bordered: Story = {
  render: () => (
    <ButtonGroup variant="bordered" orientation="horizontal" size="md" testID="bordered-group">
      {BUTTONS.map((btn) => (
        <Button key={btn.label} variant={btn.variant} size="md">
          {btn.label}
        </Button>
      ))}
    </ButtonGroup>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const group = await canvas.findByTestId('bordered-group');
    const btns = within(group).findAllByRole('button');
    expect(await btns).toHaveLength(3);
    // The group should contain dividers (w-px views between buttons)
    expect(group.className).toContain('rounded');
    expect(group.className).toContain('border');
  },
};

/** Vertical orientation — buttons stack top-to-bottom. */
export const Vertical: Story = {
  render: () => (
    <View style={{ width: 200 }}>
      <ButtonGroup variant="bordered" orientation="vertical" size="md" testID="vertical-group">
        {BUTTONS.map((btn) => (
          <Button key={btn.label} variant={btn.variant} size="md">
            {btn.label}
          </Button>
        ))}
      </ButtonGroup>
    </View>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const group = await canvas.findByTestId('vertical-group');
    const btns = within(group).findAllByRole('button');
    expect(await btns).toHaveLength(3);
    expect(group.className).toContain('flex-col');
  },
};
