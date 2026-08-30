---
'rn-motion-ui': minor
---

feat(Overlay): add `BlurProvider` and consolidate the blur peers on `@danielsaraldi/react-native-blur-view`

The overlay backdrop blur drops its two optional peers — `@sbaiahmed1/react-native-blur`
and `@react-native-community/blur` — for a single `@danielsaraldi/react-native-blur-view`.
On iOS its `BlurView` is a `UIVisualEffectView` that blurs behind itself, as before; on
Android the same `BlurView` blurs a `BlurTarget` it is pointed at rather than whatever
sits behind it.

A new `BlurProvider` (exported as `rn-motion-ui/overlay/blur-provider`) wraps the app
root, renders the `BlurTarget` around its children, and publishes the ref the scrims read.
Wrap the app root in `<BlurProvider>` and install `@danielsaraldi/react-native-blur-view`
to keep Android backdrop blur; without the provider — or the optional peer — Android
scrims degrade to the plain translucent dim.
