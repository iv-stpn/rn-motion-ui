import type { Meta, StoryObj } from '@storybook/react';
import { ScrollView, TextInput, View } from 'react-native';
import { GridLine } from 'rn-motion-ui-icons/icons/grid-line';
import { MenuLine } from 'rn-motion-ui-icons/icons/menu-line';
import { SearchLine } from 'rn-motion-ui-icons/icons/search-line';
import type { SurfaceElevation } from '../../../lib/elevated';
import { useThemeColor } from '../../../theme/use-theme-color';
import { IconButton } from '../../buttons/IconButton/icon-button';
import { Text } from '../../typography/Text/text';
import { Card } from '../Card/card';
import { Rim } from './rim';
import { Surface } from './surface';

/**
 * Visual playground for the glass rim — drive the corner highlight with the
 * controls below and read the four corners against a dark or colourful
 * backdrop. The rim is a specular edge light, so it only reads against a
 * backdrop dark enough for white (or the chosen accent) to separate.
 *
 * Three surfaces:
 *  - `Primitive` draws the raw `Rim` (the SVG layer) on a flat backdrop, so
 *    every knob the layer exposes — intensity, thickness, corner radius, accent
 *    colour, size — is one control away. This is where to confirm whether the
 *    gradient itself puts an equal highlight on opposite corners.
 *  - `FrostedCard` draws the real glass card over coloured shapes, the way a
 *    consumer sees it: backdrop blur + tint + rim composed together.
 *  - `MobileHeader` shows the glass in a phone frame: a frosted search header
 *    (two glass icon buttons around a glass search bar) floating over a
 *    colourful scrolling feed.
 */

const meta = {
  title: 'Display/GlassRim',
  parameters: { layout: 'fullscreen' },
} satisfies Meta;

export default meta;

// ── Primitive ───────────────────────────────────────────────────────────────

type PrimitiveArgs = {
  width: number;
  height: number;
  borderRadius: number;
  intensity: number;
  falloff: number;
  thickness: number;
  accentColor: string;
  backdropColor: string;
};

export const Primitive: StoryObj<PrimitiveArgs> = {
  args: {
    width: 320,
    height: 160,
    borderRadius: 24,
    intensity: 0.5,
    falloff: 2,
    thickness: 1,
    accentColor: '#ffffff',
    backdropColor: '#000000',
  },
  argTypes: {
    width: { control: { type: 'range', min: 120, max: 480, step: 1 } },
    height: { control: { type: 'range', min: 80, max: 320, step: 1 } },
    borderRadius: { control: { type: 'range', min: 0, max: 80, step: 1 } },
    intensity: { control: { type: 'range', min: 0, max: 1, step: 0.05 } },
    falloff: { control: { type: 'range', min: 0.5, max: 6, step: 0.5 } },
    thickness: { control: { type: 'range', min: 0.5, max: 6, step: 0.5 } },
    accentColor: { control: 'color' },
    backdropColor: { control: 'color' },
  },
  render: ({ width, height, borderRadius, intensity, falloff, thickness, accentColor, backdropColor }) => (
    <View style={{ padding: 40, backgroundColor: '#111111' }}>
      <View style={{ width, height, backgroundColor: backdropColor }}>
        <Rim
          width={width}
          height={height}
          borderRadius={borderRadius}
          intensity={intensity}
          falloff={falloff}
          thickness={thickness}
          accentColor={accentColor}
        />
      </View>
    </View>
  ),
};

// ── Frosted card ────────────────────────────────────────────────────────────

type Backdrop = 'colourful' | 'black';

type FrostedArgs = {
  blurRadius: number;
  opacity: number;
  rim: boolean;
  rimWidth: number;
  intensity: number;
  elevation: SurfaceElevation;
  backdrop: Backdrop;
};

export const FrostedCard: StoryObj<FrostedArgs> = {
  args: {
    blurRadius: 12,
    opacity: 1,
    rim: true,
    rimWidth: 1,
    intensity: 0.5,
    elevation: 3,
    backdrop: 'colourful',
  },
  argTypes: {
    blurRadius: { control: { type: 'range', min: 0, max: 40, step: 1 } },
    opacity: { control: { type: 'range', min: 0, max: 1, step: 0.05 } },
    rim: { control: 'boolean' },
    rimWidth: { control: { type: 'range', min: 0.5, max: 6, step: 0.5 } },
    intensity: { control: { type: 'range', min: 0, max: 1, step: 0.05 } },
    elevation: { control: { type: 'range', min: 0, max: 8, step: 1 } },
    backdrop: { control: 'select', options: ['colourful', 'black'] },
  },
  render: ({ blurRadius, opacity, rim, rimWidth, intensity, elevation, backdrop }) => (
    <View
      className="relative h-[300px] w-[400px] items-center justify-center overflow-hidden"
      style={{ backgroundColor: backdrop === 'black' ? '#000000' : '#1a1a1e' }}
    >
      {backdrop === 'colourful' ? (
        <>
          <View
            className="absolute"
            style={{ top: 16, left: 24, width: 96, height: 96, borderRadius: 48, backgroundColor: '#3b82f6' }}
          />
          <View
            className="absolute"
            style={{ right: 24, bottom: 16, width: 112, height: 112, borderRadius: 56, backgroundColor: '#ec4899' }}
          />
          <View
            className="absolute"
            style={{ top: 48, right: 40, width: 64, height: 64, borderRadius: 32, backgroundColor: '#f59e0b' }}
          />
        </>
      ) : null}
      <Card
        blurRadius={blurRadius}
        opacity={opacity}
        rim={rim}
        rimWidth={rimWidth}
        intensity={intensity}
        elevation={elevation}
        className="h-[180px] w-[320px] justify-center"
      >
        <Text weight="semibold" className="text-foreground text-sm">
          Frosted glass
        </Text>
        <Text className="text-muted-foreground text-xs">Blurs the colours behind it.</Text>
      </Card>
    </View>
  ),
};

// ── Mobile header ───────────────────────────────────────────────────────────

const BLUR = 12;
const OPACITY = 1;
const RIM_WIDTH = 1;
const RIM_INTENSITY = 0.5;

const PALETTE = [
  '#3b82f6',
  '#ec4899',
  '#f59e0b',
  '#10b981',
  '#8b5cf6',
  '#ef4444',
  '#06b6d4',
  '#f97316',
  '#84cc16',
  '#14b8a6',
  '#6366f1',
  '#d946ef',
];

/** The glass search bar — a frosted pill with a magnifier and a transparent input. */
function GlassSearchBar() {
  const placeholder = useThemeColor('muted-foreground');
  return (
    <Surface
      elevation={3}
      blurRadius={BLUR}
      opacity={OPACITY}
      rim={true}
      rimWidth={RIM_WIDTH}
      intensity={RIM_INTENSITY}
      borderRadius={16}
      className="flex-1"
      style={{ height: 32 }}
    >
      <View className="flex-1 flex-row items-center gap-2 px-3">
        <SearchLine size={16} color="muted-foreground" />
        <TextInput
          placeholder="Search"
          placeholderTextColor={placeholder}
          className="flex-1 bg-transparent text-foreground text-sm outline-none"
        />
      </View>
    </Surface>
  );
}

/** A phone-sized frame whose frosted header blurs the colourful feed scrolling behind it. */
function MobileHeaderDemo() {
  return (
    <View style={{ alignItems: 'center', padding: 32, backgroundColor: '#0d0d0f' }}>
      <View className="relative overflow-hidden bg-background" style={{ width: 390, height: 720, borderRadius: 40 }}>
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 16, paddingTop: 72, gap: 12 }}
          showsVerticalScrollIndicator={false}
        >
          <View style={{ height: 140, borderRadius: 20, backgroundColor: '#6366f1' }} />
          <Text weight="semibold" className="text-foreground text-sm">
            Colour grid
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
            {PALETTE.map((color) => (
              <View
                key={color}
                style={{ width: '48%', height: 96, borderRadius: 16, backgroundColor: color, marginBottom: 12 }}
              />
            ))}
          </View>
          <View style={{ height: 64, borderRadius: 16, backgroundColor: '#10b981' }} />
          <View style={{ height: 64, borderRadius: 16, backgroundColor: '#f59e0b' }} />
        </ScrollView>

        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 10,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            paddingHorizontal: 12,
            paddingVertical: 12,
          }}
        >
          <IconButton
            icon={MenuLine}
            accessibilityLabel="Menu"
            size="md"
            shape="pill"
            blurRadius={BLUR}
            opacity={OPACITY}
            rim={true}
            rimWidth={RIM_WIDTH}
            intensity={RIM_INTENSITY}
          />
          <GlassSearchBar />
          <IconButton
            icon={GridLine}
            accessibilityLabel="Grid"
            size="md"
            shape="pill"
            blurRadius={BLUR}
            opacity={OPACITY}
            rim={true}
            rimWidth={RIM_WIDTH}
            intensity={RIM_INTENSITY}
          />
        </View>
      </View>
    </View>
  );
}

export const MobileHeader: StoryObj = {
  render: () => <MobileHeaderDemo />,
};
