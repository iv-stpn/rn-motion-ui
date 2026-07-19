# @rn-motion-ui/rn

Animated React Native + React Native Web UI components, styled with [Tailwind](https://tailwindcss.com/) via [uniwind](https://github.com/nativewind/uniwind) and powered by the internal [@rn-motion-ui/moti](../moti/) / [Reanimated](https://docs.swmansion.com/react-native-reanimated/).

The components are written as React Native primitives, so they run on native (iOS/Android via Expo or bare RN) and on the web through `react-native-web`.

## Install

```sh
npm install @rn-motion-ui/rn
# or: bun add @rn-motion-ui/rn
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

Each component is a **subpath export** — import directly from the component's path:

```tsx
import { Button } from '@rn-motion-ui/rn/button';
import { Switch } from '@rn-motion-ui/rn/switch';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@rn-motion-ui/rn/tabs';

export function Example() {
  return (
    <Button variant="primary" size="md" onPress={() => {}}>
      Press me
    </Button>
  );
}
```

There is no barrel `index` export by design — this keeps bundlers from pulling in components you don't use.

## Available exports

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
| `/file-upload` | `FileUpload` |
| `/feedback-widget` | `FeedbackWidget` |
| `/prediction-market` | `PredictionMarket` |
| `/availability-scheduler` | `AvailabilityScheduler` |
| `/table` | `Table` |
| `/not-found` | `NotFound` |
| `/icons` | icon components |
| `/ease` | easing constants |
| `/use-in-view` | `useInView` |
| `/use-arm-on-view` | `useArmOnView` |
| `/use-page-visible` | `usePageVisible` |
| `/use-reduced-motion` | `useReducedMotion` |
| `/use-hover-capable` | `useHoverCapable` |
| `/use-interval` | `useInterval` |
| `/use-modal-render` | `useModalRender` |
| `/use-scramble` | `useScramble` |
| `/use-shake-animation` | `useShakeAnimation` |

## License

[MIT](./LICENSE) © Ivan Stepanian
