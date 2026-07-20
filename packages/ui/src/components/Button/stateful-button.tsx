// RN FALLBACK vs web: CSS blur filter dropped (no RN equivalent) — opacity +
// translateY preserved. Width animation uses onLayout measurement; initial render
// may briefly snap vs. the web's synchronous useLayoutEffect measure.
// aria-busy is approximated via accessibilityLiveRegion="polite" on the content row.

import { type ReactNode, useCallback, useState } from 'react';
import { type LayoutChangeEvent, type StyleProp, Text, View, type ViewStyle } from 'react-native';
import { useReducedMotion } from '../../hooks/use-reduced-motion';
import { EASE_IN_OUT, EASE_OUT, SPRING_SWAP } from '../../lib/ease';
import { Check, X } from '../../lib/icons';
import { MotiView } from '../../moti/components/view';
import { AnimatePresence } from '../../moti/presence/animate-presence';
import { Button, type ButtonProps, type ButtonSize, type ButtonVariant, label as labelStyle } from './button';

export type ButtonState = 'idle' | 'loading' | 'success' | 'error';

// biome-ignore lint/style/useExportsLast: props interface before CASCADE_STAGGER constant — collocated for readability
export interface StatefulButtonProps extends Omit<ButtonProps, 'children' | 'loading'> {
  state?: ButtonState;
  children: ReactNode;
  loadingText?: ReactNode;
  successText?: ReactNode;
  errorText?: ReactNode;
  /** Optional icon rendered on the right in the idle state. */
  icon?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

const CASCADE_STAGGER = 25; // ms per character (web original: 0.025 s)
const ICON_SLOT_WIDTH = 24; // px — icon (16 px) + surrounding whitespace
// Block exit for the outgoing label: the whole word rolls up + fades as one,
// while the incoming word's letters roll in staggered on top of it.
const CASCADE_EXIT = { type: 'timing', duration: 160, easing: EASE_OUT } as const;
// Roll distance before the slot height has been measured (px).
const ROLL_FALLBACK = 18;
// Trailing slack past the last glyph's advance box so its ink (and sub-pixel
// rounding) never touches the slot's clip edge.
const TEXT_BUFFER = 2;
// The roll mask must clip the vertical letter travel WITHOUT clipping horizontally:
// each cascade glyph rides its own transformed box that rounds outward ~1 px, so the
// summed overlay runs wider than the flat sizer and the trailing glyph loses its edge.
// The mask extends this far past the right edge so horizontal overflow is never cut
// (it spills harmlessly into the button's own padding) while the roll stays masked.
const CLIP_SLACK = 64;

// Matches the Button's SPINNER_COLOR map so icons stay legible on every variant.
const ICON_COLOR: Record<ButtonVariant, string> = {
  primary: '#fafafa',
  secondary: '#111111',
  ghost: '#111111',
  outline: '#111111',
};

// ---------------------------------------------------------------------------
// IconSlot — animated width collapse / expand for state icons
// ---------------------------------------------------------------------------

type IconSlotProps = { keyId: string; children: ReactNode; reduce: boolean };
function IconSlot({ keyId, children, reduce }: IconSlotProps) {
  return (
    <MotiView
      key={keyId}
      from={reduce ? { opacity: 0 } : { opacity: 0, width: 0, scale: 0.7 }}
      animate={reduce ? { opacity: 1 } : { opacity: 1, width: ICON_SLOT_WIDTH, scale: 1 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, width: 0, scale: 0.7 }}
      transition={reduce ? { type: 'timing', duration: 150 } : { ...SPRING_SWAP }}
      style={{ overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}
    >
      {children}
    </MotiView>
  );
}

// ---------------------------------------------------------------------------
// TextSlot — animated width + per-character cascade (string) or simple swap (node)
// ---------------------------------------------------------------------------

type TextSlotProps = {
  value: string;
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize | null;
  reduce: boolean;
};

function TextSlot({ value, children, variant = 'primary', size = 'md', reduce }: TextSlotProps) {
  // Roll distance = one line-box height, so glyphs travel exactly one line as
  // they roll in/out. Width is left to the in-flow sizer (no tween — see below).
  const [roll, setRoll] = useState(ROLL_FALLBACK);
  const textLabel = typeof children === 'string' ? children : null;
  const cascade = textLabel !== null && !reduce;

  const onSizerLayout = useCallback((e: LayoutChangeEvent) => {
    const { height } = e.nativeEvent.layout;
    if (height) setRoll((prev) => (prev === height ? prev : height));
  }, []);

  const textClass = labelStyle({ variant, size });

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
          keeps it in the a11y tree). The animated copies float on top.
          In cascade mode it mirrors the per-letter row layout so the measured
          width matches the split glyphs (split Text loses inter-letter kerning
          and rounds each advance up, so a single Text under-measures and the
          slot clips the right edge). The trailing padding keeps the last glyph's
          ink clear of the clip edge. */}
      {cascade ? (
        <View onLayout={onSizerLayout} style={{ flexDirection: 'row', opacity: 0, paddingRight: TEXT_BUFFER }}>
          {textLabel.split('').map((char, index) => (
            <Text
              className={textClass}
              // biome-ignore lint/suspicious/noArrayIndexKey: position is the slot identity
              key={index}
            >
              {/* biome-ignore lint/suspicious/noLeakedRender: both branches are string literals — no numeric leak */}
              {char === ' ' ? ' ' : char}
            </Text>
          ))}
        </View>
      ) : (
        // MUST render identically to the visible overlay below (same <Text>, no
        // numberOfLines): the sizer drives the box/button width, and RNW renders
        // `numberOfLines={1}` as display:-webkit-box + line-clamp, whose intrinsic
        // width measures ~5px NARROWER than a plain <Text>. That undersizes the box
        // and the button's overflow:hidden shaves the trailing glyph of the visible
        // (plain-Text) label. Keep them structurally identical so they can't diverge.
        <View onLayout={onSizerLayout} style={{ opacity: 0, paddingRight: TEXT_BUFFER }}>
          {textLabel === null ? children : <Text className={textClass}>{textLabel}</Text>}
        </View>
      )}

      {/* Clip layer: masks ONLY the vertical letter roll. It is pinned tight to
          the line box (top/bottom: 0) but runs open-ended to the right
          (right: -CLIP_SLACK) so the trailing glyph — whose per-letter transform
          boxes each round outward and sum wider than the flat sizer — is never
          shaved horizontally. pointerEvents:'none' lets taps fall through to the
          button. */}
      <View
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          right: -CLIP_SLACK,
          overflow: 'hidden',
          pointerEvents: 'none',
        }}
      >
        {cascade ? (
          <AnimatePresence initial={false}>
            <MotiView
              key={`cascade-${value}`}
              from={{ opacity: 1, translateY: 0 }}
              animate={{ opacity: 1, translateY: 0 }}
              exit={{ opacity: 0, translateY: -roll }}
              transition={CASCADE_EXIT}
              importantForAccessibility="no-hide-descendants"
              style={{ position: 'absolute', left: 0, top: 0, flexDirection: 'row' }}
            >
              {textLabel.split('').map((char, index) => (
                <MotiView
                  // biome-ignore lint/suspicious/noArrayIndexKey: position is the slot identity
                  key={index}
                  from={{ opacity: 0, translateY: roll }}
                  animate={{ opacity: 1, translateY: 0 }}
                  transition={{ ...SPRING_SWAP, delay: index * CASCADE_STAGGER }}
                >
                  {/* biome-ignore lint/suspicious/noLeakedRender: both branches are string literals — no numeric leak */}
                  <Text className={textClass}>{char === ' ' ? ' ' : char}</Text>
                </MotiView>
              ))}
            </MotiView>
          </AnimatePresence>
        ) : (
          <AnimatePresence initial={false}>
            <MotiView
              key={`text-${value}`}
              from={reduce ? { opacity: 0 } : { opacity: 0, translateY: roll }}
              animate={{ opacity: 1, translateY: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, translateY: -roll }}
              transition={reduce ? { type: 'timing', duration: 150 } : { ...SPRING_SWAP }}
              style={{ position: 'absolute', left: 0, top: 0 }}
              importantForAccessibility="no-hide-descendants"
            >
              {/* biome-ignore lint/suspicious/noLeakedRender: both branches are string literals — no numeric leak */}
              {typeof children === 'string' ? <Text className={textClass}>{children}</Text> : children}
            </MotiView>
          </AnimatePresence>
        )}
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
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: DOT_GAP }}>
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

export function StatefulButton({
  state = 'idle',
  children,
  loadingText = 'Loading',
  successText = 'Done',
  errorText = 'Try again',
  icon,
  disabled,
  variant = 'primary',
  size = 'md',
  ...rest
}: StatefulButtonProps) {
  const reduce = useReducedMotion();
  const isBusy = state === 'loading';
  const v = variant ?? 'primary';
  const iconColor = ICON_COLOR[v];

  const stateText =
    state === 'loading'
      ? children // use idle text as sizer so button width stays constant
      : resolveStateText({ state, loadingText, successText, errorText, children });

  // In loading state keep the same key as idle so no cascade triggers on the hidden text.
  let textKey: string;
  if (state === 'loading') textKey = typeof children === 'string' ? `idle-${children}` : 'idle';
  else textKey = typeof stateText === 'string' ? `${state}-${stateText}` : state;

  return (
    <Button variant={variant} size={size} disabled={disabled || isBusy} loading={false} {...rest}>
      {/* accessibilityLiveRegion mirrors the web's aria-live="polite" */}
      <View accessible={false} accessibilityLiveRegion="polite" style={{ flexDirection: 'row', alignItems: 'center' }}>
        <AnimatePresence>
          {state === 'success' ? (
            <IconSlot keyId="success-icon" reduce={reduce}>
              <Check size={16} color={iconColor} />
            </IconSlot>
          ) : null}

          {state === 'error' ? (
            <IconSlot keyId="error-icon" reduce={reduce}>
              <X size={16} color={iconColor} />
            </IconSlot>
          ) : null}
        </AnimatePresence>

        {/* Wrapper holds the text sizer open (preserving button width) and
            hosts the absolutely-centred dot overlay in loading state.
            No overflow:hidden here — dots bounce freely above the baseline. */}
        <View style={{ position: 'relative' }}>
          <MotiView animate={{ opacity: state === 'loading' ? 0 : 1 }} transition={{ type: 'timing', duration: 150 }}>
            <TextSlot value={textKey} variant={v} size={size} reduce={reduce}>
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
                style={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  left: 0,
                  right: 0,
                  alignItems: 'center',
                  justifyContent: 'center',
                  pointerEvents: 'none',
                }}
              >
                <DotsLoader color={iconColor} reduce={reduce} />
              </MotiView>
            ) : null}
          </AnimatePresence>
        </View>

        <AnimatePresence>
          {state === 'idle' && icon ? (
            <IconSlot keyId="idle-icon" reduce={reduce}>
              {icon}
            </IconSlot>
          ) : null}
        </AnimatePresence>
      </View>
    </Button>
  );
}
