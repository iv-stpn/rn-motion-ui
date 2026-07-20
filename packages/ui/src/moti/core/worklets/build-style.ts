// Keys whose exit animation should not gate unmount (layout / non-animatable props).
const DISABLED_EXIT_STYLE_PROPS: Record<string, true> = {
  position: true,
  zIndex: true,
  borderTopStyle: true,
  borderBottomStyle: true,
  borderLeftStyle: true,
  borderRightStyle: true,
  borderStyle: true,
  pointerEvents: true,
  outline: true,
};

type BuildMergedStylesParams<Animate> = {
  animateStyle: Animate;
  variantStyle: Animate;
  initialStyle: Animate | object;
  exitStyle: unknown;
  stylePriority: 'animate' | 'state';
  isMounted: boolean;
  disableInitialAnimation: boolean;
  isExiting: boolean;
};

/**
 * Merges animate, variant, initial, and exit styles into the final resolved style bag
 * that will be handed to the per-key animation loop.
 */
export function buildMergedStyles<Animate>({
  animateStyle,
  variantStyle,
  initialStyle,
  exitStyle,
  stylePriority,
  isMounted,
  disableInitialAnimation,
  isExiting,
}: BuildMergedStylesParams<Animate>): Animate {
  'worklet';

  // biome-ignore lint/plugin: opaque generic Animate can't be initialised from {} without an assertion
  let merged: Animate = {} as Animate;

  if (stylePriority === 'state') merged = { ...animateStyle, ...variantStyle };
  else merged = { ...variantStyle, ...animateStyle };

  // biome-ignore lint/plugin: initialStyle is `Animate | object`; Object.keys needs the object view
  if (!(isMounted || disableInitialAnimation) && Object.keys(initialStyle as object).length)
    // biome-ignore lint/plugin: assigning the from-prop initial style to the opaque Animate generic requires an assertion
    merged = initialStyle as Animate;
  else merged = { ...initialStyle, ...merged };

  if (isExiting && exitStyle && typeof exitStyle !== 'boolean')
    // biome-ignore lint/plugin: exitStyle is unknown; spreading it into Animate requires an assertion
    merged = { ...(exitStyle as object) } as Animate;

  return merged;
}

/**
 * Builds a map of exit-style keys whose animations must finish before the component unmounts.
 * Keys in DISABLED_EXIT_STYLE_PROPS are excluded because they are not animatable.
 */
export const buildExitingStyleProps = (exitStyle: unknown): Record<string, boolean> => {
  'worklet';
  const props: Record<string, boolean> = {};
  if (!exitStyle || typeof exitStyle === 'boolean') return props;
  for (const key of Object.keys(exitStyle)) {
    if (!DISABLED_EXIT_STYLE_PROPS[key]) props[key] = true;
  }
  return props;
};
