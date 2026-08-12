/**
 * TriggerButton — reusable open-trigger for overlay Demo and Playground stories.
 * TriggerControls + useTriggerState — reusable Controls section for trigger customisation.
 *
 * Kept separate from story-harness.tsx because the harness is intentionally
 * built from bare `Pressable` — it must never answer a library-component query
 * so play-function selectors are unambiguous. TriggerButton uses Button /
 * ElevatedButton / GlossyButton / Pressable on purpose: overlay stories need to
 * showcase real launch styles, not harness chrome.
 *
 * Usage (playground):
 *   import { TriggerButton, TriggerControls, useTriggerState } from '../../__stories__/story-trigger';
 *
 *   const trigger = useTriggerState();
 *   // In Controls:
 *   <TriggerControls state={trigger} />
 *   // Trigger button:
 *   <TriggerButton kind={trigger.kind} size={trigger.size} shape={trigger.shape} label={OPEN_LABEL} onPress={handleOpen} />
 *
 *   // In a Demo story, use the default (Button, md, rounded) or pick a specific kind:
 *   <TriggerButton label={OPEN_LABEL} onPress={handleOpen} />
 *   <TriggerButton kind="elevated" label={OPEN_LABEL} onPress={handleOpen} />
 *
 * Every kind exposes `accessibilityRole="button"` under the same accessible
 * name, so play functions need no changes:
 *   canvas.findByRole('button', { name: OPEN_LABEL })
 */

import { useState } from 'react';
import { Pressable } from 'react-native';
import type { ButtonVariant } from '../components/form/Button/button';
import { Button } from '../components/form/Button/button';
import type { ButtonShape, ButtonSize } from '../components/form/Button/button-scale';
import type { ElevatedVariant } from '../components/form/Button/elevated-button';
import { ElevatedButton } from '../components/form/Button/elevated-button';
import type { GlossyVariant } from '../components/form/Button/glossy-button';
import { GlossyButton } from '../components/form/Button/glossy-button';
import { Text } from '../components/typography/Text/text';
import { cn } from '../lib/cn';
import { Choice, ControlCard } from './story-harness';

// Private Tailwind class maps for the bare Pressable kind, mirroring ButtonMetrics.
// Kept before the exports so all non-exports precede all exports (useExportsLast).
const PRESSABLE_H: Record<string, string> = { sm: 'h-8', md: 'h-10', lg: 'h-12' };
const PRESSABLE_PX: Record<string, string> = { sm: 'px-3', md: 'px-4', lg: 'px-5' };
const PRESSABLE_SHAPE: Record<string, string> = { rounded: 'rounded-interactive', pill: 'rounded-full' };

// ─── Kinds ───────────────────────────────────────────────────────────────────

/** The trigger styles an overlay story can showcase. */
export type TriggerKind = 'button' | 'elevated' | 'glossy' | 'pressable';

/** Ordered list ready to pass directly to `<Choice options={TRIGGER_KINDS} />`. */
export const TRIGGER_KINDS: readonly TriggerKind[] = ['button', 'elevated', 'glossy', 'pressable'] as const;

// ─── Sizes & Shapes ──────────────────────────────────────────────────────────

/** Subset of `ButtonSize` that makes sense for a labelled trigger (excludes `icon`). */
export type TriggerSize = Exclude<ButtonSize, 'icon'>;

/** Sizes available in the trigger controls. */
export const TRIGGER_SIZES: readonly TriggerSize[] = ['sm', 'md', 'lg'] as const;

/** Shapes available in the trigger controls. */
export const TRIGGER_SHAPES: readonly ButtonShape[] = ['rounded', 'pill'] as const;

// ─── TriggerButton ───────────────────────────────────────────────────────────

export type TriggerButtonProps = {
  /** Which component to render. Defaults to `'button'`. */
  kind?: TriggerKind;
  /** Accessible label — used as button text and `accessibilityLabel`. */
  label: string;
  onPress: () => void;
  /** Visual size of the trigger button. Defaults to `'md'`. */
  size?: TriggerSize;
  /** Corner shape of the trigger button. Defaults to `'rounded'`. */
  shape?: ButtonShape;
  /**
   * `kind === 'button'` only. Variant forwarded to `Button`.
   * Defaults to `'primary'`.
   */
  buttonVariant?: ButtonVariant;
  /**
   * `kind === 'elevated'` only. Variant forwarded to `ElevatedButton`.
   * Defaults to `'neutral'`.
   */
  elevatedVariant?: ElevatedVariant;
  /**
   * `kind === 'glossy'` only. Variant forwarded to `GlossyButton`.
   * Defaults to `'neutral'` — the signature translucent glass key.
   */
  glossyVariant?: GlossyVariant;
  /**
   * `kind === 'pressable'` only. Extra Tailwind/UniWind classes merged onto
   * the `Pressable` wrapper — useful for one-off layout or colour overrides.
   */
  className?: string;
};

/**
 * Swappable trigger for overlay stories.
 *
 * | kind          | renders           | extra props              |
 * |---------------|-------------------|--------------------------|
 * | `'button'`    | `Button`          | `buttonVariant`          |
 * | `'elevated'`  | `ElevatedButton`  | `elevatedVariant`        |
 * | `'glossy'`    | `GlossyButton`    | `glossyVariant`          |
 * | `'pressable'` | bare `Pressable`  | `className`              |
 *
 * `size` and `shape` are forwarded to every kind so a single trigger state
 * object drives both appearance dimensions without re-shaping the props object.
 */
export function TriggerButton({
  kind = 'button',
  label,
  onPress,
  size = 'md',
  shape = 'rounded',
  buttonVariant = 'primary',
  elevatedVariant = 'neutral',
  glossyVariant = 'neutral',
  className,
}: TriggerButtonProps) {
  if (kind === 'elevated')
    return (
      <ElevatedButton className="self-start" onPress={onPress} shape={shape} size={size} variant={elevatedVariant}>
        {label}
      </ElevatedButton>
    );

  if (kind === 'glossy')
    return (
      <GlossyButton className="self-start" onPress={onPress} shape={shape} size={size} variant={glossyVariant}>
        {label}
      </GlossyButton>
    );

  if (kind === 'pressable')
    return (
      <Pressable
        accessibilityLabel={label}
        accessibilityRole="button"
        className={cn(
          'items-center justify-center self-start underline decoration-dashed underline-offset-4',
          PRESSABLE_H[size],
          PRESSABLE_PX[size],
          PRESSABLE_SHAPE[shape],
          className,
        )}
        onPress={onPress}
      >
        <Text size="sm" weight="medium" className="text-primary">
          {label}
        </Text>
      </Pressable>
    );

  return (
    <Button className="self-start" onPress={onPress} shape={shape} size={size} variant={buttonVariant}>
      {label}
    </Button>
  );
}

// ─── Trigger state hook + controls ───────────────────────────────────────────

/** Live state object returned by `useTriggerState`, passed to `TriggerControls`. */
export type TriggerState = {
  kind: TriggerKind;
  setKind: (next: TriggerKind) => void;
  size: TriggerSize;
  setSize: (next: TriggerSize) => void;
  shape: ButtonShape;
  setShape: (next: ButtonShape) => void;
};

/**
 * Returns the three-axis trigger state (kind, size, shape) with their setters.
 * Pass the result to `<TriggerControls state={…} />` and pick from it onto
 * `<TriggerButton>`.
 *
 * @example
 *   const trigger = useTriggerState();
 *   // in Controls:
 *   <TriggerControls state={trigger} />
 *   // trigger button:
 *   <TriggerButton kind={trigger.kind} size={trigger.size} shape={trigger.shape} label={…} onPress={…} />
 */
export function useTriggerState(): TriggerState {
  const [kind, setKind] = useState<TriggerKind>('button');
  const [size, setSize] = useState<TriggerSize>('md');
  const [shape, setShape] = useState<ButtonShape>('rounded');
  return { kind, setKind, size, setSize, shape, setShape };
}

/**
 * Three `Choice` chips — Kind, Size, Shape — ready to drop inside a `Controls`
 * block. Drives `TriggerButton` through the `TriggerState` object from
 * `useTriggerState`.
 */
type TriggerControlsProps = { state: TriggerState };

export function TriggerControls({ state }: TriggerControlsProps) {
  return (
    <ControlCard title="Trigger options">
      <Choice label="Button type" onChange={state.setKind} options={TRIGGER_KINDS} value={state.kind} />
      <Choice label="Size" onChange={state.setSize} options={TRIGGER_SIZES} value={state.size} />
      <Choice label="Shape" onChange={state.setShape} options={TRIGGER_SHAPES} value={state.shape} />
    </ControlCard>
  );
}
