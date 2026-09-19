// biome-ignore-all lint/style/useExportsLast: the public step/props types head the module so the Spotlight component below reads against them
import { type RefObject, useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Button } from '../../buttons/Button/button';
import { Text } from '../../typography/Text/text';
import { Surface } from '../Surface/surface';
import { type SpotlightGeometryOptions, type SpotlightRect, spotlightGeometry } from './spotlight-layout';
import { getSpotlightTarget } from './spotlight-registry';

/** The dim that drops over everything except the highlighted hole. */
const SCRIM = 'rgba(0, 0, 0, 0.45)';

/**
 * Spotlight — a native spotlight / tour primitive.
 *
 * One `Spotlight` renders a step-by-step tour: a full-screen dim with a single
 * "hole" cut out around a target, a highlight ring, and a tooltip card carrying
 * the step title/body and Back / Skip / Next controls.
 *
 * Steps address a target either by a `SpotlightTarget`'s `testID` (registered in
 * a module-level map, no ref plumbing needed) or by a host `View` ref. The
 * overlay is a single native `<Modal>`, so it floats above every other surface
 * and the underlying screen stays blocked while the tour runs.
 *
 * Controls derive `${testID}-hole`, `${testID}-tooltip`, `${testID}-back`,
 * `${testID}-skip` and `${testID}-next` (all omitted when `testID` is).
 */

/** One tour step — a target to highlight and the copy to show beside it. */
export type SpotlightStep = {
  /** Stable id — the step's key. */
  id: string;
  /** The element to highlight: a `SpotlightTarget` testID, or a host `View` ref. */
  target: string | RefObject<View | null>;
  /** Tooltip title. */
  title: string;
  /** Optional tooltip body. */
  body?: string;
};

export type SpotlightProps = {
  /** The tour steps, in order. */
  steps: readonly SpotlightStep[];
  /** Controlled open state. @default undefined (uncontrolled) */
  open?: boolean;
  /** Uncontrolled initial open state. @default false */
  defaultOpen?: boolean;
  /** Called whenever the open state changes (controlled or uncontrolled). */
  onOpenChange?: (open: boolean) => void;
  /** Called when the tour finishes — the last step's Next is pressed. */
  onComplete?: () => void;
  /** Called when the tour is dismissed via Skip, the Android back button or an external close. */
  onSkip?: () => void;
  /** Called with the new index whenever the step changes. */
  onStepChange?: (index: number) => void;
  /** Back button label. @default 'Back' */
  backLabel?: string;
  /** Next button label (non-final steps). @default 'Next' */
  nextLabel?: string;
  /** Next button label on the final step. @default 'Done' */
  doneLabel?: string;
  /** Skip button label. @default 'Skip' */
  skipLabel?: string;
  /** Geometry overrides — forwarded to `spotlightGeometry`. */
  padding?: SpotlightGeometryOptions['padding'];
  gap?: SpotlightGeometryOptions['gap'];
  tooltipWidth?: SpotlightGeometryOptions['tooltipWidth'];
  /** Minimum distance the tooltip keeps from the viewport edges. @default 16 */
  margin?: SpotlightGeometryOptions['margin'];
  /** Root testID; controls derive their suffixes from it. */
  testID?: string;
};

type ShadeProps = { rect: SpotlightRect };

/** One dim region of the spotlight overlay — a shade of the cut-out. */
function Shade({ rect }: ShadeProps) {
  return <View style={{ position: 'absolute', ...rect, backgroundColor: SCRIM }} />;
}

export function Spotlight({
  steps,
  open,
  defaultOpen = false,
  onOpenChange,
  onComplete,
  onSkip,
  onStepChange,
  backLabel = 'Back',
  nextLabel = 'Next',
  doneLabel = 'Done',
  skipLabel = 'Skip',
  padding,
  gap,
  tooltipWidth,
  margin,
  testID,
}: SpotlightProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const [index, setIndex] = useState(0);
  const isOpen = open ?? internalOpen;
  const setOpen = useCallback(
    (next: boolean) => {
      // A fresh open restarts the tour at the first step.
      if (next) setIndex(0);
      if (open === undefined) setInternalOpen(next);
      onOpenChange?.(next);
    },
    [open, onOpenChange],
  );

  const goTo = useCallback(
    (next: number) => {
      setIndex(next);
      onStepChange?.(next);
    },
    [onStepChange],
  );

  const handleNext = useCallback(() => {
    if (index >= steps.length - 1) {
      setOpen(false);
      onComplete?.();
    } else goTo(index + 1);
  }, [index, steps.length, setOpen, onComplete, goTo]);

  const handleBack = useCallback(() => {
    if (index > 0) goTo(index - 1);
  }, [index, goTo]);

  const handleSkip = useCallback(() => {
    setOpen(false);
    onSkip?.();
  }, [setOpen, onSkip]);

  const step = steps[index];
  const { width, height } = useWindowDimensions();

  // Re-measure the target whenever the open state, step, or viewport changes.
  const [rect, setRect] = useState<SpotlightRect | null>(null);
  // biome-ignore lint/plugin: measuring a native node's window rect is an imperative side effect with no React prop equivalent — it must run after layout, not during render
  // biome-ignore lint/correctness/useExhaustiveDependencies: width/height are intentional re-measure triggers so the hole/tooltip track the target when the viewport resizes
  useEffect(() => {
    if (!(isOpen && step)) {
      setRect(null);
      return;
    }
    let cancelled = false;
    const apply = (measured: SpotlightRect) => {
      if (!cancelled) setRect(measured);
    };
    if (typeof step.target === 'string') {
      const measure = getSpotlightTarget(step.target);
      if (!measure) {
        setRect(null);
        return;
      }
      measure(apply);
    } else {
      const node = step.target.current;
      if (!node) {
        setRect(null);
        return;
      }
      node.measureInWindow((x, y, w, h) => apply({ x, y, width: w, height: h }));
    }
    return () => {
      cancelled = true;
    };
  }, [isOpen, step, width, height]);

  const geometry = useMemo(
    () => (rect ? spotlightGeometry(rect, width, height, { padding, gap, tooltipWidth, margin }) : null),
    [rect, width, height, padding, gap, tooltipWidth, margin],
  );

  const isLast = index >= steps.length - 1;
  const counter = `${index + 1} / ${steps.length}`;
  const nextButtonLabel = isLast ? doneLabel : nextLabel;

  return (
    <Modal transparent={true} visible={isOpen} animationType="fade" onRequestClose={handleSkip}>
      <View style={StyleSheet.absoluteFill}>
        {geometry && step ? (
          <>
            {geometry.shades.map((shade, shadeIndex) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: fixed positional tuple (top/bottom/left/right), never reordered
              <Shade key={shadeIndex} rect={shade} />
            ))}

            {/* The highlight ring doubles as the hole cover — it absorbs touches so
                the target beneath stays inert while the tour is running. */}
            <View
              testID={testID ? `${testID}-hole` : undefined}
              className="hairline rounded-xl border-white"
              style={{
                position: 'absolute',
                left: geometry.hole.x,
                top: geometry.hole.y,
                width: geometry.hole.width,
                height: geometry.hole.height,
              }}
            />

            <Surface
              elevation={3}
              radius="card"
              testID={testID ? `${testID}-tooltip` : undefined}
              style={{
                position: 'absolute',
                left: geometry.tooltip.x,
                top: geometry.tooltip.y,
                width: geometry.tooltip.width,
              }}
            >
              <View className="gap-3 p-4">
                <Text size="xs" className="text-muted-foreground">
                  {counter}
                </Text>
                <Text weight="semibold" size="base" className="text-foreground">
                  {step.title}
                </Text>
                {step.body ? (
                  <Text size="sm" className="text-muted-foreground">
                    {step.body}
                  </Text>
                ) : null}

                <View className="mt-1 flex-row items-center justify-between gap-2">
                  <View className="flex-row items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={index === 0}
                      onPress={handleBack}
                      accessibilityLabel={backLabel}
                      testID={testID ? `${testID}-back` : undefined}
                    >
                      {backLabel}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onPress={handleSkip}
                      accessibilityLabel={skipLabel}
                      testID={testID ? `${testID}-skip` : undefined}
                    >
                      {skipLabel}
                    </Button>
                  </View>
                  <Button
                    variant="primary"
                    size="sm"
                    onPress={handleNext}
                    accessibilityLabel={nextButtonLabel}
                    testID={testID ? `${testID}-next` : undefined}
                  >
                    {nextButtonLabel}
                  </Button>
                </View>
              </View>
            </Surface>
          </>
        ) : null}
      </View>
    </Modal>
  );
}
