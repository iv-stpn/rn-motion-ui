// biome-ignore-all lint/style/noExcessiveLinesPerFile: complex component
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
import { type LayoutChangeEvent, Pressable, type PressableProps, ScrollView, View } from 'react-native';
import { Easing } from 'react-native-reanimated';
import { RightLine as ChevronRight } from 'rn-motion-ui-icons/icons/right-line';
import { useReducedMotion } from '../../../hooks/use-reduced-motion';
import { MotiView } from '../../../moti/components/view';
import { AnimatePresence } from '../../../moti/presence/animate-presence';
import { MenuItem, type MenuItemIcon } from '../../rows/menu-item';
import { TextRolling } from '../../typography/TextRolling/text-rolling';
import { AdaptiveModal, type WidePanelSize } from '../AdaptiveModal/adaptive-modal';
import { CloseButton } from '../CloseButton/close-button';

// Linear, not a spring or eased tween: the pane swap is two layers held a full
// pane height apart, so a constant rate reads as one strip of pages rolling
// past a window. A spring (or any ease) reads as a hand that speeds up and
// slows down — the "staggers, then moves at the end" feel.
const SLIDE_TRANSITION = { type: 'timing' as const, duration: 280, easing: Easing.linear };
// Exiting deeper-menu content fades almost instantly: the slide/roll still runs
// its full course, but the rows vanish early instead of lingering at full opacity.
const SLIDE_EXIT_TRANSITION = {
  type: 'timing' as const,
  duration: 280,
  easing: Easing.linear,
  opacity: { type: 'timing' as const, duration: 100 },
} as const;
const ARROW_TRANSITION = { type: 'timing', duration: 300, opacity: { type: 'timing', duration: 200 } } as const;
const ARROW_EXIT_TRANSITION = { type: 'timing', duration: 300, opacity: { type: 'timing', duration: 200 } } as const;
// The header title rolls ±12px on enter/exit; the content's back-to-root roll
// mirrors it so the two move in lockstep instead of the content sliding sideways.
const TITLE_ROLL = 12;

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
  icon: MenuItemIcon;
  label: ReactNode;
  active?: boolean;
  iconBackgroundColor: string;
  /**
   * Stroke color passed to the icon. Defaults to `'white'` — the correct
   * foreground for the vivid/saturated fills this row is designed for (iOS-style
   * coloured icon squares). Override when `iconBackgroundColor` is a pale or
   * neutral fill that needs a darker icon to stay legible.
   */
  iconColor?: string;
};

/** iOS-style settings sidebar row with a coloured icon background and a subtle active highlight. */
export function MenuRow({ icon, label, active = false, iconBackgroundColor, iconColor = 'white', ...props }: MenuRowProps) {
  return (
    <MenuItem
      icon={icon}
      label={label}
      active={active}
      iconBackgroundColor={iconBackgroundColor}
      iconColor={iconColor}
      {...props}
    />
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
  visible: boolean;
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
  /** Called after the close animation fully completes (e.g. to reset navigation). */
  onAfterClose?: () => void;
  /** Static size for the wide-screen centered panel (largeScreenMode="modal"). */
  widePanelSize?: WidePanelSize;
  ref?: RefObject<MultiStepMenuHandle | null>;
  testID?: string;
  /** When false, the dimming backdrop is not rendered. Defaults to true. */
  overlay?: boolean;
  /** When false, pressing outside the menu will not close it. Defaults to true. */
  closeOnOutsidePress?: boolean;
};

// biome-ignore lint/complexity/noExcessiveLinesPerFunction: same reason — wide and small layouts are tightly coupled to shared state
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: same reason
export const MultiStepMenu = function MultiStepMenu({
  isWideScreen,
  visible,
  onClose,
  sections,
  sidebar,
  smallScreenMenu,
  rootTitle,
  defaultPath,
  widePlaceholder,
  sidebarFooter,
  onPathChange,
  onAfterClose,
  widePanelSize,
  ref,
  testID,
  overlay = true,
  closeOnOutsidePress = true,
}: MultiStepMenuProps) {
  const [path, setPath] = useState<string[]>(isWideScreen ? (defaultPath ?? []) : []);
  const [direction, setDirection] = useState<MultiStepDirection>(null);
  const [paneWidth, setPaneWidth] = useState(0);
  const [widePaneWidth, setWidePaneWidth] = useState(0);
  // The below-the-header title's natural height (text-2xl line ≈ 32px; a
  // wrapped title measures taller). Animated on enter/exit so the header
  // grows/collapses smoothly instead of snapping the pane area.
  const [titleSlotHeight, setTitleSlotHeight] = useState(32);
  const reduced = useReducedMotion();

  const slideTransition = reduced ? { type: 'timing' as const, duration: 160 } : SLIDE_TRANSITION;
  const slideExitTransition = reduced
    ? { type: 'timing' as const, duration: 160, opacity: { type: 'timing' as const, duration: 80 } }
    : SLIDE_EXIT_TRANSITION;
  const arrowTransition = reduced
    ? { type: 'timing' as const, duration: 160, opacity: { type: 'timing' as const, duration: 100 } }
    : ARROW_TRANSITION;
  const arrowExitTransition = reduced
    ? { type: 'timing' as const, duration: 160, opacity: { type: 'timing' as const, duration: 100 } }
    : ARROW_EXIT_TRANSITION;

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
  const handleWidePaneLayout = useCallback((e: LayoutChangeEvent) => setWidePaneWidth(e.nativeEvent.layout.width), []);
  const handleTitleSlotLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const height = e.nativeEvent.layout.height;
      if (height > 0 && height !== titleSlotHeight) setTitleSlotHeight(height);
    },
    [titleSlotHeight],
  );

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

  let content: ReactNode;
  if (isWideScreen) {
    const effectivePath = path.length > 0 ? path : (defaultPath ?? []);
    const activeNode = effectivePath.length > 0 ? resolveSection(sections, effectivePath) : null;
    const showBack = path.length > 1;
    const title = activeNode?.title ?? rootTitle;

    // The content below the title slides HORIZONTALLY, tracking the sidebar
    // selection instead of swapping in one step. `direction` is committed before
    // the path (set-direction-then-commit), so the exiting pane renders its
    // correct `exit` value and the entering pane its `from` on the same render pass.
    const widePaneKey = effectivePath.length > 0 ? effectivePath.join('/') : '__root__';
    const wideEnterFrom = (() => {
      if (!direction) return false;
      return direction === 'backward' ? { translateX: -widePaneWidth } : { translateX: widePaneWidth };
    })();
    const wideExitTo = direction === 'forward' ? { translateX: -widePaneWidth } : { translateX: widePaneWidth };

    content = (
      <View className="flex-1 flex-row overflow-hidden rounded-modal">
        <View className="w-56 justify-between border-border border-r p-3 lg:w-64">
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
                    transition={arrowTransition}
                    exitTransition={arrowExitTransition}
                  >
                    <Pressable onPress={goBack} accessibilityLabel="Back">
                      <View className="rotate-180">
                        <ChevronRight />
                      </View>
                    </Pressable>
                  </MotiView>
                )}
              </AnimatePresence>
              <TextRolling text={title} weight="medium" className="flex-1 text-foreground text-lg" />
            </View>
            <CloseButton className="absolute top-2 right-2" onPress={handleClose} />
          </View>
          <View className="min-h-0 flex-1 overflow-hidden" onLayout={handleWidePaneLayout}>
            <AnimatePresence>
              <MotiView
                key={widePaneKey}
                from={wideEnterFrom}
                animate={{ translateX: 0 }}
                exit={wideExitTo}
                transition={slideTransition}
                className="absolute inset-0"
              >
                {activeNode ? (
                  <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerClassName="px-6 pb-8">
                    {activeNode.render(helpers)}
                  </ScrollView>
                ) : (
                  <View className="flex-1">{widePlaceholder}</View>
                )}
              </MotiView>
            </AnimatePresence>
          </View>
        </View>
      </View>
    );
  } else {
    // ── Small screen ──
    const isRoot = path.length === 0;
    const activeNode = isRoot ? null : resolveSection(sections, path);
    const title = isRoot ? rootTitle : (activeNode?.title ?? rootTitle);
    const paneKey = isRoot ? '__root__' : path.join('/');

    // Content panes slide HORIZONTALLY like tabs, with two small-screen exceptions:
    // - Navigating BACK to the root (no back caret) rolls the content up alongside
    //   the title instead of sliding sideways.
    // - Navigating FORWARD from the root into the first layer fades it in with
    //   opacity — there's no parent pane to slide against, so a slide reads as a
    //   jump in from off-screen.
    //
    // `enterFrom`/`animateTo` describe the pane ENTERING (the new path), while
    // `exitTo` describes the pane EXITING (the old path). The set-direction-then-
    // commit flow commits `direction` before `path`, so each is evaluated against
    // the path it actually applies to: `isFirstLayer` means the exiting depth-1
    // pane on the way back to root, or the entering depth-1 pane coming from root.
    const isForward = direction === 'forward';
    const isBackward = direction === 'backward';
    const isFirstLayer = path.length === 1;
    const enterFrom = (() => {
      if (isRoot) return isBackward ? { translateY: TITLE_ROLL } : false;
      if (isForward && isFirstLayer) return { opacity: 0 };
      return isBackward ? { translateX: -paneWidth } : { translateX: paneWidth };
    })();
    const exitTo = (() => {
      if (isRoot) return isForward ? { opacity: 0 } : { translateX: -paneWidth };
      if (isBackward) return isFirstLayer ? { translateY: -TITLE_ROLL, opacity: 0 } : { translateX: paneWidth, opacity: 0 };
      return { translateX: -paneWidth, opacity: 0 };
    })();
    const animateTo = (() => {
      if (isRoot && isBackward) return { translateY: 0 };
      if (isForward && isFirstLayer) return { opacity: 1 };
      return { translateX: 0 };
    })();
    // Deeper menus fade their content out almost instantly on exit; the root's
    // forward exit stays a slower cross-fade against the entering first layer.
    const exitTransition = isRoot ? slideTransition : slideExitTransition;

    content = (
      <View className="flex-1" onLayout={handlePaneLayout}>
        <View className="px-5 pt-6 pb-5">
          <View className="flex-row items-center justify-between">
            {/* The back button is ABSOLUTE inside the relative slot: it overlays
                the title's top-left spot instead of taking layout space, so the
                root title is never pushed right when it appears — the title only
                rolls DOWN (its exit translateY) into the below-the-header slot. */}
            <View className="relative flex-1 flex-row items-center">
              <AnimatePresence>
                {!isRoot && (
                  <MotiView
                    key="mobile-back"
                    className="absolute left-0"
                    from={{ opacity: 0, translateX: -8 }}
                    animate={{ opacity: 1, translateX: 0 }}
                    exit={{ opacity: 0, translateX: -8 }}
                    transition={arrowTransition}
                    exitTransition={arrowExitTransition}
                  >
                    <Pressable onPress={goBack} accessibilityLabel="Back">
                      <View className="rotate-180">
                        <ChevronRight />
                      </View>
                    </Pressable>
                  </MotiView>
                )}
              </AnimatePresence>
              <AnimatePresence>
                {isRoot && (
                  <MotiView
                    key="mobile-title-top"
                    from={{ opacity: 0, translateY: TITLE_ROLL }}
                    animate={{ opacity: 1, translateY: 0 }}
                    exit={{ opacity: 0, translateY: TITLE_ROLL }}
                    transition={arrowTransition}
                    exitTransition={arrowExitTransition}
                  >
                    <TextRolling text={title} weight="bold" className="text-2xl text-foreground" />
                  </MotiView>
                )}
              </AnimatePresence>
            </View>
            <CloseButton onPress={handleClose} />
          </View>
          <AnimatePresence>
            {!isRoot && (
              <MotiView
                key="mobile-title-below"
                from={{ opacity: 0, translateY: -TITLE_ROLL, height: 0, marginTop: 0 }}
                animate={{ opacity: 1, translateY: 0, height: titleSlotHeight, marginTop: 8 }}
                exit={{ opacity: 0, translateY: -TITLE_ROLL, height: 0, marginTop: 0 }}
                transition={arrowTransition}
                exitTransition={arrowExitTransition}
                className="overflow-hidden"
              >
                <TextRolling text={title} weight="bold" className="text-2xl text-foreground" onLayout={handleTitleSlotLayout} />
              </MotiView>
            )}
          </AnimatePresence>
        </View>
        <View className="flex-1 overflow-hidden">
          <AnimatePresence>
            <MotiView
              key={paneKey}
              from={enterFrom}
              animate={animateTo}
              exit={exitTo}
              transition={slideTransition}
              exitTransition={exitTransition}
              className="absolute inset-0 px-5"
            >
              <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerClassName="pb-6">
                {isRoot ? smallScreenMenu(helpers) : activeNode?.render(helpers)}
              </ScrollView>
            </MotiView>
          </AnimatePresence>
        </View>
      </View>
    );
  }

  // AdaptiveModal owns the surface: a full sheet on small screens, a centered
  // panel on wide screens. `customLayout` + `scrollable={false}` hand all chrome
  // and scrolling to MultiStepMenu; the modal only provides the shell + transitions.
  return wrap(
    <AdaptiveModal
      open={visible}
      onOpenChange={handleClose}
      isWideScreen={isWideScreen}
      smallScreenMode="fullSheet"
      largeScreenMode="modal"
      customLayout={true}
      scrollable={false}
      widePanelSize={widePanelSize}
      onAfterClose={onAfterClose}
      testID={testID}
      overlay={overlay}
      closeOnOutsidePress={closeOnOutsidePress}
    >
      {content}
    </AdaptiveModal>,
  );
};
