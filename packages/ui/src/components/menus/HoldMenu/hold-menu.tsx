// biome-ignore-all lint/performance/noBarrelFile: this file is the package entry point — the `./hold-menu` export is the public API, not a lazy barrel
/**
 * HoldMenu — a faithful, improved reimplementation of
 * [react-native-hold-menu](https://github.com/enesozturk/react-native-hold-menu)
 * (MIT, Enes Öztürk).
 *
 * Hold an item; it lifts off the page, the screen dims behind it, and an
 * iOS-style action panel grows out of the corner nearest it. The item model,
 * the provider/context architecture, the portal twin and the animation
 * constants are upstream's, field for field — with the modernizations and
 * fixes documented on each member:
 *
 * - **Reanimated 4 + RNGH v2 `Gesture` API** — no legacy
 *   `useAnimatedGestureHandler`, no old handler components.
 * - **Rotation-safe measurement** — window dimensions come from
 *   `useWindowDimensions` and are mirrored into shared values, never read from
 *   `Dimensions` at module scope.
 * - **Viewport/safe-area clamping** — the item+panel pair never leaves the
 *   safe area (residual overflow caps the panel, which scrolls), and the panel
 *   never runs off the screen horizontally.
 * - **Web support** — `'hold'` is a right-click (Shift+F10 / ContextMenu key
 *   included), tap activations keep the press, the children render once (no
 *   twin), and the dimmed backdrop closes the menu on click-outside.
 * - **Optional native deps that never break web bundles** — `expo-blur` and
 *   `expo-haptics` are optional peers, reached only through platform-split
 *   modules imported extensionless.
 * - **Accessibility** — rows carry labels and a button role, the backdrop is
 *   reachable, and reduced motion collapses every animation to a cross-fade.
 *
 * The successor to `HoldContextMenu` (which stays in the package, untouched —
 * this family is a parallel, faithful port of the upstream API).
 *
 * @example
 * ```tsx
 * <HoldMenuProvider iconComponent={IconByName} safeAreaInsets={insets}>
 *   <HoldItem
 *     items={[
 *       { text: 'Reply', icon: 'chat', onPress: (id) => reply(id) },
 *       { text: 'Copy', icon: 'copy', onPress: (body) => copy(body), withSeparator: true },
 *      { text: 'Delete', icon: 'trash', isDestructive: true, onPress: (id) => remove(id) },
 *     ]}
 *     actionParams={{ Reply: [message.id], Copy: [message.body], Delete: [message.id] }}
 *   >
 *     <MessageBubble message={message} />
 *   </HoldItem>
 * </HoldMenuProvider>
 * ```
 */

export { HoldItem } from './hold-item';
export { HoldMenuFlatList, type HoldMenuFlatListProps } from './hold-menu-flat-list';
export { HoldMenuIcon } from './hold-menu-icon';
export type { TransformOriginAnchorPosition } from './hold-menu-layout';
export { HoldMenuProvider } from './hold-menu-provider';
export type {
  HoldItemProps,
  HoldMenuIconComponent,
  HoldMenuIconComponentProps,
  HoldMenuProviderProps,
  MenuItemProps,
} from './hold-menu-types';
