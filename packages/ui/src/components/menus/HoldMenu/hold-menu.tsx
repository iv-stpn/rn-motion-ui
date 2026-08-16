// biome-ignore-all lint/performance/noBarrelFile: this file is the package entry point — the `./hold-menu` export is the public API, not a lazy barrel
/**
 * HoldMenu — a faithful port of
 * [react-native-hold-menu](https://github.com/enesozturk/react-native-hold-menu)
 * (MIT, Enes Öztürk, v0.1.6).
 *
 * Hold an item; it lifts off the page, the screen dims behind it, and an
 * iOS-style action panel grows out of the corner nearest it. The item model,
 * the provider/context architecture, the portal twin and the styling are
 * upstream's, field for field — with these deliberate departures:
 *
 * - **RNGH v2 `Gesture` API** — no legacy `useAnimatedGestureHandler`, no old
 *   `TapGestureHandler` / `LongPressGestureHandler` components.
 * - **Reanimated 4** — `useSharedValue` / `useAnimatedStyle` /
 *   `useAnimatedProps` / `useAnimatedReaction` / `useAnimatedRef` + `measure`
 *   throughout.
 * - **The package's internal `Portal`** in place of `@gorhom/portal`.
 * - **Rotation-safe window metrics** — a `useWindowDimensions`-fed shared value
 *   replaces upstream's module-level `Dimensions` reads.
 * - **Clamped placement** — travel and the panel's left are clamped into the
 *   safe viewport and a too-tall panel scrolls (upstream lets both overflow).
 * - **DOM-event activation on web** — web opens the menu through a right-click
 *   (`contextmenu`) or a plain click rather than RNGH gestures, but the lift —
 *   the portal twin, the squeeze, and the travel — still happens there.
 * - **No blur** — the backdrop is a plain opacity-faded scrim (a full-screen
 *   expo-blur `BlurView` blocks the UI thread on first reveal, so it is dropped).
 *
 * The successor to `HoldMenu` (which stays in the package, untouched).
 *
 * @example
 * ```tsx
 * <HoldMenuProvider iconComponent={IconByName} safeAreaInsets={insets}>
 *   <HoldItem
 *     items={[
 *       { text: 'Reply', icon: 'chat', onPress: (id) => reply(id) },
 *       { text: 'Copy', icon: 'copy', onPress: (body) => copy(body), withSeparator: true },
 *       { text: 'Delete', icon: 'trash', isDestructive: true, onPress: (id) => remove(id) },
 *     ]}
 *     actionParams={{ Reply: [message.id], Copy: [message.body], Delete: [message.id] }}
 *   >
 *     <MessageBubble message={message} />
 *   </HoldItem>
 * </HoldMenuProvider>
 * ```
 */

export { HoldItem } from './hold-item';
export type {
  HoldItemProps,
  HoldMenuIconComponent,
  HoldMenuIconComponentProps,
  HoldMenuProviderProps,
  HoldMenuSafeAreaInsets,
  MenuItemProps,
  TransformOriginAnchorPosition,
} from './hold-menu-types';
export { HoldMenuIcon } from './icon';
export { HoldMenuProvider } from './provider';
