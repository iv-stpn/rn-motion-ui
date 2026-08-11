// biome-ignore-all lint/style/noExcessiveLinesPerFile: combined feedback + menu showcase with inline state machines and play functions

import type { Meta, StoryObj } from '@storybook/react';
import type { ComponentType, ReactNode } from 'react';
import { useCallback, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import type { IconProps } from 'rn-motion-ui-icons/icon-props';
import { CameraLine } from 'rn-motion-ui-icons/icons/camera-line';
import { Document2Line } from 'rn-motion-ui-icons/icons/document-2-line';
import { LinkLine } from 'rn-motion-ui-icons/icons/link-line';
import { Message1Line as MessageSquare } from 'rn-motion-ui-icons/icons/message-1-line';
import { expect, screen, userEvent, within } from 'storybook/test';
import { Choice, ControlCard } from '../../../__stories__/story-harness';
import { useReducedMotion } from '../../../hooks/use-reduced-motion';
import { SPRING_SWAP } from '../../../lib/ease';
import { MotiView } from '../../../moti/components/view';
import { AnimatePresence } from '../../../moti/presence/animate-presence';
import { useThemeColors } from '../../../theme/use-theme-color';
import { Button } from '../../form/Button/button';
import { ThemedIcon } from '../../icon/themed-icon';
import { Text } from '../../typography/Text/text';
import { MorphingFAB } from './morphing-fab';

const meta = {
  title: 'Display/MorphingFAB',
  component: MorphingFAB,
  parameters: { layout: 'fullscreen' },
  args: { position: 'bottom-right', children: null },
} satisfies Meta<typeof MorphingFAB>;

type Story = StoryObj<typeof meta>;

// ── Helpers ──────────────────────────────────────────────────────────────────

type AppSurfaceProps = { children: ReactNode; hint: string };

// biome-ignore lint/style/useComponentExportOnlyModules: story helper
function AppSurface({ children, hint }: AppSurfaceProps) {
  return (
    <View className="min-h-[380px] flex-1 bg-surface-1">
      <View className="border-border border-b px-5 py-3">
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

type Action = { icon: ComponentType<IconProps>; label: string; onPress: () => void };

// biome-ignore lint/style/useComponentExportOnlyModules: story helper
function MenuAction({ icon, label, onPress }: Action) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      className="h-11 flex-row items-center gap-2.5 rounded-xl px-3 active:bg-surface-selected"
    >
      <ThemedIcon icon={icon} variant="secondary" size={18} />
      <Text className="text-foreground text-sm">{label}</Text>
    </Pressable>
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

// biome-ignore lint/style/useComponentExportOnlyModules: story helper
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
          <Text className="font-semibold text-foreground text-sm">{SENT_TITLE}</Text>
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
          <Text className="mt-3 font-semibold text-foreground text-sm">{ERROR_TITLE}</Text>
          <Text className="mt-1 text-center text-muted-foreground text-xs">{ERROR_BODY}</Text>
          <View className="mt-4">
            <Button variant="primary" size="sm" onPress={retry}>
              {RETRY}
            </Button>
          </View>
        </View>
      </MotiView>
    );

  const placeholderColor = colors['muted-foreground'];

  return (
    <MotiView key="form" from={enter} animate={{ opacity: 1, scale: 1, translateY: 0 }} exit={exit} transition={trans}>
      <View className="min-h-[150px] rounded-[16px] bg-muted px-4 py-3.5">
        <Text className="font-semibold text-foreground text-sm">{FEEDBACK_TITLE}</Text>
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
          <Button variant="secondary" size="md" onPress={close} disabled={status === 'sending'} className="w-full">
            {CANCEL}
          </Button>
        </View>
        <View className="flex-1">
          <Button
            variant="primary"
            size="md"
            onPress={submit}
            loading={status === 'sending'}
            disabled={status === 'sending' || message.trim().length === 0}
            className="w-full"
          >
            {/* biome-ignore lint/suspicious/noLeakedRender: both branches are string literals — no numeric leak */}
            {status === 'sending' ? SENDING : SUBMIT}
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

// biome-ignore lint/style/useComponentExportOnlyModules: story helper
function MorphingFABPlayground() {
  const [example, setExample] = useState<Example>('feedback');

  return (
    <AppSurface hint={PLAYGROUND_HINT}>
      <View className="gap-3 px-5">
        <ControlCard title="Example">
          <Choice label="Content" onChange={setExample} options={EXAMPLES} value={example} />
        </ControlCard>
      </View>
      {example === 'feedback' ? (
        <MorphingFAB
          expandedWidth={300}
          expandedHeight={230}
          icon={<ThemedIcon icon={MessageSquare} variant="secondary" size={20} />}
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
        <MorphingFAB expandedWidth={232} expandedHeight={192} accessibilityLabel="Open actions" triggerTestID="fab-trigger">
          {({ close }) => (
            <View className="gap-1 pt-1">
              <MenuAction icon={CameraLine} label="Take photo" onPress={close} />
              <MenuAction icon={Document2Line} label="Attach file" onPress={close} />
              <MenuAction icon={LinkLine} label="Copy link" onPress={close} />
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
            <MenuAction icon={CameraLine} label="Take photo" onPress={close} />
            <MenuAction icon={Document2Line} label="Attach file" onPress={close} />
            <MenuAction icon={LinkLine} label="Copy link" onPress={close} />
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
        icon={<ThemedIcon icon={MessageSquare} variant="secondary" size={20} />}
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
