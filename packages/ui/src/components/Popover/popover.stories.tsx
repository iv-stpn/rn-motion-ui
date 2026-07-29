import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { View } from 'react-native';
import { expect, screen, userEvent, within } from 'storybook/test';
import { Choice, Controls, Playground, Sample, Section, Variants } from '../../__stories__/story-harness';
import { Text } from '../Text/text';
import { Popover, type PopoverAlign, PopoverContent, type PopoverSide, PopoverTrigger } from './popover';

const meta = {
  title: 'Components/Popover',
  component: Popover,
  parameters: { layout: 'centered' },
  // Render-only stories supply their own trees; this satisfies the required prop.
  args: { children: null },
  argTypes: {
    side: { control: 'select', options: ['top', 'bottom'] },
    align: { control: 'select', options: ['start', 'center', 'end'] },
  },
} satisfies Meta<typeof Popover>;

type Story = StoryObj<typeof meta>;

const EDIT_PROFILE = 'Edit profile';
const DIMENSIONS_TITLE = 'Dimensions';
const DIMENSIONS_DESC = 'Set the width and height for the layer.';

const FLAT_LABEL = 'Flat';
const FLAT_DESC = 'A shallower surface, softer shadow.';
const LIFTED_LABEL = 'Lifted';
const LIFTED_DESC = 'A lighter surface, deeper shadow.';

const SIDES = ['top', 'bottom'] as const satisfies readonly PopoverSide[];
const ALIGNS = ['start', 'center', 'end'] as const satisfies readonly PopoverAlign[];
const OFFSETS = [
  { value: '0', label: 'flush' },
  { value: '14', label: '14px' },
  { value: '32', label: '32px' },
] as const;
const RADII = [
  { value: '4', label: 'sharp' },
  { value: '16', label: '16px' },
  { value: '28', label: 'pill-ish' },
] as const;

type OffsetKey = (typeof OFFSETS)[number]['value'];
type RadiusKey = (typeof RADII)[number]['value'];

// biome-ignore lint/style/useComponentExportOnlyModules: story helper shared by the playground and the Demo story
function PopoverDemo() {
  return (
    <Popover align="start" side="bottom">
      <PopoverTrigger>{EDIT_PROFILE}</PopoverTrigger>
      <PopoverContent>
        <View style={{ gap: 4 }}>
          <Text className="font-medium text-foreground text-sm">{DIMENSIONS_TITLE}</Text>
          <Text className="text-muted-foreground text-xs">{DIMENSIONS_DESC}</Text>
        </View>
      </PopoverContent>
    </Popover>
  );
}

// biome-ignore lint/style/useComponentExportOnlyModules: story helper
function PopoverPlayground() {
  const [side, setSide] = useState<PopoverSide>('bottom');
  const [align, setAlign] = useState<PopoverAlign>('center');
  const [offsetKey, setOffsetKey] = useState<OffsetKey>('14');
  const [radiusKey, setRadiusKey] = useState<RadiusKey>('16');

  return (
    <Playground>
      <Controls>
        <Choice label="Side" onChange={setSide} options={SIDES} value={side} />
        <Choice label="Align" onChange={setAlign} options={ALIGNS} value={align} />
        <Choice label="Offset" onChange={setOffsetKey} options={OFFSETS} value={offsetKey} />
        <Choice label="Radius" onChange={setRadiusKey} options={RADII} value={radiusKey} />
      </Controls>

      {/* The panel is measured against the trigger's on-screen rect, so the same
          side/align pair lands differently near a screen edge — the position is
          clamped into the viewport rather than overflowing it. */}
      <View style={{ alignItems: 'center', paddingVertical: 24 }}>
        <Popover align={align} panelRadius={Number(radiusKey)} side={side} sideOffset={Number(offsetKey)}>
          <PopoverTrigger>{EDIT_PROFILE}</PopoverTrigger>
          <PopoverContent>
            <View style={{ gap: 4, maxWidth: 220 }}>
              <Text className="font-medium text-foreground text-sm">{DIMENSIONS_TITLE}</Text>
              <Text className="text-muted-foreground text-xs">{DIMENSIONS_DESC}</Text>
            </View>
          </PopoverContent>
        </Popover>
      </View>

      {/* Every side/align pair, each with its own trigger — the panel mounts in an
          RN Modal, so only one is ever on screen at a time. */}
      {SIDES.map((sideOption) => (
        <Section key={sideOption} title={`side="${sideOption}"`}>
          <Variants gap={16}>
            {ALIGNS.map((alignOption) => (
              <Sample align="center" key={alignOption} label={alignOption}>
                <Popover align={alignOption} side={sideOption}>
                  <PopoverTrigger>{`${sideOption}/${alignOption}`}</PopoverTrigger>
                  <PopoverContent>
                    <Text className="text-foreground text-sm">{`Opens ${sideOption}, aligned ${alignOption}.`}</Text>
                  </PopoverContent>
                </Popover>
              </Sample>
            ))}
          </Variants>
        </Section>
      ))}

      <Section title="Elevation of the panel">
        <Variants gap={16}>
          <Sample align="center" label="elevation 2">
            <Popover align="center" side="bottom">
              <PopoverTrigger>{FLAT_LABEL}</PopoverTrigger>
              <PopoverContent elevation={2}>
                <Text className="text-foreground text-sm">{FLAT_DESC}</Text>
              </PopoverContent>
            </Popover>
          </Sample>
          <Sample align="center" label="elevation 6">
            <Popover align="center" side="bottom">
              <PopoverTrigger>{LIFTED_LABEL}</PopoverTrigger>
              <PopoverContent elevation={6}>
                <Text className="text-foreground text-sm">{LIFTED_DESC}</Text>
              </PopoverContent>
            </Popover>
          </Sample>
        </Variants>
      </Section>
    </Playground>
  );
}

export default meta;

/** Side, alignment, offset and corner radius on one live popover, then a trigger
 *  for every side/align pair. The web original melted the
 *  panel out of the trigger with an SVG goo filter — here it springs instead. */
export const Interactive: Story = { render: () => <PopoverPlayground /> };

export const Default: Story = {
  name: 'Demo: Open the popover',
  render: () => <PopoverDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Tapping the trigger opens the popover; its content mounts in the RN Modal.
    await userEvent.click(await canvas.findByText(EDIT_PROFILE));
    await expect(await screen.findByText(DIMENSIONS_TITLE)).toBeTruthy();
  },
};
