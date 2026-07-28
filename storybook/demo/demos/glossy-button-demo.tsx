// GlossyButton tab: every variant, size, shape and state on one canvas, plus a
// press counter so the ripple and the press scale have something to report.

import { useCallback, useState } from 'react';
import { GlossyButton, type GlossyVariant } from 'rn-motion-ui/glossy-button';
import { Caption, Panel, Row } from './demo-chrome';

const VARIANTS = [
  'neutral',
  'inverse',
  'danger',
  'success',
  'warning',
  'info',
  'special',
  'gray',
] as const satisfies readonly GlossyVariant[];

const SIZES = ['sm', 'md', 'lg'] as const;

// Bare literals in JSX trip the repo's noJsxLiterals rule, so every label is a
// named constant.
const CONTINUE_LABEL = 'Continue';
const PILL_LABEL = 'Pill';
const RIPPLE_LABEL = 'Ripple';
const LOADING_LABEL = 'Loading';
const DISABLED_LABEL = 'Disabled';
const IDLE_NOTE = 'Press any button — the counter tracks every variant.';

function pressedLabel(count: number): string {
  if (count === 0) return IDLE_NOTE;
  return `Pressed ${count} ${count === 1 ? 'time' : 'times'}`;
}

export function GlossyButtonDemo() {
  const [count, setCount] = useState(0);
  const bump = useCallback(() => setCount((n) => n + 1), []);

  return (
    <Panel>
      <Caption emphasis={count > 0}>{pressedLabel(count)}</Caption>

      <Row label="Variants">
        {VARIANTS.map((variant) => (
          <GlossyButton key={variant} onPress={bump} variant={variant}>
            {variant}
          </GlossyButton>
        ))}
      </Row>

      <Row label="Sizes">
        {SIZES.map((size) => (
          <GlossyButton key={size} onPress={bump} size={size}>
            {CONTINUE_LABEL}
          </GlossyButton>
        ))}
      </Row>

      <Row label="Shape / ripple">
        <GlossyButton onPress={bump} shape="pill">
          {PILL_LABEL}
        </GlossyButton>
        <GlossyButton onPress={bump} pressScale={0.97} ripple={true}>
          {RIPPLE_LABEL}
        </GlossyButton>
      </Row>

      <Row label="States">
        <GlossyButton loading={true}>{LOADING_LABEL}</GlossyButton>
        <GlossyButton disabled={true}>{DISABLED_LABEL}</GlossyButton>
      </Row>
    </Panel>
  );
}
