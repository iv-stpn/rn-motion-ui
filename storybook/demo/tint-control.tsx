import { useCallback, useState } from 'react';
import { Platform } from 'react-native';
import { Button } from 'rn-motion-ui/button';
import { useMountEffect } from 'rn-motion-ui/hooks/use-mount-effect';
import { Input } from 'rn-motion-ui/input';
import { Caption, Row } from './demos/demo-chrome';

// The neutral-axis tint, edited live. On web the Apply button POSTs to the
// `/__tint` endpoint in metro.config.js, which writes tokens.config.json and
// regenerates the gitignored tokens.css, then reloads. A reload (rather than
// CSS HMR alone) is required because uniwind resolves each className to a
// concrete colour at render time and bakes it into an inline style, so a
// regenerated sheet can't recolor components that are already on screen.
// On native the endpoint is unreachable, so the control degrades to a note:
// edit tokens.config.json by hand and Fast Refresh recolors the app the same
// way.

const TINT_LABEL = 'Tint';
const HUE_LABEL = 'Hue';
const CHROMA_LABEL = 'Chroma';
const HUE_PLACEHOLDER = '270';
const CHROMA_PLACEHOLDER = '0.004';
const APPLY_LABEL = 'Apply';
const HINT = 'Retune the neutral axis — hue in degrees, chroma 0–0.4.';
const APPLYING_LABEL = 'Applying…';
const ERROR_LABEL = 'Check the values — hue (deg) and chroma (0–0.4).';
const NATIVE_NOTE = 'Native tints are baked at build time — edit tokens.config.json and Fast Refresh recolors the app.';
const DEFAULT_HUE = '270';
const DEFAULT_CHROMA = '0.004';
const MAX_CHROMA = 0.4;

type Status = 'idle' | 'applying' | 'error';

const CAPTIONS: Record<Status, string> = { idle: HINT, applying: APPLYING_LABEL, error: ERROR_LABEL };

/**
 * Live hue/chroma controls for the demo's token sheet.
 *
 * Syncs the fields with tokens.config.json on mount (so a hand-edit, or a reload
 * after an Apply, starts from the active tint rather than the canonical default),
 * then POSTs changes back on Apply. Web-only: native renders a note instead.
 */
export function TintControl() {
  const [hue, setHue] = useState(DEFAULT_HUE);
  const [chroma, setChroma] = useState(DEFAULT_CHROMA);
  const [status, setStatus] = useState<Status>('idle');

  useMountEffect(() => {
    if (Platform.OS !== 'web') return;
    fetch('/__tint')
      .then((res) => (res.ok ? res.json() : null))
      .then((config) => {
        if (config) {
          setHue(String(config.hue));
          setChroma(String(config.chroma));
        }
      })
      .catch(() => undefined);
  });

  const apply = useCallback(async () => {
    const parsedHue = Number(hue);
    const parsedChroma = Number(chroma);
    const hueValid = Number.isFinite(parsedHue);
    const chromaValid = Number.isFinite(parsedChroma) && parsedChroma >= 0 && parsedChroma <= MAX_CHROMA;
    if (!(hueValid && chromaValid)) {
      setStatus('error');
      return;
    }
    setStatus('applying');
    try {
      const res = await fetch('/__tint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hue: parsedHue, chroma: parsedChroma }),
      });
      const body = await res.json();
      if (!(res.ok && body.ok)) {
        setStatus('error');
        return;
      }
      // Re-resolve every className against the regenerated sheet (see the note
      // at the top of this file) by reloading once the sheet is on disk.
      globalThis.location.reload();
    } catch {
      setStatus('error');
    }
  }, [hue, chroma]);

  if (Platform.OS !== 'web')
    return (
      <Row label={TINT_LABEL}>
        <Caption>{NATIVE_NOTE}</Caption>
      </Row>
    );

  return (
    <>
      <Row label={TINT_LABEL}>
        <Input
          value={hue}
          onChange={setHue}
          placeholder={HUE_PLACEHOLDER}
          keyboardType="decimal-pad"
          size="sm"
          className="w-24"
          accessibilityLabel={HUE_LABEL}
        />
        <Input
          value={chroma}
          onChange={setChroma}
          placeholder={CHROMA_PLACEHOLDER}
          keyboardType="decimal-pad"
          size="sm"
          className="w-24"
          accessibilityLabel={CHROMA_LABEL}
        />
        <Button size="sm" variant="neutral" onPress={apply} disabled={status === 'applying'} accessibilityLabel={APPLY_LABEL}>
          {APPLY_LABEL}
        </Button>
      </Row>
      <Caption emphasis={status === 'error'}>{CAPTIONS[status]}</Caption>
    </>
  );
}
