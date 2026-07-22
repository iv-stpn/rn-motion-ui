// biome-ignore-all lint/style/noExcessiveLinesPerFile: feedback flow, sent view, and star-rating sub-components collocated by design

import { type ReactNode, type RefObject, useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, type StyleProp, TextInput, View, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useReducedMotion } from '../../hooks/use-reduced-motion';
import { EASE_OUT, SPRING_PANEL } from '../../lib/ease';
import { AlertCircle, MessageSquare, X } from '../../lib/icons';
import { MotiText } from '../../moti/components/text';
import { MotiView } from '../../moti/components/view';
import { AnimatePresence } from '../../moti/presence/animate-presence';
import { useThemeColors } from '../../theme/use-theme-color';
import { Button } from '../Button/button';
import { Text } from '../Text/text';

// RN FALLBACK vs web: the web widget shares a framer `layout` on one shell that
// morphs its width/height between the 48px corner trigger and the full panel,
// with an SVG path-draw check and blur() transitions on the inner views. RN has
// no auto layout morph, backdrop blur, or SVG pathLength — the shell is a
// MotiView that springs its measured open size (width fixed, height flows from
// content) while AnimatePresence cross-fades/translates the trigger <-> panel and
// the form/sent/error views. The check scales+fades in (no stroke draw); blur is
// dropped. Outside-tap/escape dismiss becomes the X + Cancel buttons.

type Status = 'idle' | 'open' | 'sending' | 'sent' | 'error';

const SUCCESS_DURATION_MS = 1600;
// Open-morph duration; the field focus waits this long so the caret never
// appears inside a still-expanding panel (mirrors the web widget's staged focus).
const MORPH_OPEN_MS = 320;

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
  title?: string;
  placeholder?: string;
  icon?: ReactNode;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  testID?: string;
  /** Replace the close (×) icon in the panel header. Default: `<X size={12} color={mutedFg} />`. */
  closeIcon?: ReactNode;
  /** Replace the error-state alert icon. Default: `<AlertCircle size={20} color={destructiveColor} />`. */
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
  const colors = useThemeColors();
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

  return (
    <View
      testID={testID ?? 'feedback-widget'}
      style={[
        { position: 'absolute', bottom: 16, zIndex: 30, pointerEvents: 'box-none', ...(left ? { left: 16 } : { right: 16 }) },
        style,
      ]}
    >
      <MotiView
        animate={{ borderRadius: open ? 20 : 40 }}
        transition={reduce ? { type: 'timing', duration: 0 } : { type: 'timing', duration: 320, easing: EASE_OUT }}
        className="overflow-hidden border border-border bg-surface shadow-lg"
        style={{ position: 'absolute', bottom: 0, ...(left ? { left: 0 } : { right: 0 }) }}
      >
        <AnimatePresence exitBeforeEnter={true}>
          {open ? (
            <MotiView
              key="panel"
              from={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.97, translateY: 8 }}
              animate={{ opacity: 1, scale: 1, translateY: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.97, translateY: 8 }}
              transition={reduce ? { type: 'timing', duration: 120 } : SPRING_PANEL}
              style={{ width: 300, padding: 8 }}
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
            <MotiView
              key="trigger"
              from={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.92 }}
              transition={reduce ? { type: 'timing', duration: 120 } : SPRING_PANEL}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={accessibilityLabel ?? title}
                testID="feedback-trigger"
                onPress={handleOpen}
                className="h-12 w-12 items-center justify-center"
              >
                {icon ?? <MessageSquare size={20} color={colors.foreground} />}
              </Pressable>
            </MotiView>
          )}
        </AnimatePresence>
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
      from={reduce ? { opacity: 0 } : { opacity: 0, translateY: 8 }}
      animate={{ opacity: 1, translateY: 0 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, translateY: -8 }}
      transition={{ type: 'timing', duration: reduce ? 0 : 220, easing: EASE_OUT }}
    >
      <View className="rounded-[16px] bg-muted px-4 py-3.5" style={{ minHeight: 150 }}>
        <View className="flex-row items-start justify-between gap-3">
          <Text className="font-semibold text-foreground text-sm">{title}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            onPress={onClose}
            className="h-5 w-5 items-center justify-center rounded-full bg-foreground/[0.07]"
          >
            {closeIcon ?? <X size={12} color={colors['muted-foreground']} />}
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
          className="mt-2 w-full bg-transparent text-foreground text-sm"
          style={{ minHeight: 60, textAlignVertical: 'top' }}
        />
      </View>
      <View className="flex-row items-center gap-2 px-1 pt-2 pb-1">
        <View style={{ flex: 1 }}>
          <Button variant="secondary" size="md" onPress={onClose} disabled={busy} style={{ width: '100%' }}>
            {CANCEL_LABEL}
          </Button>
        </View>
        <View style={{ flex: 1 }}>
          <Button
            variant="primary"
            size="md"
            onPress={onSubmit}
            loading={busy}
            disabled={busy || message.trim().length === 0}
            style={{ width: '100%' }}
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
      from={reduce ? { opacity: 0 } : { opacity: 0, translateY: 8 }}
      animate={{ opacity: 1, translateY: 0 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, translateY: -8 }}
      transition={{ type: 'timing', duration: reduce ? 0 : 220, easing: EASE_OUT }}
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
                  transition={{ type: 'timing', duration: 600, delay: 180 + i * 20 }}
                  style={{
                    position: 'absolute',
                    height: 6,
                    width: 6,
                    borderRadius: 3,
                    backgroundColor: i % 2 === 0 ? colors.success : '#6366f1',
                  }}
                />
              ))}
          <MotiView
            from={reduce ? { scale: 1 } : { scale: 0 }}
            animate={{ scale: 1 }}
            transition={reduce ? { type: 'timing', duration: 0 } : { type: 'spring', stiffness: 500, damping: 22, delay: 40 }}
            className="h-12 w-12 items-center justify-center rounded-full"
            style={{ backgroundColor: colors.success }}
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
                  stroke={colors.surface}
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
  const colors = useThemeColors();
  return (
    <MotiView
      from={reduce ? { opacity: 0 } : { opacity: 0, translateY: 8 }}
      animate={{ opacity: 1, translateY: 0 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, translateY: -8 }}
      transition={{ type: 'timing', duration: reduce ? 0 : 220, easing: EASE_OUT }}
    >
      <View accessibilityRole="alert" className="items-center rounded-[16px] bg-muted px-4 py-5">
        <View className="h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
          {errorIcon ?? <AlertCircle size={20} color={colors.destructive} />}
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
