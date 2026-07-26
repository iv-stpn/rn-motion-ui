import { StatusBar } from 'expo-status-bar';
import { type ReactNode, useCallback, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { GlossyButton, type GlossyVariant } from 'rn-motion-ui/glossy-button';
import './global.css';

const VARIANTS = [
  'neutral',
  'danger',
  'success',
  'warning',
  'info',
  'white',
  'gray',
  'dark',
] as const satisfies readonly GlossyVariant[];

const SIZES = ['sm', 'md', 'lg'] as const;

// Hoisted so no bare string literals land in JSX (the repo's noJsxLiterals rule).
const TITLE = 'GlossyButton';
const CONTINUE_LABEL = 'Continue';
const PILL_LABEL = 'Pill';
const RIPPLE_LABEL = 'Ripple';
const LOADING_LABEL = 'Loading';
const DISABLED_LABEL = 'Disabled';
const pressedLabel = (n: number) => `Pressed ${n} ${n === 1 ? 'time' : 'times'}`;

type RowProps = { label: string; children: ReactNode };

function Row({ label, children }: RowProps) {
  return (
    <View className="gap-3">
      <Text className="text-muted-foreground text-xs uppercase tracking-wider">{label}</Text>
      <View className="flex-row flex-wrap items-center gap-3">{children}</View>
    </View>
  );
}

export default function App() {
  const [count, setCount] = useState(0);
  const bump = useCallback(() => setCount((n) => n + 1), []);

  return (
    <View className="flex-1 bg-surface-1">
      <StatusBar style="auto" />
      <ScrollView contentContainerClassName="gap-8 px-6 pb-16 pt-24">
        <View className="gap-1">
          <Text className="font-semibold text-2xl text-foreground">{TITLE}</Text>
          <Text className="text-muted-foreground text-sm">{pressedLabel(count)}</Text>
        </View>

        <Row label="Variants">
          {VARIANTS.map((variant) => (
            <GlossyButton key={variant} variant={variant} onPress={bump}>
              {variant}
            </GlossyButton>
          ))}
        </Row>

        <Row label="Sizes">
          {SIZES.map((size) => (
            <GlossyButton key={size} size={size} onPress={bump}>
              {CONTINUE_LABEL}
            </GlossyButton>
          ))}
        </Row>

        <Row label="Shape / ripple">
          <GlossyButton shape="pill" onPress={bump}>
            {PILL_LABEL}
          </GlossyButton>
          <GlossyButton ripple={true} pressScale={0.97} onPress={bump}>
            {RIPPLE_LABEL}
          </GlossyButton>
        </Row>

        <Row label="States">
          <GlossyButton loading={true}>{LOADING_LABEL}</GlossyButton>
          <GlossyButton disabled={true}>{DISABLED_LABEL}</GlossyButton>
        </Row>
      </ScrollView>
    </View>
  );
}
