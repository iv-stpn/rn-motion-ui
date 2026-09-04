/**
 * On-device glass/blur diagnostics for the storybook APK (2026-09-04).
 *
 * Symptom under investigation: on Android 15 the 7.3.0 build shows NO frost,
 * NO blur and NO tint on every glass surface ("just transparency"), while web
 * is fine. The library's glass surfaces mount the optional peer's
 * `LiquidGlassView`; on API 33+ that view paints EVERYTHING through the AGSL
 * shader from a captured backdrop bitmap — the tint fallback paints only run
 * on the non-shader tiers — so a missing/empty backdrop capture renders a
 * fully transparent view. This panel answers, on the device, without logcat:
 *
 *  1. Does the JS side resolve the peer + probe cleanly (the library's guarded
 *     `requireNativeComponent` path)?
 *  2. What does `getGlassCapabilities()` claim on this OS?
 *  3. Does a RAW `LiquidGlassView` from the peer mount and report a native
 *     pipeline tier (`onPipelineReady`) or an error (`onError`)?
 *  4. Visually: does the raw peer pane frost/tint over the striped backdrop,
 *     and does the library `<Glass>` pane behave the same?
 *
 * Comparison panes sit over their own 4-colour stripes so the frost reads
 * regardless of the story behind them. Remove this file (and its mount in
 * preview.tsx) once the diagnosis is settled.
 */
import { type ReactNode, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  type GlassErrorInfo,
  type GlassPipelineInfo,
  getGlassCapabilities,
  LiquidGlassView,
} from 'react-native-liquid-glassmorphism';
import { Glass } from 'rn-motion-ui/glass';

const STRIPES = ['#e5484d', '#f5a524', '#30a46c', '#6e56cf'];

const CAPS = getGlassCapabilities();

/** Replicates the library's guarded resolution probe (glass.native.tsx /
 *  overlay-blur.native.tsx) so a mismatch between the probe and reality is
 *  visible on screen. */
function probeLibraryResolution(): string {
  try {
    // biome-ignore lint/style/noCommonJs: replicating the library's guarded dynamic require for diagnostics
    const mod = require('react-native-liquid-glassmorphism');
    if (!mod?.LiquidGlassView) return 'require ok, but LiquidGlassView export missing';
    // biome-ignore lint/style/noCommonJs: diagnostic replica of requireNativeComponent probe
    const { requireNativeComponent } = require('react-native');
    requireNativeComponent('LiquidGlassmorphismView');
    return 'ok (peer + ViewManager probe pass)';
  } catch (e) {
    return `DEGRADED: ${e instanceof Error ? e.message : String(e)}`;
  }
}

function Stripes() {
  return (
    <View style={StyleSheet.absoluteFill}>
      <View style={{ flex: 1, flexDirection: 'row' }}>
        {STRIPES.map((color) => (
          <View key={color} style={{ flex: 1, backgroundColor: color }} />
        ))}
      </View>
    </View>
  );
}

/** One probe pane: stripes behind + the glass surface above, caption below. */
function Probe({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={{ alignItems: 'center', gap: 4 }}>
      <View
        style={{
          width: 110,
          height: 72,
          borderRadius: 10,
          overflow: 'hidden',
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: 'rgba(255,255,255,0.4)',
        }}
      >
        <Stripes />
        {children}
      </View>
      <Text style={styles.caption}>{label}</Text>
    </View>
  );
}

export function GlassDiag() {
  const [probeResult] = useState(probeLibraryResolution);
  const [rawTier, setRawTier] = useState('native: —');
  const [rawError, setRawError] = useState('');

  const onPipelineReady = (e: { nativeEvent: GlassPipelineInfo }) =>
    setRawTier(`native tier=${e.nativeEvent.tier} sdk=${e.nativeEvent.osVersion} compiled=${e.nativeEvent.shaderCompiled}`);
  const onError = (e: { nativeEvent: GlassErrorInfo }) => {
    setRawTier(`native ERROR ${e.nativeEvent.code}`);
    setRawError(e.nativeEvent.message);
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Glass diagnostics (temp)</Text>
      <Text style={styles.line}>lib probe: {probeResult}</Text>
      <Text style={styles.line}>
        caps: tier={CAPS.tier} os={CAPS.osVersion} blur={String(CAPS.supportsBlur)} refraction={String(CAPS.supportsRefraction)}
      </Text>
      <View style={{ flexDirection: 'row', gap: 12, marginVertical: 6 }}>
        <Probe label="RAW peer">
          <LiquidGlassView
            rim={false}
            specular={false}
            thickness={0}
            blurRadius={12}
            tintColor="rgba(255,255,255,0.55)"
            style={StyleSheet.absoluteFill}
            onPipelineReady={onPipelineReady}
            onError={onError}
          />
        </Probe>
        <Probe label="lib <Glass>">
          <Glass blurRadius={12} borderRadius={10} rim={false} style={StyleSheet.absoluteFill} />
        </Probe>
      </View>
      <Text style={styles.line}>{rawTier}</Text>
      {rawError ? <Text style={[styles.line, { color: '#ffb4ab' }]}>{rawError.slice(0, 160)}</Text> : null}
      <Text style={styles.hint}>
        Frost over the stripes = working. Flat white panel = tint only. See-through = native paints nothing.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignSelf: 'stretch',
    backgroundColor: 'rgba(18, 18, 24, 0.92)',
    borderRadius: 12,
    padding: 10,
    marginBottom: 14,
  },
  title: { color: '#fff', fontWeight: '700', fontSize: 12 },
  line: { color: '#c9c9d4', fontSize: 10, marginTop: 2 },
  caption: { color: '#e8e8ee', fontSize: 10 },
  hint: { color: '#8f8f9c', fontSize: 9, marginTop: 4 },
});
