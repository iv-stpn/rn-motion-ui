---
"rn-motion-ui": minor
---

feat(hooks): export `useSafeInsets` at `rn-motion-ui/hooks/use-safe-insets`

The hook shipped in the source tree with the `safeArea` overlay work but was never added to the package's `exports` map, so consumers could not import it — `rn-motion-ui/hooks/use-safe-insets` resolved to nothing while every other hook was reachable.

It resolves device safe-area insets through `react-native-safe-area-context` when that optional peer is installed and a `<SafeAreaProvider>` is above in the tree, and returns zeros otherwise — the same resolution the overlay components use internally, now available for building your own full-screen surfaces.

```ts
import { useSafeInsets } from 'rn-motion-ui/hooks/use-safe-insets';
```
