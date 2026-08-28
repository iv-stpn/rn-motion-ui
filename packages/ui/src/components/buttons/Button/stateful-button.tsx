// biome-ignore-all lint/style/noExcessiveLinesPerFile: press machine, text roll, and loader are tightly coupled around one render tree
// aria-busy is approximated via accessibilityLiveRegion="polite" on the content row.

import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { type LayoutChangeEvent, type StyleProp, View, type ViewStyle } from 'react-native';
import { CheckLine as Check } from 'rn-motion-ui-icons/icons/check-line';
import { WarningLine } from 'rn-motion-ui-icons/icons/warning-line';
import { useMountEffect } from '../../../hooks/use-mount-effect';
import { useReducedMotion } from '../../../hooks/use-reduced-motion';
import { cn } from '../../../lib/cn';
import { EASE_IN_OUT, SPRING_SWAP } from '../../../lib/ease';
import type { SurfaceElevation } from '../../../lib/elevated';
import { MotiView } from '../../../moti/components/view';
import { AnimatePresence } from '../../../moti/presence/animate-presence';
import { useThemeColors } from '../../../theme/use-theme-color';
import { Text } from '../../typography/Text/text';
import { Button, type ButtonProps, type ButtonSize, type ButtonVariant } from './button';
import { STATE_BUTTON_GAP_CLASSNAME, STATE_ICON_SIZE } from './button-scale';
import { buttonLabel as labelStyle } from './button-variants';
import { ElevatedButton, type ElevatedVariant, elevatedContentColor } from './elevated-button';

export type ButtonState = 'idle' | 'loading' | 'success' | 'error';

// biome-ignore lint/style/useExportsLast: props interface before layout constants — collocated for readability
export interface StatefulButtonProps extends Omit<ButtonProps, 'children' | 'loading' | 'onPress'> {
  /** Async action driven by the button. Pressing runs the built-in machine
   *  idle → loading → success (or error) around the returned promise. */
  onPress?: () => Promise<void>;
  /** Minimum ms the loading state stays visible even if the action resolves
   *  faster, so the loader never flashes. Default: 300. */
  minLoadingMs?: number;
  /** Ms the success state is shown before `afterSuccess` runs. Default: 850. */
  successDurationMs?: number;
  /** Ms the error state is shown before `afterError` runs. Default: 600. */
  errorDurationMs?: number;
  /** Called once the success display window ends. Use for navigation, closing a sheet, etc. */
  afterSuccess?: () => void;
  /** Called once the error display window ends. Receives the rejection value from `onPress`. */
  afterError?: (error: unknown) => void;
  /** Reset signal. Rising to `true` returns the button to idle immediately,
   *  wherever the machine currently is — mid-action, mid-window, or holding a
   *  terminal state — cancelling the pending window (so a not-yet-fired
   *  `afterSuccess`/`afterError` is skipped) and re-enabling the button.
   *
   * Edge-triggered on false → true, so it can be held `true` without pinning the
   * button to idle: a press after that still runs the machine normally. Lower it
   * and raise it again to reset a second time. An in-flight `onPress` is not
   * cancelled (a promise can't be), but its result is discarded and can no longer
   * move the button. Resetting an already-idle button does nothing. */
  shouldReset?: boolean;
  /** Whether a run returns to idle (and the button re-enables) on its own once
   *  the success/error window ends. Off by default: the button holds its
   *  terminal state, disabled, so it can't be pressed again while e.g. a page
   *  transition unmounts it. */
  shouldAutoReset?: boolean;
  /** Called after any reset returns the button to idle — whether from
   *  `shouldReset` or `shouldAutoReset`. On the auto path it follows
   *  `afterSuccess`/`afterError`; a `shouldReset` mid-window replaces them.
   *  Never fires when a run holds its terminal state. */
  afterReset?: () => void;
  /** Explicit state — takes full control of the button. When set, the machine
   *  is bypassed: timings, `afterSuccess`/`afterError`, `shouldReset`,
   *  `shouldAutoReset` and `afterReset` are ignored (`onPress` still fires on press). */
  state?: ButtonState;
  children: ReactNode;
  loadingText?: ReactNode;
  successText?: ReactNode;
  errorText?: ReactNode;
  /** Optional icon rendered on the right in the idle state. */
  icon?: ReactNode;
  /** Stroke width of the success / error state icons. Default: 2.5. */
  stateIconStrokeWidth?: number;
  /** Render the elevated chip instead of the flat button.
   *
   * `'elevated'` — ElevatedButton: top-down sheen, 1px rim, coloured drop-shadow.
   *
   * The chip keeps its full appearance through the machine (loading/success/error)
   * rather than greying out, and each state adopts the matching variant — success →
   * `success`, error → `danger` — so the fill, gloss, rim and shadow update in full
   * rather than overlaying a flat plate. Omit (default) for the flat button. */
  chip?: 'elevated';

  // ── styling surface ───────────────────────────────────────────────────────
  // Button's own styling props, re-declared here because StatefulButton owns its
  // content row: it hands the wrapper a <View>, not a label, so the class that
  // Button would have merged onto its label text has to be routed to the roll
  // slot by hand (see TextSlot). The rest are documented rather than rewired,
  // since what they attach to shifts once the machine is in the middle.

  /** Tailwind classes merged onto the outer wrapper — the box the press-scale
   *  spring animates. Layout lives here: margin, width, self-alignment. */
  className?: string;
  /** Tailwind classes merged onto the pressable plate (background, border,
   *  radius, padding). Merged *after* the success/error padding squeeze, so a
   *  `px-*` passed here overrides the squeeze for every state. */
  contentClassName?: string;
  /** Tailwind classes merged onto the rolling label, on top of the variant/size
   *  ramp. Applies to every state — idle, loading, success and error all roll
   *  through the same slot — and to both copies of it, so the invisible sizer
   *  keeps measuring the same box the visible label paints in.
   *
   *  A `text-*` colour here holds on idle/loading but *loses* on success/error,
   *  where the state's foreground colour is applied inline to stay legible
   *  against the state fill. */
  labelClassName?: string;
  /** Inline styles for the outer wrapper, applied alongside `className`. */
  style?: StyleProp<ViewStyle>;
  /** Swap the resolved shadow for the input field's large, diffuse halo.
   *
   * Flat button only: the elevated `chip` casts its own coloured drop-shadow
   * ring, sized to its fill, and ignores both this and `elevation` rather than
   * writing a second `box-shadow` over it. @default false */
  floating?: boolean;
  /** Shadow level (0–8) the button casts. Drives the shadow only — the fill
   *  comes from `variant` — so raising it floats the button without recolouring
   *  it. Flat button only (see `floating`). @default 0 */
  elevation?: SurfaceElevation;
}

// Roll distance before the slot height has been measured (px).
const ROLL_FALLBACK = 18;
// Trailing slack past the last glyph's advance box so its ink (and sub-pixel
// rounding) never touches the slot's clip edge.
const TEXT_BUFFER = 2;
// The roll mask clips the vertical label travel WITHOUT clipping horizontally:
// the overlay label rounds outward ~1 px vs. the flat sizer, so the mask extends
// this far past the right edge so the trailing glyph is never shaved (it spills
// harmlessly into the button's own padding) while the vertical roll stays masked.
const CLIP_SLACK = 64;
// success/error pull 4 px off the size's shared horizontal padding to pay for
// the width the state icon slot adds. Mapped to Tailwind classes (padX - 4) so
// retuning a button's padding keeps the squeeze proportional; `icon` has no
// padding to give back.
const SQUEEZE_PADDING_CLASS: Record<ButtonSize, string> = { sm: 'px-1.5', md: 'px-2.5', lg: 'px-3.5', icon: '' };

// Matches Button's buildSpinnerColor: returns the icon stroke colour for each
// variant so the icon reads correctly against every button background.
function variantIconColor(v: ButtonVariant, c: ReturnType<typeof useThemeColors>): string {
  if (v === 'danger') return c['primary-foreground'];
  if (v === 'success') return c['success-foreground'];
  if (v === 'warning') return c['warning-foreground'];
  if (v === 'info') return c['info-foreground'];
  if (v === 'special') return c['special-foreground'];
  if (v === 'inverse') return c['surface-1'];
  if (v === 'outlineDanger' || v === 'ghostDanger') return c.danger;
  return c.foreground;
}

// Flat variant → elevated palette for the idle/loading chip. The danger family
// collapses onto the `danger` fill; `special`/`inverse` and the status fills
// (`success`/`warning`/`info`) carry over as themselves (all exist on the
// elevated union); every remaining variant is monochrome or transparent, so it
// takes the `neutral` fill.
function elevatedPaletteFor(v: ButtonVariant): ElevatedVariant {
  if (v === 'danger' || v === 'outlineDanger' || v === 'ghostDanger') return 'danger';
  if (v === 'special' || v === 'inverse' || v === 'success' || v === 'warning' || v === 'info') return v;
  return 'neutral';
}

type WrapperResolved = {
  /** Elevated palette to render, or null when not in elevated mode. */
  elevatedVariant: ElevatedVariant | null;
  /** Idle icon/label colour — elevated fills follow their foreground (grey once
   *  flattened); the flat Button follows its per-variant label colour. */
  idleIconColor: string;
  /** Keep the chip's full appearance while the machine holds it disabled
   *  (loading/success/error) instead of dimming/flattening. */
  keepAppearance: boolean;
};

type WrapperArgs = {
  chip: 'elevated' | undefined;
  v: ButtonVariant;
  state: ButtonState;
  disabled: boolean | undefined;
  colors: ReturnType<typeof useThemeColors>;
};

// Folds the `chip` mode + flat variant + machine state into what the wrapper
// needs. Extracted so the component body stays under the complexity budget.
function resolveWrapper({ chip, v, state, disabled, colors }: WrapperArgs): WrapperResolved {
  if (chip === 'elevated') {
    // Each machine state adopts its own elevated variant so success/error get the
    // real glossy chip (green/red fill, gloss, 1px rim and coloured drop-shadow
    // ring) rather than a flat overlay on the neutral chip. idle/loading map the
    // flat variant onto the palette (see elevatedPaletteFor).
    const baseVariant: ElevatedVariant = elevatedPaletteFor(v);
    let elevatedVariant: ElevatedVariant = baseVariant;
    if (state === 'success') elevatedVariant = 'success';
    else if (state === 'error') elevatedVariant = 'danger';
    // Only a genuinely disabled idle chip flattens to the muted plate (label greys
    // out too); the machine states keep the chip's full appearance.
    const genuinelyDisabled = Boolean(disabled) && state === 'idle';
    return {
      elevatedVariant,
      idleIconColor: elevatedContentColor(elevatedVariant, genuinelyDisabled, colors),
      keepAppearance: state !== 'idle',
    };
  }

  return {
    elevatedVariant: null,
    idleIconColor: variantIconColor(v, colors),
    keepAppearance: state === 'success' || state === 'error',
  };
}

type StateColors = {
  /** Coloured plate behind the content on success/error, else undefined. */
  backdropColor: string | undefined;
  /** State-icon + dots-loader colour. */
  iconColor: string;
  /** Label colour handed to TextSlot, or undefined to keep the Tailwind class. */
  textColor: string | undefined;
};

type StateColorsArgs = {
  state: ButtonState;
  idleIconColor: string;
  elevatedVariant: ElevatedVariant | null;
  colors: ReturnType<typeof useThemeColors>;
};

// Folds the machine state into the backdrop / icon / label colours. success and
// error use their `*-foreground` partner as text/icon colour; idle/loading carry
// no backdrop and follow the idle colour (chip only — the flat Button leaves
// the label undefined so `labelStyle` applies). The chip paints no backdrop: it
// switches to its `success`/`danger` variant, whose fill (and matching
// gloss/rim/shadow ring) supplies the colour. The flat Button keeps the overlay,
// since it has no variant to switch and crossfades the plate instead.
function resolveStateColors({ state, idleIconColor, elevatedVariant, colors }: StateColorsArgs): StateColors {
  // The chip renders no backdrop — it switches variant and its fill supplies the
  // colour. Only the flat Button crossfades a coloured plate.
  const isChip = elevatedVariant !== null;
  if (state === 'success')
    return {
      backdropColor: isChip ? undefined : colors.success,
      iconColor: colors['success-foreground'],
      textColor: colors['success-foreground'],
    };
  if (state === 'error')
    return {
      backdropColor: isChip ? undefined : colors.danger,
      iconColor: colors['danger-foreground'],
      textColor: colors['danger-foreground'],
    };
  return { backdropColor: undefined, iconColor: idleIconColor, textColor: isChip ? idleIconColor : undefined };
}

// ---------------------------------------------------------------------------
// IconSlot — animated width collapse / expand for state icons
// ---------------------------------------------------------------------------

type IconSlotProps = { keyId: string; children: ReactNode; reduce: boolean; slotWidth: number };
function IconSlot({ keyId, children, reduce, slotWidth }: IconSlotProps) {
  return (
    <MotiView
      key={keyId}
      from={reduce ? { opacity: 0 } : { opacity: 0, width: 0, scale: 0.7 }}
      animate={reduce ? { opacity: 1 } : { opacity: 1, width: slotWidth, scale: 1 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, width: 0, scale: 0.7 }}
      transition={reduce ? { type: 'timing', duration: 150 } : { ...SPRING_SWAP }}
      className="items-center justify-center overflow-hidden"
    >
      {children}
    </MotiView>
  );
}

// ---------------------------------------------------------------------------
// TextSlot — animated width + whole-label roll (string) or simple swap (node)
// ---------------------------------------------------------------------------

type TextSlotProps = {
  value: string;
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize | null;
  reduce: boolean;
  /** Overrides the Tailwind label colour — used when a state backdrop changes the bg. */
  textColor?: string;
  /** Consumer classes merged onto the label after the variant/size ramp. */
  labelClassName?: string;
};

function TextSlot({ value, children, variant = 'neutral', size = 'md', reduce, textColor, labelClassName }: TextSlotProps) {
  // Roll distance = one line-box height, so the label travels exactly one line
  // as it rolls in/out. Width is left to the in-flow sizer (no tween — see below).
  const [roll, setRoll] = useState(ROLL_FALLBACK);
  const textLabel = typeof children === 'string' ? children : null;

  const onSizerLayout = useCallback((e: LayoutChangeEvent) => {
    const { height } = e.nativeEvent.layout;
    if (height) setRoll((prev) => (prev === height ? prev : height));
  }, []);

  // Merged once and used by BOTH copies below: the sizer must keep measuring the
  // exact box the visible overlay paints in, so a consumer class that changes the
  // metrics (font size, tracking, weight) has to land on both or the button
  // sizes itself to the wrong label.
  const textClass = cn(labelStyle({ variant, size }), labelClassName);
  const colorStyle = textColor ? { color: textColor } : undefined;

  return (
    // The in-flow sizer drives the slot width directly (no width tween): an
    // animated width springs behind a growing label and `overflow:'hidden'`
    // clips the already-laid-out glyphs mid-spring (the trailing letter loses its
    // right edge). Sizing to the sizer keeps the box wide enough for the current
    // label on every frame; the icon slot's own width spring carries the morph.
    // This box does NOT clip — the vertical roll is masked by the absolute clip
    // layer below, which is open-ended to the right so the trailing glyph is never
    // shaved horizontally (see CLIP_SLACK).
    <View>
      {/* In-flow sizer: holds the slot open at the current label's natural
          width/height and is the single copy assistive tech reads (opacity 0
          keeps it in the a11y tree). The animated copy floats on top.
          MUST render identically to the visible overlay below (same <Text>, no
          numberOfLines): the sizer drives the box/button width, and RNW renders
          `numberOfLines={1}` as display:-webkit-box + line-clamp, whose intrinsic
          width measures ~5px NARROWER than a plain <Text>. That undersizes the box
          and the button's overflow:hidden shaves the trailing glyph of the visible
          (plain-Text) label. Keep them structurally identical so they can't diverge.
          The trailing padding keeps the last glyph's ink clear of the clip edge. */}
      <View onLayout={onSizerLayout} className="opacity-0" style={{ paddingRight: TEXT_BUFFER }}>
        {textLabel === null ? (
          children
        ) : (
          <Text className={textClass} style={colorStyle} weight="medium">
            {textLabel}
          </Text>
        )}
      </View>

      {/* Clip layer: masks the vertical label roll. It is pinned tight to the
          line box (top/bottom: 0) but runs open-ended to the right
          (right: -CLIP_SLACK) so the trailing glyph is never shaved horizontally
          (transformed text boxes round outward and can sum wider than the flat
          sizer). pointerEvents:'none' lets taps fall through to the button. */}
      <View className="pointer-events-none absolute inset-y-0 left-0 overflow-hidden" style={{ right: -CLIP_SLACK }}>
        <AnimatePresence initial={false}>
          <MotiView
            key={`text-${value}`}
            from={reduce ? { opacity: 0 } : { opacity: 0, translateY: roll }}
            animate={{ opacity: 1, translateY: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, translateY: -roll }}
            transition={reduce ? { type: 'timing', duration: 150 } : { ...SPRING_SWAP }}
            className="absolute top-0 left-0"
            importantForAccessibility="no-hide-descendants"
          >
            {typeof children === 'string' ? (
              <Text className={textClass} style={colorStyle} weight="medium">
                {children}
              </Text>
            ) : (
              children
            )}
          </MotiView>
        </AnimatePresence>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// DotsLoader — three staggered bouncing dots for the loading state
// ---------------------------------------------------------------------------

const DOT_SIZE = 4;
const DOT_GAP = 3;

type DotsLoaderProps = { color: string; reduce: boolean };

function DotsLoader({ color, reduce }: DotsLoaderProps) {
  return (
    <View className="flex-row items-center" style={{ gap: DOT_GAP }}>
      {([0, 1, 2] as const).map((i) => (
        <MotiView
          key={i}
          from={{ opacity: 0.5, translateY: 0 }}
          animate={reduce ? { opacity: 1, translateY: 0 } : { opacity: 1, translateY: -4 }}
          transition={{
            type: 'timing',
            duration: 400,
            loop: true,
            repeatReverse: true,
            easing: EASE_IN_OUT,
            delay: i * 120,
          }}
          style={{
            width: DOT_SIZE,
            height: DOT_SIZE,
            borderRadius: DOT_SIZE / 2,
            backgroundColor: color,
          }}
        />
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// StatefulButton
// ---------------------------------------------------------------------------

type ResolveStateTextArgs = {
  state: ButtonState;
  loadingText: ReactNode;
  successText: ReactNode;
  errorText: ReactNode;
  children: ReactNode;
};

function resolveStateText({ state, loadingText, successText, errorText, children }: ResolveStateTextArgs): ReactNode {
  if (state === 'loading') return loadingText;
  if (state === 'success') return successText;
  if (state === 'error') return errorText;
  return children;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// biome-ignore lint/complexity/noExcessiveLinesPerFunction: press machine + render tree are one cohesive unit
export function StatefulButton({
  state: controlledState,
  onPress,
  minLoadingMs = 300,
  successDurationMs = 850,
  errorDurationMs = 600,
  afterSuccess,
  afterError,
  afterReset,
  shouldReset = false,
  shouldAutoReset = false,
  children,
  loadingText = 'Loading',
  successText = 'Done',
  errorText = 'Try again',
  icon,
  stateIconStrokeWidth = 2.5,
  chip,
  disabled,
  variant = 'neutral',
  size = 'md',
  shape,
  className,
  contentClassName,
  labelClassName,
  style,
  floating,
  elevation,
  ...rest
}: StatefulButtonProps) {
  const reduce = useReducedMotion();
  const [machineState, setMachineState] = useState<ButtonState>('idle');
  const controlled = controlledState !== undefined;
  const state = controlledState ?? machineState;

  // The after-window callbacks fire seconds after the press; read them through
  // refs so the machine calls the latest bound props, not press-time closures.
  const afterSuccessRef = useRef(afterSuccess);
  afterSuccessRef.current = afterSuccess;
  const afterErrorRef = useRef(afterError);
  afterErrorRef.current = afterError;
  const afterResetRef = useRef(afterReset);
  afterResetRef.current = afterReset;
  // Read at window end rather than press time, so toggling the prop mid-run
  // still decides the run it lands on.
  const shouldAutoResetRef = useRef(shouldAutoReset);
  shouldAutoResetRef.current = shouldAutoReset;

  // runningRef guards the async run against re-entry (Pressable's `disabled`
  // only updates on re-render); mountedRef guards setState after unmount.
  const runningRef = useRef(false);
  const mountedRef = useRef(true);
  const windowTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Bumped by every reset. The async run captures it and drops its writes if it
  // no longer matches: an external reset can land while `onPress` is still
  // pending, and that orphaned promise must not push the button back into
  // success/error after it has already returned to idle.
  const runIdRef = useRef(0);
  useMountEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (windowTimer.current !== null) clearTimeout(windowTimer.current);
    };
  });

  // Single reset path, shared by the external `shouldReset` signal and the
  // `shouldAutoReset` window end: cancel the pending window, orphan any in-flight
  // run, re-arm, and announce it. Returns false when there was nothing to reset.
  const resetNow = useCallback((): boolean => {
    if (!mountedRef.current) return false;
    if (windowTimer.current !== null) {
      clearTimeout(windowTimer.current);
      windowTimer.current = null;
    }

    runIdRef.current += 1;
    runningRef.current = false;
    setMachineState('idle');
    afterResetRef.current?.();
    return true;
  }, []);

  // The external signal is edge-triggered on the rise: a parent that leaves
  // `shouldReset` pinned true would otherwise re-reset the button on every press,
  // so raising it resets once. Lower it and raise it again to reset again.
  const prevShouldReset = useRef(shouldReset);
  // biome-ignore lint/plugin: reacting to a prop's rising edge — the reset cancels a pending timer and orphans an in-flight promise, neither of which is derivable during render
  useEffect(() => {
    const rose = shouldReset && !prevShouldReset.current;
    prevShouldReset.current = shouldReset;
    if (!rose || controlled) return;
    // Already idle with nothing in flight: there is no state to unwind, so
    // `afterReset` stays silent rather than announcing a reset that didn't happen.
    if (machineState === 'idle' && !runningRef.current) return;
    resetNow();
  }, [shouldReset, controlled, machineState, resetNow]);

  const handlePress = useCallback(() => {
    if (!onPress) return;
    if (controlled) {
      // Controlled: the consumer owns the machine — just start the action.
      onPress();
      return;
    }
    if (runningRef.current) return;
    runningRef.current = true;

    // Identifies this run for the whole of its async life. A reset bumps the ref,
    // so everything below can tell "still my run" from "reset out from under me".
    const runId = runIdRef.current;
    const isCurrent = () => mountedRef.current && runIdRef.current === runId;

    const runMachine = async () => {
      const startedAt = Date.now();
      setMachineState('loading');

      let outcome: 'success' | 'error' = 'success';
      let rejection: unknown;
      try {
        await onPress();
      } catch (error) {
        outcome = 'error';
        rejection = error;
      }

      // Hold the loader for the remainder of minLoadingMs so fast actions don't flash it.
      const remaining = minLoadingMs - (Date.now() - startedAt);
      if (remaining > 0) await sleep(remaining);
      // Reset (or unmount) while the action was pending: this run is orphaned, so
      // it neither shows its outcome nor opens a window. The button is already idle.
      if (!isCurrent()) return;
      setMachineState(outcome);

      windowTimer.current = setTimeout(
        () => {
          windowTimer.current = null;
          if (outcome === 'success') afterSuccessRef.current?.();
          else afterErrorRef.current?.(rejection);
          // The callback may have unmounted the button (navigation, closed sheet),
          // or reset it — either way this run no longer owns the state.
          if (shouldAutoResetRef.current && isCurrent()) resetNow();
        },
        outcome === 'success' ? successDurationMs : errorDurationMs,
      );
    };
    runMachine();
  }, [onPress, controlled, minLoadingMs, successDurationMs, errorDurationMs, resetNow]);

  const isBusy = state === 'loading';
  // Uncontrolled runs stay non-interactive through the whole machine — loading,
  // the success/error window, and the terminal hold — so the action can't be
  // double-fired; a reset re-enables the button when it returns to idle.
  const machineActive = !controlled && state !== 'idle';
  const v = variant ?? 'neutral';
  const s = size ?? 'md';
  const iconSize = STATE_ICON_SIZE[s];
  const stateGapClass = STATE_BUTTON_GAP_CLASSNAME[s];
  const colors = useThemeColors();

  // Chip mode swaps the flat Button for the elevated chip. The machine disables
  // the button during loading/success/error, so the chip is told (via
  // keepAppearance → noDisabledOpacity) to keep its gloss/fill instead of
  // greying out — only a genuinely disabled idle button flattens.
  const { elevatedVariant, idleIconColor, keepAppearance } = resolveWrapper({
    chip,
    v,
    state,
    disabled,
    colors,
  });

  // Backdrop / icon / label colours for the current state (see resolveStateColors).
  const {
    backdropColor,
    iconColor,
    textColor: resolvedTextColor,
  } = resolveStateColors({ state, idleIconColor, elevatedVariant, colors });
  // Slot wide enough to contain the icon with 6 px margin on each side, which
  // also acts as the gap between icon and label without needing an explicit gap
  // on the outer row (an explicit gap would show during the slot's width spring).
  // In success/error the button shrinks its horizontal padding slightly to
  // compensate for the extra width the icon slot adds. Derived from the family's
  // padding rather than tabulated, so retuning a `--spacing-interactive-pad-*` token
  // keeps the squeeze proportional (and `icon`, which has no padding, stays 0).
  const squeezeClass = state === 'success' || state === 'error' ? SQUEEZE_PADDING_CLASS[size ?? 'md'] : undefined;

  const stateText =
    state === 'loading'
      ? children // use idle text as sizer so button width stays constant
      : resolveStateText({ state, loadingText, successText, errorText, children });

  // In loading state keep the same key as idle so no roll triggers on the hidden text.
  let textKey: string;
  if (state === 'loading') textKey = typeof children === 'string' ? `idle-${children}` : 'idle';
  else textKey = typeof stateText === 'string' ? `${state}-${stateText}` : state;

  // Shared across both wrapper branches. `keepAppearance` maps onto the wrapper's
  // skip-the-dim `noDisabledOpacity`: the flat Button keeps full opacity, the
  // elevated chip keeps its gloss/fill while the machine holds it disabled.
  // `floating`/`elevation` are deliberately NOT in here: they are flat-Button
  // props, and the chip resolves its own drop-shadow ring from its variant. Only
  // the Button branch below picks them up.
  const sharedProps = {
    size: size ?? 'md',
    shape: shape ?? 'pill',
    disabled: disabled || isBusy || machineActive,
    loading: false as const,
    noDisabledOpacity: keepAppearance,
    backdropColor,
    className,
    style,
    // Consumer classes land after the squeeze so an explicit `px-*` wins over it.
    contentClassName: cn(squeezeClass, contentClassName),
    onPress: handlePress,
    ...rest,
  };

  const content = (
    // accessibilityLiveRegion mirrors the web's aria-live="polite"
    <View accessible={false} accessibilityLiveRegion="polite" className={cn('flex-row items-center', stateGapClass)}>
      <AnimatePresence>
        {state === 'success' ? (
          <IconSlot keyId="success-icon" reduce={reduce} slotWidth={iconSize}>
            <Check size={iconSize} color={iconColor} />
          </IconSlot>
        ) : null}

        {state === 'error' ? (
          <IconSlot keyId="error-icon" reduce={reduce} slotWidth={iconSize}>
            <WarningLine size={iconSize} color={iconColor} />
          </IconSlot>
        ) : null}
      </AnimatePresence>

      {/* Wrapper holds the text sizer open (preserving button width) and
            hosts the absolutely-centred dot overlay in loading state.
            No overflow:hidden here — dots bounce freely above the baseline. */}
      <View className="relative">
        <MotiView animate={{ opacity: state === 'loading' ? 0 : 1 }} transition={{ type: 'timing', duration: 150 }}>
          <TextSlot
            value={textKey}
            variant={v}
            size={size}
            reduce={reduce}
            textColor={resolvedTextColor}
            labelClassName={labelClassName}
          >
            {stateText}
          </TextSlot>
        </MotiView>

        <AnimatePresence>
          {state === 'loading' ? (
            <MotiView
              key="dots-overlay"
              from={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ type: 'timing', duration: 150 }}
              className="pointer-events-none absolute inset-0 items-center justify-center"
            >
              <DotsLoader color={iconColor} reduce={reduce} />
            </MotiView>
          ) : null}
        </AnimatePresence>
      </View>

      <AnimatePresence>
        {state === 'idle' && icon ? (
          <IconSlot keyId="idle-icon" reduce={reduce} slotWidth={iconSize}>
            {icon}
          </IconSlot>
        ) : null}
      </AnimatePresence>
    </View>
  );

  if (elevatedVariant)
    return (
      <ElevatedButton variant={elevatedVariant} {...sharedProps}>
        {content}
      </ElevatedButton>
    );

  return (
    <Button variant={variant} floating={floating} elevation={elevation} {...sharedProps}>
      {content}
    </Button>
  );
}
