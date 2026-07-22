# rn-motion-ui

Animated React Native + React Native Web UI components, styled with [Tailwind](https://tailwindcss.com/) via [uniwind](https://github.com/nativewind/uniwind) and powered by an in-package Moti / [Reanimated](https://docs.swmansion.com/react-native-reanimated/) 4 layer.

The components are written as React Native primitives, so they run on native (iOS/Android via Expo or bare RN) and on the web through `react-native-web`.

## Install

```sh
npm install rn-motion-ui
# or: bun add rn-motion-ui
```

### Peer dependencies

Install these in your app (they are not bundled):

```sh
npm install react react-native react-native-reanimated react-native-gesture-handler
```

| Peer | Supported range |
| --- | --- |
| `react` | `>=18.0.0` |
| `react-native` | `>=0.76.0` |
| `react-native-reanimated` | `>=4.0.0` |
| `react-native-gesture-handler` | `>=2.0.0` |

## Consumer setup

This package **ships TypeScript source** (no prebuilt bundle). Your bundler already transpiles your own app code, so it will transpile these components the same way — but two build-time plugins are required for the components to work correctly:

1. **`react-native-reanimated/plugin`** (Babel) — transforms Reanimated worklets. Without it, easing/animation worklets throw at runtime.
2. **`uniwind`** — resolves the `className` props on RN components to styles at build time. Without it, `className` is ignored.

### Native (Expo / Metro)

`babel.config.js`:

```js
module.exports = {
  presets: ['babel-preset-expo'],
  plugins: ['react-native-reanimated/plugin'],
};
```

Set up `uniwind` per its docs (Metro transformer + a `global.css` Tailwind entry).

### Web (Vite / react-native-web)

Alias `react-native` → `react-native-web`, run the Reanimated Babel plugin through your React transform, and add the `uniwind` Vite plugin. See this repo's `storybook/web/.storybook/main.ts` for a working reference config.

## Usage

Every module is a **subpath export** — import directly from its path. There is no barrel `index` export by design, so bundlers only pull in what you import.

```tsx
import { Button } from 'rn-motion-ui/button';
import { Switch } from 'rn-motion-ui/switch';
import { Tabs, TabsList, TabsTrigger, TabsContent } from 'rn-motion-ui/tabs';
import { useReducedMotion } from 'rn-motion-ui/hooks/use-reduced-motion';
import { MotiView } from 'rn-motion-ui/moti/view';
import { AnimatePresence } from 'rn-motion-ui/moti/presence';
import { hasKey } from 'rn-motion-ui/utils/typeguards';
```

## Available exports

Subpaths are namespaced by category:

- **UI components** — flat, e.g. `rn-motion-ui/button`, `rn-motion-ui/tabs`, `rn-motion-ui/bottom-sheet`, …
- **Hooks** — `rn-motion-ui/hooks/<name>` (`use-reduced-motion`, `use-mount-effect`, `use-in-view`, …)
- **Moti primitives** — `rn-motion-ui/moti/<name>` (`view`, `text`, `motify`, `presence`, `pressable`, …)
- **Utils** — `rn-motion-ui/utils/typeguards`

### UI components

| Subpath | Component / hook |
| --- | --- |
| `/button` | `Button` |
| `/stateful-button` | `StatefulButton` |
| `/switch` | `Switch` |
| `/checkbox` | `Checkbox` |
| `/radio` | `Radio` |
| `/input` | `Input` |
| `/tabs` | `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` |
| `/loader` | `Loader` |
| `/animated-badge` | `AnimatedBadge` |
| `/animated-number` | `AnimatedNumber` |
| `/number-ticker` | `NumberTicker` |
| `/text-cascade` | `TextCascade` |
| `/text-reveal` | `TextReveal` |
| `/text-rolling` | `TextRolling` |
| `/text-shimmer` | `TextShimmer` |
| `/marquee` | `Marquee` |
| `/scroll-reveal` | `ScrollReveal` |
| `/scroll-progress` | `ScrollProgress` |
| `/scroll-to` | `ScrollTo` |
| `/smooth-scroll` | `SmoothScroll` |
| `/dock` | `Dock` |
| `/popover` | `Popover` |
| `/drawer` | `Drawer` |
| `/bottom-sheet` | `BottomSheet` |
| `/full-sheet` | `FullSheet` |
| `/morphing-modal` | `MorphingModal` |
| `/action-feedback-modal` | `ActionFeedbackModal` |
| `/adaptive-dropdown` | `AdaptiveDropdown` |
| `/multi-step-menu` | `MultiStepMenu` |
| `/bloom-menu` | `BloomMenu` |
| `/hover-menu` | `HoverMenu` |
| `/overflow-actions` | `OverflowActions` |
| `/bouncy-accordion` | `BouncyAccordion` |
| `/dynamic-island` | `DynamicIsland` |
| `/action-swap` | `ActionSwap` |
| `/swipeable-list` | `SwipeableList` |
| `/range-slider` | `RangeSlider` |
| `/cylinder-carousel` | `CylinderCarousel` |
| `/wheel-picker` | `WheelPicker` |
| `/command-palette` | `CommandPalette` |
| `/otp-input` | `OtpInput` |
| `/feedback-widget` | `FeedbackWidget` |
| `/availability-scheduler` | `AvailabilityScheduler` |
| `/table` | `Table` |
| `/not-found` | `NotFound` |
| `/icons` | icon components |
| `/ease` | easing constants |
| `/tokens.css` | design token stylesheet |
| `/theme/use-theme-color` | `useThemeColor`, `useThemeColors` |

## Theming

### Design tokens

The library ships a canonical Tailwind token sheet that you import once in your app's global CSS:

```css
@import "tailwindcss";
@import "rn-motion-ui/tokens.css";
```

This registers 13 semantic color tokens as Tailwind CSS utilities (`bg-primary`, `text-foreground`, `border-border`, …) and applies automatic dark-mode overrides via `@media (prefers-color-scheme: dark)`.

#### Token reference

| Token | Light | Dark | Usage |
| --- | --- | --- | --- |
| `surface` | `oklch(99% 0 0)` | `oklch(9% 0 0)` | Page / screen background |
| `foreground` | `oklch(15% 0 0)` | `oklch(96% 0 0)` | Default text |
| `card` | `oklch(97% 0 0)` | `oklch(13% 0 0)` | Card / panel surfaces |
| `muted` | `oklch(97% 0 0)` | `oklch(16% 0 0)` | Subtle backgrounds |
| `muted-foreground` | `oklch(50% 0 0)` | `oklch(60% 0 0)` | Secondary / placeholder text |
| `border` | `oklch(15% 0 0 / 0.06)` | `oklch(99% 0 0 / 0.08)` | Dividers and outlines |
| `primary` | `oklch(15% 0 0)` | `oklch(96% 0 0)` | Primary actions / fills |
| `primary-foreground` | `oklch(99% 0 0)` | `oklch(15% 0 0)` | Text on primary |
| `secondary` | `oklch(97% 0 0)` | `oklch(18% 0 0)` | Secondary fills |
| `secondary-foreground` | `oklch(15% 0 0)` | `oklch(96% 0 0)` | Text on secondary |
| `destructive` | `oklch(62% 0.22 25)` | `oklch(66% 0.22 25)` | Error / danger states |
| `success` | `oklch(70% 0.18 155)` | `oklch(72% 0.18 155)` | Success states |
| `warning` | `oklch(78% 0.18 75)` | `oklch(80% 0.18 75)` | Warning states |

#### Overriding tokens

Add a `@theme` block after the import to override any token for your brand:

```css
@import "rn-motion-ui/tokens.css";

@theme {
  /* Brand blue as primary */
  --color-primary:            oklch(52% 0.22 250);
  --color-primary-foreground: oklch(99% 0 0);
}
```

For manual dark mode (`.dark` class on `<html>` instead of `prefers-color-scheme`):

```css
@import "rn-motion-ui/tokens.css";

/* tokens.css already handles system dark-mode; add .dark support too: */
@layer base {
  .dark {
    --color-primary: oklch(70% 0.22 250);
  }
}
```

### Animated and SVG colors — `useThemeColor`

Reanimated worklets and `react-native-svg` props require resolved color strings, not CSS utility classes. Use `useThemeColor` to read the current token value at runtime:

```tsx
import { useThemeColor } from 'rn-motion-ui/theme/use-theme-color';
import { useAnimatedStyle } from 'react-native-reanimated';

function Spinner() {
  const color = useThemeColor('primary');
  const style = useAnimatedStyle(() => ({ borderColor: color }));
  return <Animated.View style={[styles.ring, style]} />;
}
```

On **web** it reads the live CSS custom property (`--color-primary`) so consumer `@theme` overrides are automatically respected. On **native** it uses `useColorScheme()` to select from the static light/dark maps, matching the values in `tokens.css` with no provider required.

Use `useThemeColors()` when you need several tokens at once:

```tsx
import { useThemeColors } from 'rn-motion-ui/theme/use-theme-color';

const { primary, destructive, success } = useThemeColors();
```

## License

[MIT](./LICENSE) © Ivan Stepanian
