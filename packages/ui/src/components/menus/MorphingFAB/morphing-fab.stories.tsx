import type { Meta, StoryObj } from '@storybook/react';
import type { ReactNode } from 'react';
import { useCallback, useState } from 'react';
import { TextInput, View } from 'react-native';
import { CameraLine } from 'rn-motion-ui-icons/icons/camera-line';
import { Document2Line } from 'rn-motion-ui-icons/icons/document-2-line';
import { LinkLine } from 'rn-motion-ui-icons/icons/link-line';
import { Message1Line as MessageSquare } from 'rn-motion-ui-icons/icons/message-1-line';
import { expect, screen, userEvent, within } from 'storybook/test';
import { ELEVATION_KEYS, ELEVATIONS, type ElevationKey } from '../../../__stories__/story-elevations';
import { Choice, ControlCard, Toggle } from '../../../__stories__/story-harness';
import { useReducedMotion } from '../../../hooks/use-reduced-motion';
import { SPRING_SWAP } from '../../../lib/ease';
import { MotiView } from '../../../moti/components/view';
import { AnimatePresence } from '../../../moti/presence/animate-presence';
import { useThemeColors } from '../../../theme/use-theme-color';
import { Button } from '../../buttons/Button/button';
import { ThemedIcon } from '../../icon/themed-icon';
import { MenuItem } from '../../rows/menu-item';
import { Text } from '../../typography/Text/text';
import { MorphingFAB } from './morphing-fab';

const meta = {
  title: 'Menus/MorphingFAB',
  component: MorphingFAB,
  parameters: { layout: 'fullscreen' },
  args: { position: 'bottom-right', children: null },
} satisfies Meta<typeof MorphingFAB>;

type Story = StoryObj<typeof meta>;

// ── Helpers ──────────────────────────────────────────────────────────────────

type AppSurfaceProps = { children: ReactNode; hint: string };

function AppSurface({ children, hint }: AppSurfaceProps) {
  return (
    <View className="min-h-[380px] flex-1 bg-surface-1">
      <View className="border-border border-b-[1.5px] px-5 py-3">
        <View className="h-2.5 w-24 rounded-full bg-muted-foreground/20" />
      </View>
      <View className="gap-3 p-5">
        <View className="h-2.5 w-3/4 rounded-full bg-muted-foreground/15" />
        <View className="h-2.5 w-1/2 rounded-full bg-muted-foreground/15" />
        <View className="h-20 w-full rounded-2xl bg-muted-foreground/[0.06]" />
        <Text className="text-muted-foreground text-sm">{hint}</Text>
      </View>
      {children}
    </View>
  );
}

// ── Inline feedback pane (story-only — not a public component) ───────────────

type FeedbackStatus = 'form' | 'sending' | 'sent' | 'error';

type FeedbackPaneProps = { close: () => void };

const FEEDBACK_TITLE = 'Help us improve';
const CANCEL = 'Cancel';
const SENDING = 'Sending';
const SUBMIT = 'Submit';
const SENT_TITLE = 'Thanks!';
const SENT_BODY = 'Your feedback helps us build something better.';
const ERROR_TITLE = 'Something went wrong';
const ERROR_BODY = "We couldn't send your feedback. Please try again.";
const RETRY = 'Try again';
const SUBMIT_DELAY_MS = 600;

function resolveAfter(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

function FeedbackPane({ close }: FeedbackPaneProps) {
  const reduce = useReducedMotion();
  const colors = useThemeColors();
  const [status, setStatus] = useState<FeedbackStatus>('form');
  const [message, setMessage] = useState('');

  const submit = useCallback(async () => {
    if (message.trim().length === 0) return;
    setStatus('sending');
    try {
      await resolveAfter(SUBMIT_DELAY_MS);
      setStatus('sent');
    } catch {
      setStatus('error');
    }
  }, [message]);

  const retry = useCallback(() => setStatus('form'), []);

  const enter = reduce ? { opacity: 1, scale: 1, translateY: 0 } : { opacity: 0, scale: 0.97, translateY: 8 };
  const exit = reduce ? { opacity: 1, scale: 1, translateY: 0 } : { opacity: 0, scale: 0.97, translateY: -8 };
  const trans = reduce ? { type: 'timing' as const, duration: 0 } : SPRING_SWAP;

  if (status === 'sent')
    return (
      <MotiView key="sent" from={enter} animate={{ opacity: 1, scale: 1, translateY: 0 }} exit={exit} transition={trans}>
        <View className="items-center justify-center gap-1.5 rounded-[16px] bg-muted px-4 py-6">
          <View className="mb-1 h-10 w-10 items-center justify-center rounded-full bg-success">
            <ThemedIcon icon={MessageSquare} token="success-foreground" size={18} />
          </View>
          <Text weight="semibold" className="text-foreground text-sm">
            {SENT_TITLE}
          </Text>
          <Text className="text-center text-muted-foreground text-xs">{SENT_BODY}</Text>
        </View>
      </MotiView>
    );

  if (status === 'error')
    return (
      <MotiView key="error" from={enter} animate={{ opacity: 1, scale: 1, translateY: 0 }} exit={exit} transition={trans}>
        <View className="items-center rounded-[16px] bg-muted px-4 py-5">
          <View className="h-10 w-10 items-center justify-center rounded-full bg-danger">
            <ThemedIcon icon={MessageSquare} token="danger-foreground" size={18} />
          </View>
          <Text weight="semibold" className="mt-3 text-foreground text-sm">
            {ERROR_TITLE}
          </Text>
          <Text className="mt-1 text-center text-muted-foreground text-xs">{ERROR_BODY}</Text>
          <View className="mt-4">
            <Button variant="neutral" size="sm" onPress={retry}>
              {RETRY}
            </Button>
          </View>
        </View>
      </MotiView>
    );

  const placeholderColor = colors['muted-foreground'];
  const statusLabel = status === 'sending' ? SENDING : SUBMIT;

  return (
    <MotiView key="form" from={enter} animate={{ opacity: 1, scale: 1, translateY: 0 }} exit={exit} transition={trans}>
      <View className="min-h-[150px] rounded-[16px] bg-muted px-4 py-3.5">
        <Text weight="semibold" className="text-foreground text-sm">
          {FEEDBACK_TITLE}
        </Text>
        <TextInput
          value={message}
          editable={status !== 'sending'}
          onChangeText={setMessage}
          placeholder="Share an idea or report a bug"
          placeholderTextColor={placeholderColor}
          multiline={true}
          numberOfLines={3}
          accessibilityLabel="Feedback"
          testID="feedback-input"
          className="mt-2 min-h-[60px] w-full bg-transparent align-top text-foreground text-sm"
        />
      </View>
      <View className="flex-row items-center gap-2 px-1 pt-2 pb-1">
        <View className="flex-1">
          <Button variant="inverse" size="md" onPress={close} disabled={status === 'sending'} className="w-full">
            {CANCEL}
          </Button>
        </View>
        <View className="flex-1">
          <Button
            variant="neutral"
            size="md"
            onPress={submit}
            loading={status === 'sending'}
            disabled={status === 'sending' || message.trim().length === 0}
            className="w-full"
          >
            {statusLabel}
          </Button>
        </View>
      </View>
    </MotiView>
  );
}

// ── Playground ───────────────────────────────────────────────────────────────

const EXAMPLES = [
  { value: 'feedback', label: 'Feedback' },
  { value: 'menu', label: 'Menu' },
] as const;
type Example = (typeof EXAMPLES)[number]['value'];

const PLAYGROUND_HINT = 'Toggle between Feedback (form → sent/error) and Menu (3-action picker).';

function MorphingFABPlayground() {
  const [example, setExample] = useState<Example>('feedback');
  const [elevationKey, setElevationKey] = useState<ElevationKey>('3');
  const [floating, setFloating] = useState(false);
  const [overlay, setOverlay] = useState(false);
  const [closeOnOutside, setCloseOnOutside] = useState(true);

  return (
    <AppSurface hint={PLAYGROUND_HINT}>
      <View className="gap-3 px-5">
        <ControlCard title="Example">
          <Choice label="Content" onChange={setExample} options={EXAMPLES} value={example} />
          <Toggle label="Floating" onChange={setFloating} value={floating} />
          <Choice label="Elevation" onChange={setElevationKey} options={ELEVATION_KEYS} value={elevationKey} />
          <Toggle label="Show overlay" onChange={setOverlay} value={overlay} />
          <Toggle label="Close on outside" onChange={setCloseOnOutside} value={closeOnOutside} />
        </ControlCard>
      </View>
      {example === 'feedback' ? (
        <MorphingFAB
          expandedWidth={300}
          expandedHeight={230}
          floating={floating}
          elevation={ELEVATIONS[elevationKey]}
          overlay={overlay}
          closeOnOutsidePress={closeOnOutside}
          icon={MessageSquare}
          accessibilityLabel="Send feedback"
          triggerTestID="fab-trigger"
          closeIcon={null}
        >
          {({ close }) => (
            <AnimatePresence exitBeforeEnter={true}>
              <FeedbackPane close={close} />
            </AnimatePresence>
          )}
        </MorphingFAB>
      ) : (
        <MorphingFAB
          expandedWidth={232}
          expandedHeight={192}
          floating={floating}
          elevation={ELEVATIONS[elevationKey]}
          overlay={overlay}
          closeOnOutsidePress={closeOnOutside}
          accessibilityLabel="Open actions"
          triggerTestID="fab-trigger"
        >
          {({ close }) => (
            <View className="gap-1 pt-1">
              <MenuItem icon={CameraLine} label="Take photo" onPress={close} />
              <MenuItem icon={Document2Line} label="Attach file" onPress={close} />
              <MenuItem icon={LinkLine} label="Copy link" onPress={close} />
            </View>
          )}
        </MorphingFAB>
      )}
    </AppSurface>
  );
}

// ── Stories ──────────────────────────────────────────────────────────────────

/** Toggle between Feedback (form → sent/error) and Menu (3-action picker). */
export const Interactive: Story = { render: () => <MorphingFABPlayground /> };

/** FAB morphs into a 3-action menu. Open, verify the actions, pick one. */
export const ThreeActionMenu: Story = {
  name: 'Demo: 3-action menu',
  render: () => (
    <AppSurface hint="Tap the + button — the FAB morphs into a menu of three actions. Picking one closes the menu.">
      <MorphingFAB expandedWidth={232} expandedHeight={192} accessibilityLabel="Open actions" triggerTestID="fab-trigger">
        {({ close }) => (
          <View className="gap-1 pt-1">
            <MenuItem icon={CameraLine} label="Take photo" onPress={close} />
            <MenuItem icon={Document2Line} label="Attach file" onPress={close} />
            <MenuItem icon={LinkLine} label="Copy link" onPress={close} />
          </View>
        )}
      </MorphingFAB>
    </AppSurface>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = await canvas.findByTestId('fab-trigger');
    await userEvent.click(trigger);

    await expect(await screen.findByText('Take photo')).toBeTruthy();
    await expect(await screen.findByText('Attach file')).toBeTruthy();
    await expect(await screen.findByText('Copy link')).toBeTruthy();

    await userEvent.click(await screen.findByText('Take photo'));
    await expect(await canvas.findByTestId('fab-trigger')).toBeTruthy();
    await expect(screen.queryByText('Attach file')).toBeNull();
  },
};

/** FAB morphs into a feedback form. Type a message, submit, see the sent view. */
export const FeedbackForm: Story = {
  name: 'Demo: Feedback form',
  render: () => (
    <AppSurface hint="Tap the message icon to open the feedback form. Type a message and submit.">
      <MorphingFAB
        expandedWidth={300}
        expandedHeight={230}
        icon={MessageSquare}
        accessibilityLabel="Send feedback"
        triggerTestID="fab-trigger"
        closeIcon={null}
      >
        {({ close }) => (
          <AnimatePresence exitBeforeEnter={true}>
            <FeedbackPane close={close} />
          </AnimatePresence>
        )}
      </MorphingFAB>
    </AppSurface>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = await canvas.findByTestId('fab-trigger');
    await userEvent.click(trigger);

    await expect(await screen.findByText('Help us improve')).toBeTruthy();

    const input = await screen.findByTestId('feedback-input');
    await userEvent.type(input, 'Love the animations!');
    await userEvent.click(await screen.findByText('Submit'));

    await expect(await screen.findByText('Thanks!')).toBeTruthy();
  },
};

export default meta;
