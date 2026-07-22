// biome-ignore-all lint/style/noExcessiveLinesPerFile: terminal-stage sub-components and animation variants collocated by design

import { useCallback, useState } from 'react';
import { Pressable, type StyleProp, View, type ViewStyle } from 'react-native';
import { useReducedMotion } from '../../hooks/use-reduced-motion';
import { useScramble } from '../../hooks/use-scramble';
import { SPRING_PRESS } from '../../lib/ease';
import { MotiText } from '../../moti/components/text';
import { MotiView } from '../../moti/components/view';
import { Text } from '../Text/text';

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
            color: '#111111' /* theme-exempt: glitch aesthetic, intentionally near-black on both modes */,
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
