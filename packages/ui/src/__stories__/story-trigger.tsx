/**
 * TriggerButton — reusable open-trigger for overlay Demo and Playground stories.
 *
 * Kept separate from story-harness.tsx because the harness is intentionally
 * built from bare `Pressable` — it must never answer a library-component query
 * so play-function selectors are unambiguous. TriggerButton uses Button /
 * ElevatedButton / Pressable on purpose: overlay stories need to showcase real
 * launch styles, not harness chrome.
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
 * All three kinds expose `accessibilityRole="button"` under the same accessible
 * name, so play functions need no changes:
 *   canvas.findByRole('button', { name: OPEN_LABEL })
 */

import type { StyleProp, ViewStyle } from 'react-native';
import { Pressable } from 'react-native';
import type { ButtonVariant } from '../components/Button/button';
import { Button } from '../components/Button/button';
import type { ElevatedVariant } from '../components/Button/elevated-button';
import { ElevatedButton } from '../components/Button/elevated-button';
import { Text } from '../components/Text/text';
import { useThemeColors } from '../theme/use-theme-color';

/** The three trigger styles an overlay story can showcase. */
export type TriggerKind = 'button' | 'elevated' | 'pressable';

/** Ordered list ready to pass directly to `<Choice options={TRIGGER_KINDS} />`. */
// biome-ignore lint/style/useComponentExportOnlyModules: the chip list belongs with the component it drives
export const TRIGGER_KINDS: readonly TriggerKind[] = ['button', 'elevated', 'pressable'] as const;

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
   * `kind === 'pressable'` only. Tailwind/NativeWind classes applied to the
   * `Pressable` wrapper — useful for one-off layout or colour overrides.
   */
  className?: string;
  /**
   * `kind === 'pressable'` only. Inline style merged on top of the default
   * bordered-outline appearance. Pass `{}` to start from a blank slate.
   */
  style?: StyleProp<ViewStyle>;
};

/**
 * Swappable trigger for overlay stories.
 *
 * | kind          | renders           | extra props              |
 * |---------------|-------------------|--------------------------|
 * | `'button'`    | `Button`          | `buttonVariant`          |
 * | `'elevated'`  | `ElevatedButton`  | `elevatedVariant`        |
 * | `'pressable'` | bare `Pressable`  | `className`, `style`     |
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
  className,
  style,
}: TriggerButtonProps) {
  const colors = useThemeColors();

  if (kind === 'elevated')
    return (
      <ElevatedButton onPress={onPress} variant={elevatedVariant} style={{ alignSelf: 'flex-start' }}>
        {label}
      </ElevatedButton>
    );

  if (kind === 'pressable')
    return (
      <Pressable
        accessibilityLabel={label}
        accessibilityRole="button"
        className={className}
        onPress={onPress}
        style={[
          {
            alignSelf: 'flex-start',
            borderRadius: 12,
            borderWidth: 1.5,
            borderColor: colors.primary,
            paddingHorizontal: 16,
            paddingVertical: 10,
          },
          style,
        ]}
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
