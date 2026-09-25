import { useCallback } from 'react';
import { Pressable, View } from 'react-native';
import { CloseLine } from 'rn-motion-ui-icons/icons/close-line';
import { GLASS_SURFACE } from '../../../lib/glass';
import { useThemeColor } from '../../../theme/use-theme-color';
import { IconButton } from '../../buttons/IconButton/icon-button';
import { Text } from '../../typography/Text/text';
import { Surface } from '../Surface/surface';
import { TOAST_STATUS_ICON } from './toast-icons';
import { TOAST_SIZE } from './toast-scale';
import type { ToastOptions } from './toast-types';
import { TOAST_FILL_TOKEN, TOAST_FOREGROUND_TOKEN, TOAST_GLASS_ALPHA } from './toast-variants';

type GlassToastProps = { message: string; options: ToastOptions; onDismiss: () => void; testID: string };

/** The same inexpensive Surface blur + SVG rim on native and web. Sonner still owns web lifecycle. */
export function GlassToast({ message, options, onDismiss, testID }: GlassToastProps) {
  const { variant = 'neutral', glassTone = 'variant', size = 'md', pill = true, description, action } = options;
  const neutral = glassTone === 'neutral';
  const fill = useThemeColor(TOAST_FILL_TOKEN[variant]);
  const ink = useThemeColor(neutral ? 'foreground' : TOAST_FOREGROUND_TOKEN[variant]);
  const secondaryInk = useThemeColor(neutral ? 'muted-foreground' : TOAST_FOREGROUND_TOKEN[variant]);
  const status = useThemeColor(neutral ? 'foreground' : TOAST_FOREGROUND_TOKEN[variant]);
  const geometry = TOAST_SIZE[size];
  const Icon = TOAST_STATUS_ICON[variant];
  const handleAction = useCallback(() => {
    action?.onPress();
  }, [action]);
  return (
    <Surface
      {...GLASS_SURFACE}
      floating={true}
      radius="menu"
      borderRadius={pill ? 9999 : undefined}
      tint={neutral ? undefined : fill}
      opacity={neutral ? 1 : TOAST_GLASS_ALPHA}
      className="max-w-full"
      testID={testID}
      accessibilityLiveRegion={variant === 'danger' ? 'assertive' : 'polite'}
    >
      <View
        className="flex-row items-center"
        style={{
          gap: geometry.gap,
          paddingStart: geometry.padX,
          paddingEnd: pill ? geometry.pillPadEnd : geometry.padX,
          paddingVertical: geometry.padY,
        }}
      >
        {Icon ? <Icon size={geometry.icon} color={status} /> : null}
        <View className="min-w-0 shrink gap-0.5">
          <Text size={geometry.message.token} weight="semibold" style={{ color: ink }}>
            {message}
          </Text>
          {description ? (
            <Text size={geometry.description} style={{ color: secondaryInk }}>
              {description}
            </Text>
          ) : null}
        </View>
        {action ? (
          <Pressable
            onPress={handleAction}
            accessibilityRole="button"
            testID={`${testID}-action`}
            className="min-h-11 justify-center px-2"
          >
            <Text size="sm" weight="semibold" style={{ color: ink }}>
              {action.label}
            </Text>
          </Pressable>
        ) : null}
        <IconButton
          icon={CloseLine}
          size="xs"
          iconColor={ink}
          onPress={onDismiss}
          accessibilityLabel="Dismiss notification"
          testID={`${testID}-dismiss`}
          contentClassName="bg-transparent"
        />
      </View>
    </Surface>
  );
}
