import { AnimatePresence, MotiView } from 'moti';
import {
  Children,
  createContext,
  isValidElement,
  type ReactElement,
  type ReactNode,
  useCallback,
  useContext,
  useState,
} from 'react';
import { type LayoutChangeEvent, type StyleProp, View, type ViewStyle } from 'react-native';
import { useReducedMotion } from '../../hooks/use-reduced-motion';

type Size = { width: number; height: number };

// RN FALLBACK vs web: the web island animates real width/height to a
// ResizeObserver-measured content size and blurs content in/out with a CSS
// `filter`. RN has no blur filter, so the blur is dropped; the shell springs its
// width/height to the natural size of an offscreen measurer (onLayout) and the
// active slot swaps with a scale/opacity/translate spring (AnimatePresence).
type IslandContextValue = { view: string | null };
const IslandContext = createContext<IslandContextValue | null>(null);

// Pill dimensions used before the content has been measured (iPhone pill ~126x37).
const PILL_WIDTH = 126;
const PILL_HEIGHT = 37;
const RADIUS = 32;

// Shell reads as one long, barely-bouncy glide (web: duration 0.8 / bounce 0.2).
const SHELL_SPRING = { type: 'spring', stiffness: 200, damping: 24, mass: 1 } as const;
// Content gets a touch more life than the shell (web: bounce 0.35).
const CONTENT_SPRING = { type: 'spring', stiffness: 260, damping: 22, mass: 0.9 } as const;

// biome-ignore lint/style/useExportsLast: props type before internal Slot helper — collocated for readability
export type DynamicIslandProps = {
  /** Active view id. `null` shows the compact pill. */
  view: string | null;
  /** Compact pill content, shown when no view is active. */
  compact?: ReactNode;
  /** DynamicIslandView elements. */
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  testID?: string;
};

function Slot({ keyId, children, className, width }: { keyId: string; children: ReactNode; className?: string; width?: number }) {
  const reduce = useReducedMotion();
  return (
    <MotiView
      key={keyId}
      from={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.9, translateY: -8 }}
      animate={{ opacity: 1, scale: 1, translateY: 0 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.9, translateY: -6 }}
      transition={reduce ? { type: 'timing', duration: 150 } : CONTENT_SPRING}
      className={className}
      // Fixed measured width keeps the row from reflowing while the shell springs.
      style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', width }}
    >
      {children}
    </MotiView>
  );
}

export function DynamicIsland({ view, compact, children, style, accessibilityLabel, testID }: DynamicIslandProps) {
  const reduce = useReducedMotion();
  const [size, setSize] = useState<Size | null>(null);
  const expanded = view !== null;

  const onMeasure = useCallback(
    (e: LayoutChangeEvent) => setSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height }),
    [],
  );

  // Walk children to find the active view's content + className (declarative API).
  const views = Children.toArray(children).filter(
    (c): c is ReactElement<DynamicIslandViewProps> => isValidElement(c) && c.type === DynamicIslandView,
  );
  const activeView = views.find((v) => v.props.id === view);

  const compactClass = 'gap-2 px-4 py-1.5';
  const activeContent = expanded ? activeView?.props.children : compact;
  const activeClass = expanded ? activeView?.props.className : compactClass;
  const slotKey = expanded ? (view ?? 'view') : 'compact';

  return (
    <IslandContext.Provider value={{ view }}>
      <MotiView
        accessibilityRole="text"
        accessibilityLabel={accessibilityLabel}
        accessibilityLiveRegion="polite"
        testID={testID}
        animate={size ? { width: size.width, height: size.height } : { width: PILL_WIDTH, height: PILL_HEIGHT }}
        transition={reduce ? { type: 'timing', duration: 0 } : SHELL_SPRING}
        className="items-center justify-start overflow-hidden bg-foreground"
        style={[{ borderRadius: RADIUS }, style]}
      >
        {/* Offscreen measurer: renders the active content at natural size so the
            shell has an explicit target to spring toward. */}
        <View pointerEvents="none" onLayout={onMeasure} style={{ position: 'absolute', top: 0, left: 0, opacity: 0 }}>
          <View className={activeClass} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
            {activeContent}
          </View>
        </View>
        <AnimatePresence>
          {activeContent === null ? null : (
            <Slot key={slotKey} keyId={slotKey} className={activeClass} width={size?.width}>
              {activeContent}
            </Slot>
          )}
        </AnimatePresence>
      </MotiView>
    </IslandContext.Provider>
  );
}

export type DynamicIslandViewProps = {
  /** Matches the parent `view` prop when active. */
  id: string;
  children: ReactNode;
  className?: string;
};

/**
 * Declarative descriptor consumed by <DynamicIsland>: the parent reads its
 * `id`/`children`/`className` to render + measure the active view, so this
 * renders nothing on its own. Kept as a component for the web-parity API.
 */
export function DynamicIslandView(_props: DynamicIslandViewProps) {
  const ctx = useContext(IslandContext);
  if (!ctx) throw new Error('DynamicIslandView must be used inside <DynamicIsland>');
  return null;
}
