/**
 * TriggerButton — reusable open-trigger for overlay Demo and Playground stories.
 *
 * Kept separate from story-harness.tsx because the harness is intentionally
 * built from bare `Pressable` — it must never answer a library-component query
 * so play-function selectors are unambiguous. TriggerButton uses Button /
 * ElevatedButton / GlossyButton / Pressable on purpose: overlay stories need to
 * showcase real launch styles, not harness chrome.
 *
 * Usage:
 *   import { TriggerButton, TRIGGER_KINDS, type TriggerKind } from '../../__stories__/story-trigger';
 *
 *   // In a playground, add a Choice for the kind:
 *   const [kind, setKind] = useState<TriggerKind>('button');
 *   <Choice label="Trigger" onChange={setKind} options={TRIGGER_KINDS} value={kind} />
 *   <TriggerButton kind={kind} label={OPEN_LABEL} onPress={handleOpen} />
 *
 *   // In a Demo story, use the default (Button) or pick a specific kind:
 *   <TriggerButton label={OPEN_LABEL} onPress={handleOpen} />
 *   <TriggerButton kind="elevated" label={OPEN_LABEL} onPress={handleOpen} />
 *
 * Every kind exposes `accessibilityRole="button"` under the same accessible
 * name, so play functions need no changes:
 *   canvas.findByRole('button', { name: OPEN_LABEL })
 */

import { Pressable } from 'react-native';
import type { ButtonVariant } from '../components/Button/button';
import { Button } from '../components/Button/button';
import type { ElevatedVariant } from '../components/Button/elevated-button';
import { ElevatedButton } from '../components/Button/elevated-button';
import type { GlossyVariant } from '../components/Button/glossy-button';
import { GlossyButton } from '../components/Button/glossy-button';
import { Text } from '../components/Text/text';
import { cn } from '../lib/cn';
import { useThemeColors } from '../theme/use-theme-color';

/** The trigger styles an overlay story can showcase. */
export type TriggerKind = 'button' | 'elevated' | 'glossy' | 'pressable';

/** Ordered list ready to pass directly to `<Choice options={TRIGGER_KINDS} />`. */
// biome-ignore lint/style/useComponentExportOnlyModules: the chip list belongs with the component it drives
export const TRIGGER_KINDS: readonly TriggerKind[] = ['button', 'elevated', 'glossy', 'pressable'] as const;

export type TriggerButtonProps = {
  /** Which component to render. Defaults to `'button'`. */
  kind?: TriggerKind;
  /** Accessible label — used as button text and `accessibilityLabel`. */
  label: string;
  onPress: () => void;
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
   * `kind === 'pressable'` only. Tailwind/NativeWind classes applied to the
   * `Pressable` wrapper — useful for one-off layout or colour overrides.
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
 * The per-kind props are all optional on one flat props type rather than a
 * discriminated union: a story flipping `kind` from a `Choice` would otherwise
 * have to re-shape its whole prop object on every change. Props for the kinds
 * not being rendered are simply ignored.
 */
export function TriggerButton({
  kind = 'button',
  label,
  onPress,
  buttonVariant = 'primary',
  elevatedVariant = 'neutral',
  glossyVariant = 'neutral',
  className,
}: TriggerButtonProps) {
  const colors = useThemeColors();

  if (kind === 'elevated')
    return (
      <ElevatedButton onPress={onPress} variant={elevatedVariant} style={{ alignSelf: 'flex-start' }}>
        {label}
      </ElevatedButton>
    );

  if (kind === 'glossy')
    return (
      <GlossyButton onPress={onPress} variant={glossyVariant} style={{ alignSelf: 'flex-start' }}>
        {label}
      </GlossyButton>
    );

  if (kind === 'pressable')
    return (
      <Pressable
        accessibilityLabel={label}
        accessibilityRole="button"
        className={cn('self-start rounded-lg px-4 py-2', className)}
        onPress={onPress}
      >
        <Text size="sm" weight="medium" style={{ color: colors.primary }}>
          {label}
        </Text>
      </Pressable>
    );

  return (
    <Button onPress={onPress} variant={buttonVariant} style={{ alignSelf: 'flex-start' }}>
      {label}
    </Button>
  );
}
