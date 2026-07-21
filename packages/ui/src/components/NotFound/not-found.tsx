// biome-ignore-all lint/style/noExcessiveLinesPerFile: terminal-stage sub-components and animation variants collocated by design

import { useCallback, useState } from 'react';
import { Platform, Pressable, type StyleProp, Text, View, type ViewStyle } from 'react-native';
import { useReducedMotion } from '../../hooks/use-reduced-motion';
import { useScramble } from '../../hooks/use-scramble';
import { SPRING_PANEL, SPRING_PRESS } from '../../lib/ease';
import { MotiText } from '../../moti/components/text';
import { MotiView } from '../../moti/components/view';
import { TextReveal } from '../TextReveal/text-reveal';

// ─── Shared types ──────────────────────────────────────────────────────────

// biome-ignore lint/style/useExportsLast: props type before DEFAULT_CODE constant — collocated for readability
export type NotFoundProps = {
  code?: string;
  title?: string;
  description?: string;
  onHome?: () => void;
  homeLabel?: string;
  onBrowse?: () => void;
  browseLabel?: string;
  className?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

const DEFAULT_CODE = '404';
const DEFAULT_TITLE = 'Page not found';
const DEFAULT_DESCRIPTION = 'The page you are looking for moved, vanished, or never existed.';

const LABEL_OUT_OF_DECK = 'out of the deck';
const LABEL_TERMINAL_PROMPT = '~/beui';

// ─── NotFoundActions ───────────────────────────────────────────────────────

function NotFoundActions({
  onHome,
  homeLabel = 'Back home',
  onBrowse,
  browseLabel = 'Browse components',
}: Pick<NotFoundProps, 'onHome' | 'homeLabel' | 'onBrowse' | 'browseLabel'>) {
  const reduce = useReducedMotion();
  const [pressedHome, setPressedHome] = useState(false);
  const [pressedBrowse, setPressedBrowse] = useState(false);

  const handleHomePressIn = useCallback(() => setPressedHome(true), []);
  const handleHomePressOut = useCallback(() => setPressedHome(false), []);
  const handleBrowsePressIn = useCallback(() => setPressedBrowse(true), []);
  const handleBrowsePressOut = useCallback(() => setPressedBrowse(false), []);

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'center' }}>
      <MotiView animate={{ scale: pressedHome && !reduce ? 0.96 : 1 }} transition={SPRING_PRESS}>
        <Pressable
          accessibilityRole="button"
          onPressIn={handleHomePressIn}
          onPressOut={handleHomePressOut}
          onPress={onHome}
          className="h-11 items-center justify-center rounded-full bg-primary px-6"
        >
          <Text className="font-medium text-primary-foreground text-sm">{homeLabel}</Text>
        </Pressable>
      </MotiView>

      <MotiView animate={{ scale: pressedBrowse && !reduce ? 0.96 : 1 }} transition={SPRING_PRESS}>
        <Pressable
          accessibilityRole="button"
          onPressIn={handleBrowsePressIn}
          onPressOut={handleBrowsePressOut}
          onPress={onBrowse}
          className="h-11 items-center justify-center rounded-full border border-border bg-card px-6"
        >
          <Text className="font-medium text-foreground text-sm">{browseLabel}</Text>
        </Pressable>
      </MotiView>
    </View>
  );
}

// ─── NotFoundStage ─────────────────────────────────────────────────────────

export type NotFoundStageProps = { children: React.ReactNode; style?: StyleProp<ViewStyle>; testID?: string };

function NotFoundStage({ children, style, testID }: NotFoundStageProps) {
  return (
    <View
      testID={testID}
      style={[
        {
          flex: 1,
          minHeight: 360,
          alignItems: 'center',
          justifyContent: 'center',
          gap: 32,
          paddingHorizontal: 16,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

// ─── NotFoundGlitch ────────────────────────────────────────────────────────

export function NotFoundGlitch({
  code = DEFAULT_CODE,
  title = DEFAULT_TITLE,
  description = DEFAULT_DESCRIPTION,
  onHome,
  homeLabel,
  onBrowse,
  browseLabel,
  style,
  testID,
}: NotFoundProps) {
  const reduce = useReducedMotion();
  const display = useScramble(code, reduce);

  return (
    <NotFoundStage style={style} testID={testID ?? 'not-found-glitch'}>
      {/* Large code with chromatic ghost layers. */}
      <View style={{ position: 'relative', alignItems: 'center', justifyContent: 'center' }}>
        {/* Ghost layers for chromatic aberration (RN fallback: MotiText opacity+translateX) */}
        {reduce ? null : (
          <>
            <MotiText
              accessibilityElementsHidden={true}
              from={{ opacity: 0, translateX: 0 }}
              animate={{ opacity: 0.7, translateX: 3 }}
              transition={{ type: 'timing', duration: 150 }}
              style={{
                position: 'absolute',
                fontSize: 100,
                fontWeight: 'bold',
                color: '#ff0040',
                fontVariant: ['tabular-nums'],
                letterSpacing: -2,
              }}
            >
              {display}
            </MotiText>
            <MotiText
              accessibilityElementsHidden={true}
              from={{ opacity: 0, translateX: 0 }}
              animate={{ opacity: 0.7, translateX: -3 }}
              transition={{ type: 'timing', duration: 150 }}
              style={{
                position: 'absolute',
                fontSize: 100,
                fontWeight: 'bold',
                color: '#00e5ff',
                fontVariant: ['tabular-nums'],
                letterSpacing: -2,
              }}
            >
              {display}
            </MotiText>
          </>
        )}
        <Text
          accessibilityRole="header"
          testID="not-found-code"
          style={{
            fontSize: 100,
            fontWeight: 'bold',
            color: '#111111',
            fontVariant: ['tabular-nums'],
            letterSpacing: -2,
          }}
        >
          {display}
        </Text>
      </View>

      <View style={{ alignItems: 'center', gap: 8 }}>
        <Text className="font-semibold text-foreground text-lg">{title}</Text>
        <Text className="text-muted-foreground text-sm" style={{ maxWidth: 320, textAlign: 'center' }}>
          {description}
        </Text>
      </View>

      <NotFoundActions onHome={onHome} homeLabel={homeLabel} onBrowse={onBrowse} browseLabel={browseLabel} />
    </NotFoundStage>
  );
}

// ─── NotFoundStacked ───────────────────────────────────────────────────────

export function NotFoundStacked({
  code = DEFAULT_CODE,
  title = DEFAULT_TITLE,
  description = DEFAULT_DESCRIPTION,
  onHome,
  homeLabel,
  onBrowse,
  browseLabel,
  style,
  testID,
}: NotFoundProps) {
  const reduce = useReducedMotion();
  const [pressed, setPressed] = useState(false);
  const handlePressIn = useCallback(() => setPressed(true), []);
  const handlePressOut = useCallback(() => setPressed(false), []);

  return (
    <NotFoundStage style={style} testID={testID ?? 'not-found-stacked'}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${code} stacked card`}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={{ width: 256, height: 176, position: 'relative' }}
      >
        {/* Back card 1 */}
        <MotiView
          animate={
            pressed && !reduce
              ? { rotate: '-9deg', translateX: -28, translateY: 8 }
              : { rotate: '0deg', translateX: 0, translateY: 0 }
          }
          transition={SPRING_PANEL}
          className="absolute inset-0 rounded-3xl border border-border bg-card"
          style={{
            ...Platform.select({
              default: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 3 },
              web: { boxShadow: '0px 1px 3px rgba(0, 0, 0, 0.08)' },
            }),
            elevation: 2,
          }}
        />
        {/* Back card 2 */}
        <MotiView
          animate={
            pressed && !reduce
              ? { rotate: '9deg', translateX: 28, translateY: 8 }
              : { rotate: '0deg', translateX: 0, translateY: 0 }
          }
          transition={SPRING_PANEL}
          className="absolute inset-0 rounded-3xl border border-border bg-card"
          style={{
            ...Platform.select({
              default: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 3 },
              web: { boxShadow: '0px 1px 3px rgba(0, 0, 0, 0.08)' },
            }),
            elevation: 2,
          }}
        />
        {/* Front card */}
        <MotiView
          animate={pressed && !reduce ? { translateY: -6 } : { translateY: 0 }}
          transition={SPRING_PANEL}
          className="absolute inset-0 items-center justify-center rounded-3xl border border-border bg-card"
          style={{
            gap: 4,
            ...Platform.select({
              default: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 8 },
              web: { boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.12)' },
            }),
            elevation: 4,
          }}
        >
          <Text
            accessibilityRole="header"
            testID="not-found-code"
            style={{ fontSize: 72, fontWeight: 'bold', color: '#111111', lineHeight: 80, letterSpacing: -2 }}
          >
            {code}
          </Text>
          <Text className="font-medium text-muted-foreground text-xs uppercase tracking-wide">{LABEL_OUT_OF_DECK}</Text>
        </MotiView>
      </Pressable>

      <View style={{ alignItems: 'center', gap: 8 }}>
        <Text className="font-semibold text-foreground text-lg">{title}</Text>
        <Text className="text-muted-foreground text-sm" style={{ maxWidth: 320, textAlign: 'center' }}>
          {description}
        </Text>
      </View>

      <NotFoundActions onHome={onHome} homeLabel={homeLabel} onBrowse={onBrowse} browseLabel={browseLabel} />
    </NotFoundStage>
  );
}

// ─── NotFoundTerminal ──────────────────────────────────────────────────────

const TYPE_SPRING = { stiffness: 320, damping: 30, mass: 0.6 };

export function NotFoundTerminal({
  code = DEFAULT_CODE,
  title = DEFAULT_TITLE,
  description = DEFAULT_DESCRIPTION,
  onHome,
  homeLabel,
  onBrowse,
  browseLabel,
  style,
  testID,
}: NotFoundProps) {
  const reduce = useReducedMotion();

  return (
    <NotFoundStage style={style} testID={testID ?? 'not-found-terminal'}>
      <View
        className="overflow-hidden rounded-2xl border border-border"
        style={{
          width: '100%',
          maxWidth: 448,
          backgroundColor: '#0a0a0a',
          ...Platform.select({
            default: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 12 },
            web: { boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.2)' },
          }),
          elevation: 6,
        }}
      >
        {/* Title bar */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderBottomWidth: 1,
            borderBottomColor: 'rgba(255,255,255,0.08)',
          }}
        >
          <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: '#ff5f57' }} />
          <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: '#febc2e' }} />
          <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: '#28c840' }} />
          <Text style={{ marginLeft: 8, fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>{LABEL_TERMINAL_PROMPT}</Text>
        </View>

        {/* Terminal lines */}
        <View style={{ padding: 16, gap: 6 }}>
          <TextReveal
            text="$ cd /page"
            split="char"
            stagger={0.018}
            yOffset={0}
            spring={TYPE_SPRING}
            className="font-mono text-sm"
            style={{ opacity: 0.8 }}
          />
          <TextReveal
            text="cd: no such file or directory: /page"
            split="char"
            stagger={0.012}
            delay={0.45}
            yOffset={0}
            spring={TYPE_SPRING}
            className="font-mono text-sm"
            style={{ opacity: 1 }}
          />
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TextReveal
              text={`$ status ${code}`}
              split="char"
              stagger={0.018}
              delay={1.1}
              yOffset={0}
              spring={TYPE_SPRING}
              className="font-mono text-sm"
              style={{ opacity: 0.8 }}
              testID="not-found-code"
            />
            {/* Blinking cursor */}
            <MotiView
              from={{ opacity: 0 }}
              animate={{ opacity: reduce ? 1 : 1 }}
              transition={
                reduce ? { type: 'timing', duration: 0 } : { type: 'timing', duration: 600, loop: true, repeatReverse: true }
              }
              style={{ width: 8, height: 16, backgroundColor: 'rgba(255,255,255,0.8)', marginLeft: 2, borderRadius: 1 }}
            />
          </View>
        </View>
      </View>

      <View style={{ alignItems: 'center', gap: 8 }}>
        <Text className="font-semibold text-foreground text-lg">{title}</Text>
        <Text className="text-muted-foreground text-sm" style={{ maxWidth: 320, textAlign: 'center' }}>
          {description}
        </Text>
      </View>

      <NotFoundActions onHome={onHome} homeLabel={homeLabel} onBrowse={onBrowse} browseLabel={browseLabel} />
    </NotFoundStage>
  );
}
