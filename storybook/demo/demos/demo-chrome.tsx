// Layout chrome shared by the three demo tabs. Components only, so each panel
// composes the same stack and the tabs line up across a switch.

import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Text } from 'rn-motion-ui/text';

type PanelProps = { children: ReactNode };
type RowProps = { label: string; children: ReactNode };
type CaptionProps = { children: ReactNode; emphasis?: boolean };

/** The vertical stack every tab panel uses. */
export function Panel({ children }: PanelProps) {
  return <View className="gap-6">{children}</View>;
}

/** One labelled cluster of samples, wrapping on narrow screens. */
export function Row({ label, children }: RowProps) {
  return (
    <View className="gap-3">
      <Text className="text-muted-foreground text-xs uppercase tracking-wider">{label}</Text>
      <View className="flex-row flex-wrap items-center gap-3">{children}</View>
    </View>
  );
}

/**
 * A line of copy: the hint under a panel, or the readout under a live sample.
 * `emphasis` switches to the foreground colour once there is something to say.
 */
export function Caption({ children, emphasis }: CaptionProps) {
  return <Text className={emphasis ? 'text-foreground text-sm' : 'text-muted-foreground text-sm'}>{children}</Text>;
}
