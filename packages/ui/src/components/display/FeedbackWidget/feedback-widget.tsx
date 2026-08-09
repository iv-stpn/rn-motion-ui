// biome-ignore-all lint/style/noExcessiveLinesPerFile: feedback flow, sent view, and star-rating sub-components collocated by design

import { type ReactNode, type RefObject, useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, type StyleProp, TextInput, View, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { CloseLine as X } from 'rn-motion-ui-icons/icons/close-line';
import { InformationLine as AlertCircle } from 'rn-motion-ui-icons/icons/information-line';
import { Message1Line as MessageSquare } from 'rn-motion-ui-icons/icons/message-1-line';
import { useReducedMotion } from '../../../hooks/use-reduced-motion';
import { cn } from '../../../lib/cn';
import { EASE_OUT, SPRING_SWAP } from '../../../lib/ease';
import { elevatedShadow, type SurfaceLevel, surfaceBackground } from '../../../lib/elevated';
import { MotiText } from '../../../moti/components/text';
import { MotiView } from '../../../moti/components/view';
import { AnimatePresence } from '../../../moti/presence/animate-presence';
import { useThemeColors } from '../../../theme/use-theme-color';
import { Button } from '../../form/Button/button';
import { ThemedIcon } from '../../icon/themed-icon';
import { Text } from '../../typography/Text/text';

type Status = 'idle' | 'open' | 'sending' | 'sent' | 'error';

const SUCCESS_DURATION_MS = 1600;
// Open-morph duration; the field focus waits this long so the caret never
// appears inside a still-expanding panel (mirrors the web widget's staged focus).
const MORPH_OPEN_MS = 420;

const CANCEL_LABEL = 'Cancel';
const SENDING_LABEL = 'Sending';
const SUBMIT_LABEL = 'Submit';
const SENT_TITLE = 'Thanks!';
const SENT_BODY = 'Your feedback helps us build something better.';
const ERROR_TITLE = 'Something went wrong';
const ERROR_BODY = "We couldn't send your feedback. Please try again.";
const RETRY_LABEL = 'Try again';

// Celebration sprinkles that burst from the success icon.
const SPRINKLES = Array.from({ length: 8 }, (_, i) => {
  const angle = (i / 8) * Math.PI * 2;
  return {
    x: Math.cos(angle) * 26,
    y: Math.sin(angle) * 26,
  };
});

export type FeedbackData = { message: string };

// biome-ignore lint/style/useExportsLast: props type before internal SentViewProps — collocated for readability
export type FeedbackWidgetProps = {
  /** Called on submit. May be async; the button shows a sending state until it resolves. */
  onSubmit?: (data: FeedbackData) => void | Promise<void>;
  position?: 'bottom-right' | 'bottom-left';
  /** Surface elevation (1–8) for the widget shell — drives the drop shadow + dark-mode rim. Defaults to 5. */
  elevation?: SurfaceLevel;
  title?: string;
  placeholder?: string;
  icon?: ReactNode;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  testID?: string;
  /** Replace the close (×) icon in the panel header. Default: `<X size={12} color={mutedForeground} />`. */
  closeIcon?: ReactNode;
  /** Replace the error-state alert icon. Default: `<AlertCircle size={20} color={dangerColor} />`. */
  errorIcon?: ReactNode;
};

type SentViewProps = { reduce: boolean };
type ErrorViewProps = { reduce: boolean; onRetry: () => void; errorIcon?: ReactNode };

type RenderFeedbackContentArgs = {
  status: Status;
  reduce: boolean;
  inputRef: RefObject<TextInput | null>;
  title: string;
  placeholder: string;
  message: string;
  busy: boolean;
  setMessage: (v: string) => void;
  close: () => void;
  submit: () => void;
  closeIcon?: ReactNode;
  errorIcon?: ReactNode;
};

function renderFeedbackContent({
  status,
  reduce,
  inputRef,
  title,
  placeholder,
  message,
  busy,
  setMessage,
  close,
  submit,
  closeIcon,
  errorIcon,
}: RenderFeedbackContentArgs): ReactNode {
  if (status === 'sent') return <SentView key="sent" reduce={reduce} />;
  if (status === 'error') return <ErrorView key="error" reduce={reduce} onRetry={submit} errorIcon={errorIcon} />;
  return (
    <FormView
      key="form"
      inputRef={inputRef}
      reduce={reduce}
      title={title}
      placeholder={placeholder}
      message={message}
      busy={busy}
      onChangeMessage={setMessage}
      onClose={close}
      onSubmit={submit}
      closeIcon={closeIcon}
    />
  );
}

export function FeedbackWidget({
  onSubmit,
  position = 'bottom-right',
  elevation = 5,
  title = 'Help us improve',
  placeholder = 'Share an idea or report a bug',
  icon,
  style,
  accessibilityLabel,
  testID,
  closeIcon,
  errorIcon,
}: FeedbackWidgetProps) {
  const reduce = useReducedMotion();
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<TextInput>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');

  const open = status !== 'idle';
  const busy = status === 'sending';
  const left = position === 'bottom-left';

  const clearCloseTimer = useCallback(() => {
    if (closeTimer.current === null) return;
    clearTimeout(closeTimer.current);
    closeTimer.current = null;
  }, []);

  const close = useCallback(() => {
    clearCloseTimer();
    setStatus('idle');
    setMessage('');
  }, [clearCloseTimer]);

  // biome-ignore lint/plugin: cleanup-only effect — cancels the auto-close timer on unmount to prevent setState after unmount
  useEffect(() => () => clearCloseTimer(), [clearCloseTimer]);

  // biome-ignore lint/plugin: deferred focus waits for the open-morph animation to settle before focusing the input — a setTimeout side effect
  useEffect(() => {
    if (status !== 'open') return;
    const t = setTimeout(() => inputRef.current?.focus(), reduce ? 0 : MORPH_OPEN_MS);
    return () => clearTimeout(t);
  }, [status, reduce]);

  const submit = useCallback(async () => {
    if (busy || message.trim().length === 0) return;
    setStatus('sending');
    try {
      await onSubmit?.({ message });
      setStatus('sent');
      clearCloseTimer();
      closeTimer.current = setTimeout(close, SUCCESS_DURATION_MS);
    } catch {
      // Keep the message so a rejected submission can be retried.
      setStatus('error');
    }
  }, [busy, message, onSubmit, clearCloseTimer, close]);

  const handleOpen = useCallback(() => {
    clearCloseTimer();
    setStatus('open');
  }, [clearCloseTimer]);

  // Staggered springs: width snaps open fast, height bounces — reads as unfolding.
  const morphTransition = reduce
    ? { type: 'timing' as const, duration: 0 }
    : ({
        type: 'spring' as const,
        stiffness: 200,
        damping: 18,
        mass: 0.95,
        width: { type: 'spring' as const, stiffness: 350, damping: 30, mass: 0.55 },
        borderRadius: { type: 'spring' as const, stiffness: 350, damping: 30, mass: 0.55 },
      } satisfies import('../../../moti/core/types').MotiTransition);

  return (
    <View
      testID={testID ?? 'feedback-widget'}
      style={[
        { position: 'absolute', bottom: 16, zIndex: 30, pointerEvents: 'box-none', ...(left ? { left: 16 } : { right: 16 }) },
        style,
      ]}
    >
      <MotiView
        animate={{
          width: open ? 300 : 48,
          height: open ? 230 : 48,
          borderRadius: open ? 20 : 40,
        }}
        transition={morphTransition}
        className={cn(
          'overflow-hidden border border-border',
          surfaceBackground(elevation),
          elevatedShadow(elevation),
          'absolute bottom-0',
        )}
        style={{ ...(left ? { left: 0 } : { right: 0 }) }}
      >
        {open ? (
          <MotiView
            from={reduce ? { opacity: 1 } : { opacity: 0, translateY: 6 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={
              reduce
                ? { type: 'timing' as const, duration: 0 }
                : { type: 'timing' as const, duration: 200, delay: 150, easing: EASE_OUT }
            }
            className="w-[300px] p-2"
          >
            <AnimatePresence exitBeforeEnter={true}>
              {renderFeedbackContent({
                status,
                reduce,
                inputRef,
                title,
                placeholder,
                message,
                busy,
                setMessage,
                close,
                submit,
                closeIcon,
                errorIcon,
              })}
            </AnimatePresence>
          </MotiView>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel ?? title}
            testID="feedback-trigger"
            onPress={handleOpen}
            className="h-12 w-12"
          >
            <View className="flex-1 items-center justify-center">
              {icon ?? <ThemedIcon icon={MessageSquare} variant="secondary" size={20} />}
            </View>
          </Pressable>
        )}
      </MotiView>
    </View>
  );
}

export type FormViewProps = {
  inputRef: RefObject<TextInput | null>;
  reduce: boolean;
  title: string;
  placeholder: string;
  message: string;
  busy: boolean;
  onChangeMessage: (v: string) => void;
  onClose: () => void;
  onSubmit: () => void;
  closeIcon?: ReactNode;
};

function FormView({
  inputRef,
  reduce,
  title,
  placeholder,
  message,
  busy,
  onChangeMessage,
  onClose,
  onSubmit,
  closeIcon,
}: FormViewProps) {
  const colors = useThemeColors();
  return (
    <MotiView
      from={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.97, translateY: 8 }}
      animate={{ opacity: 1, scale: 1, translateY: 0 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.97, translateY: -8 }}
      transition={reduce ? { type: 'timing', duration: 0 } : SPRING_SWAP}
    >
      <View className="min-h-[150px] rounded-[16px] bg-muted px-4 py-3.5">
        <View className="flex-row items-start justify-between gap-3">
          <Text className="font-semibold text-foreground text-sm">{title}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            onPress={onClose}
            className="h-5 w-5 items-center justify-center rounded-full bg-surface-selected"
          >
            {closeIcon ?? <ThemedIcon icon={X} variant="ghost" size={12} />}
          </Pressable>
        </View>
        <TextInput
          ref={inputRef}
          value={message}
          editable={!busy}
          onChangeText={onChangeMessage}
          placeholder={placeholder}
          placeholderTextColor={colors['muted-foreground']}
          multiline={true}
          numberOfLines={3}
          accessibilityLabel={title}
          testID="feedback-input"
          className="mt-2 min-h-[60px] w-full bg-transparent align-top text-foreground text-sm"
        />
      </View>
      <View className="flex-row items-center gap-2 px-1 pt-2 pb-1">
        <View className="flex-1">
          <Button variant="secondary" size="md" onPress={onClose} disabled={busy} className="w-full">
            {CANCEL_LABEL}
          </Button>
        </View>
        <View className="flex-1">
          <Button
            variant="primary"
            size="md"
            onPress={onSubmit}
            loading={busy}
            disabled={busy || message.trim().length === 0}
            className="w-full"
          >
            {/* biome-ignore lint/suspicious/noLeakedRender: both branches are string literals — no numeric leak */}
            {busy ? SENDING_LABEL : SUBMIT_LABEL}
          </Button>
        </View>
      </View>
    </MotiView>
  );
}

function SentView({ reduce }: SentViewProps) {
  const colors = useThemeColors();
  return (
    <MotiView
      from={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.97, translateY: 8 }}
      animate={{ opacity: 1, scale: 1, translateY: 0 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.97, translateY: -8 }}
      transition={reduce ? { type: 'timing', duration: 0 } : SPRING_SWAP}
    >
      <View className="items-center justify-center gap-1.5 rounded-[16px] bg-muted px-4 py-6">
        <View className="mb-1 h-12 w-12 items-center justify-center">
          {reduce
            ? null
            : SPRINKLES.map((s, i) => (
                <MotiView
                  key={`${s.x}-${s.y}`}
                  from={{ opacity: 0, scale: 0, translateX: 0, translateY: 0 }}
                  animate={{ opacity: [0, 1, 0], scale: [0, 1, 0.4], translateX: s.x, translateY: s.y }}
                  transition={{ type: 'timing', duration: 600, delay: 180 + i * 20, easing: EASE_OUT }}
                  className="absolute h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: i % 2 === 0 ? colors['success-foreground'] : '#6366f1' }}
                />
              ))}
          <MotiView
            from={reduce ? { scale: 1 } : { scale: 0 }}
            animate={{ scale: 1 }}
            transition={reduce ? { type: 'timing', duration: 0 } : { type: 'spring', stiffness: 500, damping: 30, delay: 40 }}
            className="h-12 w-12 items-center justify-center rounded-full border"
            style={{ backgroundColor: colors.success, borderColor: colors.success }}
          >
            <MotiView
              from={reduce ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.4 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'timing', duration: reduce ? 0 : 300, delay: reduce ? 0 : 150 }}
            >
              <Svg width={20} height={20} viewBox="0 0 24 24">
                <Path
                  d="M5 12.5l4.5 4.5L19 7.5"
                  fill="none"
                  stroke={colors['success-foreground']}
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            </MotiView>
          </MotiView>
        </View>
        <Text className="font-semibold text-foreground text-sm">{SENT_TITLE}</Text>
        <MotiText className="text-center text-muted-foreground text-xs leading-relaxed">{SENT_BODY}</MotiText>
      </View>
    </MotiView>
  );
}

function ErrorView({ reduce, onRetry, errorIcon }: ErrorViewProps) {
  return (
    <MotiView
      from={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.97, translateY: 8 }}
      animate={{ opacity: 1, scale: 1, translateY: 0 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.97, translateY: -8 }}
      transition={reduce ? { type: 'timing', duration: 0 } : SPRING_SWAP}
    >
      <View accessibilityRole="alert" className="items-center rounded-[16px] bg-muted px-4 py-5">
        <View className="h-12 w-12 items-center justify-center rounded-full border border-danger bg-danger">
          {errorIcon ?? <ThemedIcon icon={AlertCircle} token="danger-foreground" size={20} />}
        </View>
        <Text className="mt-3 font-semibold text-foreground text-sm">{ERROR_TITLE}</Text>
        <Text className="mt-1 text-center text-muted-foreground text-xs leading-relaxed">{ERROR_BODY}</Text>
        <View className="mt-4">
          <Button variant="primary" size="sm" onPress={onRetry}>
            {RETRY_LABEL}
          </Button>
        </View>
      </View>
    </MotiView>
  );
}
