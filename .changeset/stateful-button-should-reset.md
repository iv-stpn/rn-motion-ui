---
"rn-motion-ui": minor
---

`StatefulButton`: external reset signal, `afterReset`, and `autoReset` → `shouldAutoReset`

**Breaking:** `autoReset` is renamed to `shouldAutoReset`. It keeps the same meaning — return to idle once the success/error window closes — and the same `false` default. Rename the prop at the call site; there is no deprecated alias.

**New `shouldReset`.** A reactive signal, not a mode: raise it and the button resets to idle immediately, wherever it happens to be. It is edge-triggered on the rise, so a parent that leaves it pinned `true` resets the button once rather than on every press — lower it and raise it again to reset again. Raising it on an idle button with nothing in flight does nothing.

A mid-flight reset takes effect at once instead of waiting for the pending action: the in-flight run is orphaned, so when its promise finally settles it neither shows its outcome nor opens a terminal window, and `afterSuccess` / `afterError` stay silent for that run.

**New `afterReset`.** Fires whenever a reset actually returns the button to idle, from either path — the `shouldReset` signal or the `shouldAutoReset` window end.

The two props answer different questions and compose: `shouldAutoReset` decides what happens when a run's terminal window ends, `shouldReset` lets the parent cut a run short at any point.

```tsx
const [resetSignal, setResetSignal] = useState(false);

<StatefulButton
  onPress={submit}
  shouldReset={resetSignal}
  afterReset={() => setResetSignal(false)}
/>
```
