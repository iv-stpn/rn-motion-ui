---
"rn-motion-ui": minor
---

**Breaking**: `rn-motion-ui/moti/progress` and `rn-motion-ui/moti/motify-svg` are gone.

Both came over with the Moti layer and neither earned its place. `MotiProgressBar`
was a progress bar with hardcoded hex defaults (`#333`, `#eee`, `#00C806`) that
answered to nothing in the token system, so it could not sit next to anything else
in this library without looking foreign. Nothing here rendered it.

```diff
-import { MotiProgressBar } from 'rn-motion-ui/moti/progress';
```

A bar is two views and a translate. If you were using it, the replacement is a
`MotiView` inside a clipping parent — which is all it ever was, minus the
re-render warnings:

```tsx
import { MotiView } from 'rn-motion-ui/moti/view';

<View className="h-3 w-full overflow-hidden rounded-full bg-muted">
  <MotiView
    className="h-full w-full rounded-full bg-primary"
    animate={{ translateX: `${Math.round(progress * 100) - 100}%` }}
    transition={{ type: 'timing', duration: 200 }}
  />
</View>
```

`motifySvg` was a second `motify` that wrote to `animatedProps` instead of `style`,
for animating SVG attributes like `r` or `strokeDashoffset` that are props rather
than styles. Every SVG animation in this package is written directly against
Reanimated's `useAnimatedProps` instead — `Loader`, `ScrollProgress`,
`AnimatedBadge`, `Checkbox`, `StarRating` — so the wrapper was carrying an API
surface no caller used.

```diff
-import { motifySvg } from 'rn-motion-ui/moti/motify-svg';
-const MotiCircle = motifySvg(Circle)();
+import Animated, { useAnimatedProps } from 'react-native-reanimated';
+import { Circle } from 'react-native-svg';
+const AnimatedCircle = Animated.createAnimatedComponent(Circle);
```

`react-native-svg` stays a peer dependency — the components above still need it.
