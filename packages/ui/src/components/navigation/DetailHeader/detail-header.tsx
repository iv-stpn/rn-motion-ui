// biome-ignore-all lint/style/useExportsLast: the public action/props types head the module so the header sub-parts below read against them
import { type ReactNode, useCallback } from 'react';
import { Platform, type StyleProp, View, type ViewStyle } from 'react-native';
import type { IconProps } from 'rn-motion-ui-icons/icon-props';
import { ArrowLeftLine as ArrowLeft } from 'rn-motion-ui-icons/icons/arrow-left-line';
import { CloseLine as Close } from 'rn-motion-ui-icons/icons/close-line';
import { useSafeInsets } from '../../../hooks/use-safe-insets';
import { cn } from '../../../lib/cn';
import { Button } from '../../buttons/Button/button';
import { IconButton } from '../../buttons/IconButton/icon-button';
import { Text } from '../../typography/Text/text';

/**
 * DetailHeader — one header for a screen's detail chrome.
 *
 * Screens hand-rolled their own title + back/close + trailing actions, drifting
 * on testIDs, safe-area handling and the leading affordance. This collapses that
 * into a single component:
 *
 * - A **leading** affordance — a back arrow or a close ✕, defaulting to the
 *   platform convention (a pushed screen's back on native, a modal's close on
 *   web) and overridable via `leading`.
 * - A truncating **title**.
 * - Optional **trailing actions** — icon buttons, or labelled text buttons when
 *   an action has no icon.
 * - The top **safe-area inset** is applied as header padding (opt out with
 *   `safeArea={false}` when the screen already sits inside a `SafeAreaView`).
 *
 * The leading control derives `${testID}-leading` and each action
 * `${testID}-action-<id>` (an action's own `testID` wins).
 */

/** Icon renderer — compatible with this project's icon set signature. */
export type DetailHeaderIcon = (props: IconProps) => ReactNode;

/** One trailing action in the header. */
export type DetailHeaderAction = {
  /** Stable id — the action's key and the `${testID}-action-<id>` suffix. */
  id: string;
  /**
   * Leading icon. When present the action renders as an icon button (and `label`
   * is its accessible name); when omitted it renders as a labelled text button.
   */
  icon?: DetailHeaderIcon;
  /** Accessible name for an icon action; visible text for a labelled action. */
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  /** Overrides the derived `${testID}-action-<id>`. */
  testID?: string;
  /** Accessible name; falls back to `label` when omitted. */
  accessibilityLabel?: string;
};

/** The leading affordance. */
export type DetailHeaderLeading = 'back' | 'close' | 'none';

export type DetailHeaderProps = {
  /** Header title — truncated to one line. */
  title: ReactNode;
  /**
   * Leading affordance. Defaults to the platform convention — a back arrow on
   * native (a pushed screen), a close ✕ on web (a modal/detail pane).
   */
  leading?: DetailHeaderLeading;
  /** Called when the leading affordance is pressed. */
  onLeadingPress?: () => void;
  /** Accessible name for the leading affordance; defaults to 'Back' / 'Close'. */
  leadingLabel?: string;
  /** Trailing actions, right-aligned in order. */
  actions?: readonly DetailHeaderAction[];
  /** Called with the action on press, alongside the action's own `onPress`. */
  onAction?: (action: DetailHeaderAction) => void;
  /** Header height: 56 px or 64 px. @default 'md' */
  size?: 'md' | 'lg';
  /** Add the top safe-area inset as header padding. @default true */
  safeArea?: boolean;
  /** Merged onto the outer header. */
  style?: StyleProp<ViewStyle>;
  /** Root testID; the leading control derives `${testID}-leading` and actions `${testID}-action-<id>`. */
  testID?: string;
};

/** Header content height and title ramp per size. */
const HEADER_SIZE = {
  md: { heightClass: 'h-14', titleSize: 'base' as const },
  lg: { heightClass: 'h-16', titleSize: 'lg' as const },
};

type DetailHeaderActionButtonProps = {
  action: DetailHeaderAction;
  onPress: (action: DetailHeaderAction) => void;
  testID?: string;
};

/** One trailing action — icon button, or a labelled text button without an icon. */
function DetailHeaderActionButton({ action, onPress, testID }: DetailHeaderActionButtonProps) {
  const handlePress = useCallback(() => onPress(action), [onPress, action]);
  if (action.icon)
    return (
      <IconButton
        icon={action.icon}
        size="sm"
        disabled={action.disabled}
        onPress={handlePress}
        accessibilityLabel={action.accessibilityLabel ?? action.label}
        testID={testID}
      />
    );
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={action.disabled}
      onPress={handlePress}
      accessibilityLabel={action.accessibilityLabel ?? action.label}
      testID={testID}
    >
      {action.label}
    </Button>
  );
}

export function DetailHeader({
  title,
  leading,
  onLeadingPress,
  leadingLabel,
  actions,
  onAction,
  size = 'md',
  safeArea = true,
  style,
  testID,
}: DetailHeaderProps) {
  const insets = useSafeInsets();
  const resolvedLeading = leading ?? (Platform.OS === 'web' ? 'close' : 'back');
  const leadingIcon = resolvedLeading === 'close' ? Close : ArrowLeft;
  const leadingAccessibilityLabel = leadingLabel ?? (resolvedLeading === 'close' ? 'Close' : 'Back');
  const { heightClass, titleSize } = HEADER_SIZE[size];

  const handleAction = useCallback(
    (action: DetailHeaderAction) => {
      action.onPress?.();
      onAction?.(action);
    },
    [onAction],
  );

  const itemTestID = useCallback(
    (action: DetailHeaderAction) => action.testID ?? (testID ? `${testID}-action-${action.id}` : undefined),
    [testID],
  );

  return (
    <View testID={testID} style={[safeArea ? { paddingTop: insets.top } : undefined, style]}>
      <View className={cn('flex-row items-center justify-between gap-2 px-3', heightClass)}>
        {resolvedLeading === 'none' ? null : (
          <IconButton
            icon={leadingIcon}
            size="sm"
            onPress={onLeadingPress}
            accessibilityLabel={leadingAccessibilityLabel}
            testID={testID ? `${testID}-leading` : undefined}
          />
        )}

        <Text numberOfLines={1} weight="semibold" size={titleSize} className="min-w-0 flex-1 text-foreground">
          {title}
        </Text>

        <View className="flex-row items-center gap-1.5">
          {actions?.map((action) => (
            <DetailHeaderActionButton key={action.id} action={action} onPress={handleAction} testID={itemTestID(action)} />
          ))}
        </View>
      </View>
    </View>
  );
}
