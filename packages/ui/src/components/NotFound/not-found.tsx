import { MotiText, MotiView } from 'moti';
import { useEffect, useState } from 'react';
import { Pressable, type StyleProp, Text, View, type ViewStyle } from 'react-native';
import { useReducedMotion } from '../../hooks/use-reduced-motion';
import { SPRING_PANEL, SPRING_PRESS } from '../../lib/ease';
import { TextReveal } from '../TextReveal/text-reveal';

// ─── Shared types ──────────────────────────────────────────────────────────

export interface NotFoundProps {
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
}

const DEFAULT_CODE = '404';
const DEFAULT_TITLE = 'Page not found';
const DEFAULT_DESCRIPTION = 'The page you are looking for moved, vanished, or never existed.';

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

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'center' }}>
      <MotiView animate={{ scale: pressedHome && !reduce ? 0.96 : 1 }} transition={SPRING_PRESS}>
        <Pressable
          accessibilityRole="button"
          onPressIn={() => setPressedHome(true)}
          onPressOut={() => setPressedHome(false)}
          onPress={onHome}
          className="h-11 items-center justify-center rounded-full bg-primary px-6"
        >
          <Text className="text-sm font-medium text-primary-foreground">{homeLabel}</Text>
        </Pressable>
      </MotiView>

      <MotiView animate={{ scale: pressedBrowse && !reduce ? 0.96 : 1 }} transition={SPRING_PRESS}>
        <Pressable
          accessibilityRole="button"
          onPressIn={() => setPressedBrowse(true)}
          onPressOut={() => setPressedBrowse(false)}
          onPress={onBrowse}
          className="h-11 items-center justify-center rounded-full border border-border bg-card px-6"
        >
          <Text className="text-sm font-medium text-foreground">{browseLabel}</Text>
        </Pressable>
      </MotiView>
    </View>
  );
}

// ─── NotFoundStage ─────────────────────────────────────────────────────────

function NotFoundStage({
  children,
  style,
  testID,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
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

const GLYPHS = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789#%&@$?';
const SCRAMBLE_MS = 700;
const TICK_MS = 45;

function useScramble(text: string, reduce: boolean) {
  const [display, setDisplay] = useState(text);

  useEffect(() => {
    if (reduce) {
      setDisplay(text);
      return;
    }
    const chars = text.split('');
    const start = Date.now();
    let last = 0;

    const id = setInterval(() => {
      const now = Date.now();
      if (now - last >= TICK_MS) {
        last = now;
        const progress = Math.min((now - start) / SCRAMBLE_MS, 1);
        const settled = Math.floor(progress * chars.length);
        setDisplay(
          chars
            .map((ch, i) =>
              i < settled || ch === ' ' ? ch : (GLYPHS[Math.floor(Math.random() * GLYPHS.length)] ?? ch),
            )
            .join(''),
        );
      }
      if (now - start >= SCRAMBLE_MS) {
        clearInterval(id);
        setDisplay(text);
      }
    }, TICK_MS);

    return () => clearInterval(id);
  }, [text, reduce]);

  return display;
}

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
        {!reduce ? (
          <>
            <MotiText
              accessibilityElementsHidden
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
              accessibilityElementsHidden
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
        ) : null}
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
        <Text className="text-lg font-semibold text-foreground">{title}</Text>
        <Text className="text-sm text-muted-foreground" style={{ maxWidth: 320, textAlign: 'center' }}>
          {description}
        </Text>
      </View>

      <NotFoundActions onHome={onHome} homeLabel={homeLabel} onBrowse={onBrowse} browseLabel={browseLabel} />
    </NotFoundStage>
  );
}

// ─── NotFoundMagnetic ──────────────────────────────────────────────────────
// RN FALLBACK: The web version uses mouse-tracking per-character magnetic
// pull. On RN (touch, no mouse) each character springs on press.

export function NotFoundMagnetic({
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
  const chars = code.split('');

  return (
    <NotFoundStage style={style} testID={testID ?? 'not-found-magnetic'}>
      <View
        accessibilityRole="header"
        accessibilityLabel={code}
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}
      >
        {chars.map((ch, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed positional glyphs
          <MagneticChar key={i} ch={ch} reduce={reduce} />
        ))}
      </View>

      <View style={{ alignItems: 'center', gap: 8 }}>
        <Text className="text-lg font-semibold text-foreground">{title}</Text>
        <Text className="text-sm text-muted-foreground" style={{ maxWidth: 320, textAlign: 'center' }}>
          {description}
        </Text>
      </View>

      <NotFoundActions onHome={onHome} homeLabel={homeLabel} onBrowse={onBrowse} browseLabel={browseLabel} />
    </NotFoundStage>
  );
}

function MagneticChar({ ch, reduce }: { ch: string; reduce: boolean }) {
  const [pressed, setPressed] = useState(false);
  return (
    <Pressable accessibilityElementsHidden onPressIn={() => setPressed(true)} onPressOut={() => setPressed(false)}>
      <MotiView
        animate={{ scale: pressed && !reduce ? 1.15 : 1 }}
        transition={SPRING_PRESS}
        style={{ paddingHorizontal: 4 }}
      >
        <Text
          style={{
            fontSize: 100,
            fontWeight: 'bold',
            color: '#111111',
            fontVariant: ['tabular-nums'],
            letterSpacing: -2,
            lineHeight: 110,
          }}
        >
          {ch}
        </Text>
      </MotiView>
    </Pressable>
  );
}

// ─── NotFoundSpotlight ─────────────────────────────────────────────────────
// RN FALLBACK: The web version uses a CSS radial-gradient mask following the
// mouse cursor. On RN there is no mouse or CSS mask. We approximate with a
// pulsing opacity on the bright text layer over a dark background.

export function NotFoundSpotlight({
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
    <NotFoundStage style={style} testID={testID ?? 'not-found-spotlight'}>
      <View
        className="overflow-hidden rounded-3xl border border-border"
        style={{
          width: '100%',
          maxWidth: 480,
          aspectRatio: 16 / 9,
          backgroundColor: '#0a0a0a',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Dim base layer */}
        <Text
          accessibilityElementsHidden
          style={{
            position: 'absolute',
            fontSize: 96,
            fontWeight: 'bold',
            color: 'rgba(255,255,255,0.08)',
            fontVariant: ['tabular-nums'],
            letterSpacing: -4,
          }}
        >
          {code}
        </Text>
        {/* Bright pulsing layer (approximates the spotlight reveal) */}
        <MotiView
          from={{ opacity: reduce ? 0.9 : 0.6 }}
          animate={{ opacity: 0.95 }}
          transition={
            reduce
              ? { type: 'timing', duration: 0 }
              : { type: 'timing', duration: 1800, loop: true, repeatReverse: true }
          }
        >
          <Text
            accessibilityRole="header"
            testID="not-found-code"
            style={{
              fontSize: 96,
              fontWeight: 'bold',
              color: '#ffffff',
              fontVariant: ['tabular-nums'],
              letterSpacing: -4,
            }}
          >
            {code}
          </Text>
        </MotiView>
      </View>

      <View style={{ alignItems: 'center', gap: 8 }}>
        <Text className="text-lg font-semibold text-foreground">{title}</Text>
        <Text className="text-sm text-muted-foreground" style={{ maxWidth: 320, textAlign: 'center' }}>
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

  return (
    <NotFoundStage style={style} testID={testID ?? 'not-found-stacked'}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${code} stacked card`}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
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
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.08,
            shadowRadius: 3,
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
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.08,
            shadowRadius: 3,
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
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.12,
            shadowRadius: 8,
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
          <Text className="text-xs font-medium uppercase tracking-wide text-muted-foreground">out of the deck</Text>
        </MotiView>
      </Pressable>

      <View style={{ alignItems: 'center', gap: 8 }}>
        <Text className="text-lg font-semibold text-foreground">{title}</Text>
        <Text className="text-sm text-muted-foreground" style={{ maxWidth: 320, textAlign: 'center' }}>
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
        className="overflow-hidden rounded-xl border border-border"
        style={{
          width: '100%',
          maxWidth: 448,
          backgroundColor: '#0a0a0a',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.2,
          shadowRadius: 12,
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
          <Text style={{ marginLeft: 8, fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>~/beui</Text>
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
                reduce
                  ? { type: 'timing', duration: 0 }
                  : { type: 'timing', duration: 600, loop: true, repeatReverse: true }
              }
              style={{ width: 8, height: 16, backgroundColor: 'rgba(255,255,255,0.8)', marginLeft: 2, borderRadius: 1 }}
            />
          </View>
        </View>
      </View>

      <View style={{ alignItems: 'center', gap: 8 }}>
        <Text className="text-lg font-semibold text-foreground">{title}</Text>
        <Text className="text-sm text-muted-foreground" style={{ maxWidth: 320, textAlign: 'center' }}>
          {description}
        </Text>
      </View>

      <NotFoundActions onHome={onHome} homeLabel={homeLabel} onBrowse={onBrowse} browseLabel={browseLabel} />
    </NotFoundStage>
  );
}
