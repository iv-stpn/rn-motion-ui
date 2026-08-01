import type { Meta, StoryObj } from '@storybook/react';
import { type ComponentProps, useCallback, useState } from 'react';
import { View } from 'react-native';
import { expect, within } from 'storybook/test';
import {
  Action,
  Choice,
  ControlCard,
  Note,
  Playground,
  Sample,
  Section,
  Toggle,
  Variants,
} from '../../__stories__/story-harness';
import { useInterval } from '../../hooks/use-interval';
import { TextRolling, type TextRollingDirection } from './text-rolling';

const meta = {
  title: 'Components/TextRolling',
  component: TextRolling,
  parameters: { layout: 'centered' },
  args: {
    text: 'Uploading',
    direction: 'forward',
    className: 'text-lg font-medium text-foreground',
  },
  argTypes: {
    direction: { control: 'radio', options: ['forward', 'backward'] satisfies TextRollingDirection[] },
  },
} satisfies Meta<typeof TextRolling>;

type Story = StoryObj<typeof meta>;

const STATUSES = ['Uploading', 'Processing', 'Almost done', 'Complete'];
const DIRECTIONS = [
  { value: 'forward', label: 'forward (up)' },
  { value: 'backward', label: 'backward (down)' },
] as const satisfies readonly { value: TextRollingDirection; label: string }[];
const CYCLE_MS = 2000;
const FIRST_STATUS = 'Uploading';

type RollingDemoProps = { direction: TextRollingDirection; className?: string; index: number };

// The roll only fires when `text` changes, so every sample reads the same shared
// index — one timer drives them all and the directions stay in step.
// biome-ignore lint/style/useComponentExportOnlyModules: story helper
function RollingSample({ direction, className, index }: RollingDemoProps) {
  const current = STATUSES[index % STATUSES.length] ?? FIRST_STATUS;
  return (
    <View className="min-w-[160px] items-center">
      <TextRolling className={className} direction={direction} text={current} />
    </View>
  );
}

// biome-ignore lint/style/useComponentExportOnlyModules: story helper
function TextRollingPlayground(args: ComponentProps<typeof TextRolling>) {
  const [direction, setDirection] = useState<TextRollingDirection>('forward');
  const [auto, setAuto] = useState(true);
  const [index, setIndex] = useState(0);

  const advance = useCallback(() => setIndex((i) => (i + 1) % STATUSES.length), []);
  useInterval(advance, auto ? CYCLE_MS : null);

  return (
    <Playground className="max-w-[380px]">
      <ControlCard title="Options">
        <Choice label="Direction" onChange={setDirection} options={DIRECTIONS} value={direction} />
        <Toggle label="Auto-cycle" onChange={setAuto} value={auto} />
        <Action label="Next label" onPress={advance} />
      </ControlCard>

      <View className="items-center gap-1.5">
        <RollingSample className={args.className} direction={direction} index={index} />
        <Note>{`${index + 1} / ${STATUSES.length}`}</Note>
      </View>

      {/* Both directions share the index, so one press rolls them opposite ways. */}
      <Section title="Directions">
        <Variants align="center">
          {DIRECTIONS.map((option) => (
            <Sample align="center" key={option.value} label={option.label}>
              <RollingSample className={args.className} direction={option.value} index={index} />
            </Sample>
          ))}
        </Variants>
      </Section>
    </Playground>
  );
}

export default meta;

/** One label rolling through four statuses. Flip the direction to swap which way
 *  the old text leaves, or step it manually with "Next label". */
export const Interactive: Story = { render: (args) => <TextRollingPlayground {...args} /> };

export const Cycling: Story = {
  name: 'Demo: Announces the current label',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByLabelText(FIRST_STATUS)).toBeInTheDocument();
  },
};
