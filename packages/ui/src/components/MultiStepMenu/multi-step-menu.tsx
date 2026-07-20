import {
  createContext,
  type ReactNode,
  type RefObject,
  useCallback,
  useContext,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { type LayoutChangeEvent, Pressable, type PressableProps, ScrollView, Text, View } from 'react-native';
import { ChevronRight, type IconProps, X } from '../../lib/icons';
import { MotiView } from '../../moti/components/view';
import { AnimatePresence } from '../../moti/presence/animate-presence';
import { TextCascade } from '../TextCascade/text-cascade';
import { TextRolling } from '../TextRolling/text-rolling';

const SLIDE_TRANSITION = { type: 'spring', damping: 28, stiffness: 260, mass: 0.9 } as const;
const ARROW_TRANSITION = { type: 'timing', duration: 300, opacity: { type: 'timing', duration: 200 } } as const;
const ARROW_EXIT_TRANSITION = { type: 'timing', duration: 300, opacity: { type: 'timing', duration: 200 } } as const;

const MultiStepMenuContext = createContext<MultiStepHelpers | null>(null);

function resolveSection(sections: MultiStepSection[], path: string[]): MultiStepSection | null {
  let nodes = sections;
  let match: MultiStepSection | null = null;
  for (const segment of path) {
    const found = nodes.find((s) => s.path === segment);
    if (!found) return null;
    match = found;
    nodes = found.subsections ?? [];
  }
  return match;
}

function computeDirection(current: string[], next: string[]): 'forward' | 'backward' {
  if (next.length > current.length) return 'forward';
  if (next.length < current.length) return 'backward';
  return 'forward';
}

/** A component accepting at least `size` and `color` — compatible with this project's icon set. */
type IconRenderer = (props: IconProps) => ReactNode;

export type MultiStepDirection = 'forward' | 'backward' | null;

/** Helpers handed to every render prop and exposed via {@link useMultiStepMenu}. */
export type MultiStepHelpers = {
  /** A single segment navigates into a child of the current node; an array sets an absolute path. */
  navigate: (target: string | string[]) => void;
  goBack: () => void;
  /** Goes back after a short delay (e.g. to let a success state show first). */
  goBackAfterTimeout: () => ReturnType<typeof setTimeout>;
  close: () => void;
  path: string[];
  isWideScreen: boolean;
};

export type MultiStepSection = {
  /** One path segment, unique among its siblings. */
  path: string;
  title?: string;
  render: (helpers: MultiStepHelpers) => ReactNode;
  subsections?: MultiStepSection[];
};

export type MultiStepMenuHandle = {
  navigate: (target: string | string[]) => void;
  goBack: () => void;
  reset: (path?: string[]) => void;
};

export type MenuRowProps = Omit<PressableProps, 'children'> & {
  icon: IconRenderer;
  label: ReactNode;
  active?: boolean;
  iconBackgroundColor: string;
};

/** iOS-style settings sidebar row with a coloured icon background and a subtle active highlight. */
export function MenuRow({ icon: RowIcon, label, active = false, iconBackgroundColor, className, ...props }: MenuRowProps) {
  const bgStyle = useMemo(() => ({ backgroundColor: iconBackgroundColor }), [iconBackgroundColor]);
  return (
    <Pressable
      // biome-ignore lint/nursery/useSortedClasses: dynamic base + conditional extension — cannot sort across template-literal segments
      className={`h-11 flex-row items-center gap-2 rounded-lg px-3${active ? ' bg-primary/75' : ''}${className ? ` ${String(className)}` : ''}`}
      {...props}
    >
      <View
        // biome-ignore lint/nursery/useSortedClasses: same reason
        className={`h-6.5 w-6.5 items-center justify-center rounded-md${active ? ' shadow-[0_0_2px_0.5px_rgb(0_0_0_/_0.20)]' : ''}`}
        style={bgStyle}
      >
        <RowIcon size={18} color="white" />
      </View>
      {/* biome-ignore lint/nursery/useSortedClasses: same reason */}
      <Text className={`text-base${active ? ' font-semibold text-white' : ' text-foreground'}`}>{label}</Text>
    </Pressable>
  );
}

/** Reads the navigation helpers from the nearest {@link MultiStepMenu}. Throws if used outside one. */
// biome-ignore lint/style/useComponentExportOnlyModules: hook intentionally co-located with its provider
export function useMultiStepMenu(): MultiStepHelpers {
  const helpers = useContext(MultiStepMenuContext);
  if (!helpers) throw new Error('useMultiStepMenu must be used within a MultiStepMenu');
  return helpers;
}

export type MultiStepMenuProps = {
  isWideScreen: boolean;
  onClose: () => void;
  sections: MultiStepSection[];
  /** Wide-screen left column. */
  sidebar: (helpers: MultiStepHelpers) => ReactNode;
  /** Small-screen depth-0 screen. */
  smallScreenMenu: (helpers: MultiStepHelpers) => ReactNode;
  rootTitle: string;
  /** Wide-screen initial selection (e.g. `['account']`). */
  defaultPath?: string[];
  /** Wide-screen right pane shown when no section is selected. */
  widePlaceholder?: ReactNode;
  /** Footer pinned to the bottom of the wide-screen sidebar. */
  sidebarFooter?: ReactNode;
  /** Called whenever the active path changes. */
  onPathChange?: (path: string[]) => void;
  ref?: RefObject<MultiStepMenuHandle | null>;
};

// biome-ignore lint/complexity/noExcessiveLinesPerFunction: same reason — wide and small layouts are tightly coupled to shared state
export const MultiStepMenu = function MultiStepMenu({
  isWideScreen,
  onClose,
  sections,
  sidebar,
  smallScreenMenu,
  rootTitle,
  defaultPath,
  widePlaceholder,
  sidebarFooter,
  onPathChange,
  ref,
}: MultiStepMenuProps) {
  const [path, setPath] = useState<string[]>(isWideScreen ? (defaultPath ?? []) : []);
  const [direction, setDirection] = useState<MultiStepDirection>(null);
  const [paneWidth, setPaneWidth] = useState(0);

  // Set-direction-then-commit: update direction first so the exiting pane re-renders with
  // the correct `exit` value before AnimatePresence removes it; commit the path in the
  // layout effect. The counter ensures consecutive navigations always fire.
  const pendingPath = useRef<string[] | null>(null);
  const [navTrigger, setNavTrigger] = useState(0);

  const onPathChangeRef = useRef(onPathChange);
  onPathChangeRef.current = onPathChange;

  // biome-ignore lint/correctness/useExhaustiveDependencies: navTrigger is the intentional trigger; pendingPath is a ref and does not need to be listed
  useLayoutEffect(() => {
    if (pendingPath.current !== null) {
      const next = pendingPath.current;
      pendingPath.current = null;
      setPath(next);
      onPathChangeRef.current?.(next);
    }
  }, [navTrigger]);

  const commit = useCallback((next: string[], nextDirection: MultiStepDirection) => {
    pendingPath.current = next;
    setDirection(nextDirection);
    setNavTrigger((v) => v + 1);
  }, []);

  const navigateTo = useCallback(
    (target: string | string[]) => {
      const next = Array.isArray(target) ? target : [...path, target];
      commit(next, computeDirection(path, next));
    },
    [path, commit],
  );

  const goBack = useCallback(() => {
    if (path.length === 0) return;
    commit(path.slice(0, -1), 'backward');
  }, [path, commit]);

  const goBackAfterTimeout = useCallback(() => setTimeout(goBack, 600), [goBack]);

  // When switching to wide screen with an empty path, adopt defaultPath so the sidebar
  // selection isn't lost on a layout change.
  const prevIsWideScreenRef = useRef(isWideScreen);
  // biome-ignore lint/plugin: responds to breakpoint flip — fires at the moment of change, not derivable from render state
  useEffect(() => {
    const prev = prevIsWideScreenRef.current;
    prevIsWideScreenRef.current = isWideScreen;
    if (isWideScreen && !prev && path.length === 0 && defaultPath?.length) {
      setPath(defaultPath);
      onPathChangeRef.current?.(defaultPath);
    }
  }, [isWideScreen, path, defaultPath]);

  const handleClose = useCallback(() => onClose(), [onClose]);

  const helpers: MultiStepHelpers = useMemo(
    () => ({ navigate: navigateTo, goBack, goBackAfterTimeout, close: handleClose, path, isWideScreen }),
    [navigateTo, goBack, goBackAfterTimeout, handleClose, path, isWideScreen],
  );

  const wrap = useCallback(
    (node: ReactNode) => <MultiStepMenuContext.Provider value={helpers}>{node}</MultiStepMenuContext.Provider>,
    [helpers],
  );

  const handlePaneLayout = useCallback((e: LayoutChangeEvent) => setPaneWidth(e.nativeEvent.layout.width), []);

  useImperativeHandle(ref, () => ({
    navigate: navigateTo,
    goBack,
    reset: (nextPath = []) => {
      pendingPath.current = null;
      setDirection(null);
      setPath(nextPath);
      onPathChangeRef.current?.(nextPath);
    },
  }));

  if (isWideScreen) {
    const effectivePath = path.length > 0 ? path : (defaultPath ?? []);
    const activeNode = effectivePath.length > 0 ? resolveSection(sections, effectivePath) : null;
    const showBack = path.length > 1;
    const title = activeNode?.title ?? rootTitle;

    return wrap(
      <View className="flex-1 flex-row overflow-hidden rounded-2xl border-2 border-border">
        <View className="w-56 justify-between border-border border-r-2 px-4 py-4 lg:w-64">
          <View className="min-h-0 flex-1">{sidebar(helpers)}</View>
          {sidebarFooter}
        </View>
        <View className="flex-1">
          <View className="flex-row items-center justify-between py-3 pl-6">
            <View className="flex-row items-center">
              <AnimatePresence>
                {showBack && (
                  <MotiView
                    key="wide-back"
                    className="overflow-hidden"
                    from={{ opacity: 0, width: 0, paddingRight: 0 }}
                    animate={{ opacity: 1, width: 32, paddingRight: 8 }}
                    exit={{ opacity: 0, width: 0, paddingRight: 0 }}
                    transition={ARROW_TRANSITION}
                    exitTransition={ARROW_EXIT_TRANSITION}
                  >
                    <Pressable onPress={goBack} accessibilityLabel="Back">
                      <View style={{ transform: [{ rotate: '180deg' }] }}>
                        <ChevronRight />
                      </View>
                    </Pressable>
                  </MotiView>
                )}
              </AnimatePresence>
              <TextRolling text={title} className="flex-1 font-medium text-foreground text-lg" />
            </View>
            <Pressable onPress={handleClose} accessibilityLabel="Close" hitSlop={8} className="py-3 pr-6 pl-3">
              <X />
            </Pressable>
          </View>
          {activeNode ? (
            <ScrollView className="min-h-0 flex-1" showsVerticalScrollIndicator={false} contentContainerClassName="px-6 pb-8">
              {activeNode.render(helpers)}
            </ScrollView>
          ) : (
            <View className="flex-1">{widePlaceholder}</View>
          )}
        </View>
      </View>,
    );
  }

  // ── Small screen ──
  const isRoot = path.length === 0;
  const activeNode = isRoot ? null : resolveSection(sections, path);
  const title = isRoot ? rootTitle : (activeNode?.title ?? rootTitle);
  const paneKey = isRoot ? '__root__' : path.join('/');

  const enterFrom = (() => {
    if (isRoot) return direction === 'backward' ? { translateX: -paneWidth } : false;
    return direction === 'backward' ? { translateX: -paneWidth } : { translateX: paneWidth };
  })();
  const exitTo = (() => {
    if (isRoot) return { translateX: -paneWidth };
    return direction === 'forward' ? { translateX: -paneWidth } : { translateX: paneWidth };
  })();

  return wrap(
    <View className="flex-1" onLayout={handlePaneLayout}>
      <View className="px-5 pt-6 pb-5">
        <View className="mb-2 flex-row items-center justify-between">
          <View className="w-9 items-start justify-center">
            <AnimatePresence>
              {!isRoot && (
                <MotiView
                  key="mobile-back"
                  from={{ opacity: 0, translateX: -8 }}
                  animate={{ opacity: 1, translateX: 0 }}
                  exit={{ opacity: 0, translateX: -8 }}
                  transition={ARROW_TRANSITION}
                  exitTransition={ARROW_EXIT_TRANSITION}
                >
                  <Pressable onPress={goBack} accessibilityLabel="Back">
                    <View style={{ transform: [{ rotate: '180deg' }] }}>
                      <ChevronRight />
                    </View>
                  </Pressable>
                </MotiView>
              )}
            </AnimatePresence>
          </View>
          <Pressable onPress={handleClose} accessibilityLabel="Close" hitSlop={8}>
            <X />
          </Pressable>
        </View>
        <TextCascade text={title} className="font-bold text-2xl text-foreground" />
      </View>
      <View className="flex-1 overflow-hidden">
        <AnimatePresence>
          <MotiView
            key={paneKey}
            from={enterFrom}
            animate={{ translateX: 0 }}
            exit={exitTo}
            transition={SLIDE_TRANSITION}
            className="absolute inset-0 px-5"
          >
            <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerClassName="pb-6">
              {isRoot ? smallScreenMenu(helpers) : activeNode?.render(helpers)}
            </ScrollView>
          </MotiView>
        </AnimatePresence>
      </View>
    </View>,
  );
};
