// biome-ignore-all lint/style/useExportsLast: the component closes the module
/**
 * TEMP on-device blur diagnostics for the storybook APK (2026-09-05).
 *
 * Symptom: on Android every menu overlay in blur mode shows only the dim.
 * The library's scrim blur needs the optional peer JS module and a mounted
 * `BlurTarget` the scrim points at. This panel answers, on the device,
 * without logcat:
 *
 *  1. Does `require('@danielsaraldi/react-native-blur-view')` resolve and
 *     expose `BlurView`/`BlurTarget`?
 *  2. Does a RAW peer pair — `BlurTarget` wrapping stripes + a `BlurView`
 *     pointing at it, bypassing all rn-motion-ui wiring — frost the
 *     stripes? Frosted stripes = the peer blurs on this device/arch and the
 *     bug is in the library wiring; sharp stripes = the peer itself cannot
 *     blur here (arch/autolink/API-level issue).
 *
 * 2026-09-05 finding: the earlier requireNativeComponent probes in this
 * panel (and in the library) threw "Tried to register two views with the
 * same name BlurView/TargetView" — the peer is a CODEGEN peer whose JS
 * registers those names on import, so a second registration throws EXACTLY
 * when the peer is present. The library probes were removed; the
 * duplicate-registration throw is the positive signal.
 *
 * Remove this file (and its mount in preview.tsx) once the diagnosis is
 * settled.
 */
import { BlurTarget, BlurView } from '@danielsaraldi/react-native-blur-view';
import { useRef } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

const STRIPES = ['#e5484d', '#f5a524', '#30a46c', '#6e56cf'];
const TITLE = 'Blur diagnostics (temp)';
const HINT =
  'Stripes above: frosted/soft = RAW peer blurs on this device (bug is in library wiring). Sharp stripes = the peer itself does not blur here.';

// Module-scope peer resolution, replicating the library's guarded require.
let moduleProbe = 'peer require: —';
try {
  // biome-ignore lint/style/noCommonJs: diagnostic replica of the library's guarded optional-peer require
  const mod = require('@danielsaraldi/react-native-blur-view') as {
    BlurView?: unknown;
    BlurTarget?: unknown;
  };
  moduleProbe = `peer require: ok (BlurView=${typeof mod.BlurView}, BlurTarget=${typeof mod.BlurTarget})`;
} catch (e) {
  moduleProbe = `peer require: THREW — ${e instanceof Error ? e.message : String(e)}`;
}

export function BlurDiag() {
  const targetRef = useRef<View | null>(null);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{TITLE}</Text>
      <Text style={styles.line}>{`platform: ${Platform.OS} api=${Platform.Version}`}</Text>
      <Text style={styles.line}>{moduleProbe}</Text>
      <View style={styles.probeBox}>
        <BlurTarget ref={targetRef} style={StyleSheet.absoluteFill}>
          <View style={StyleSheet.absoluteFill}>
            <View style={styles.stripeRow}>
              {STRIPES.map((color) => (
                <View key={color} style={[styles.stripe, { backgroundColor: color }]} />
              ))}
            </View>
          </View>
        </BlurTarget>
        <BlurView blurTarget={targetRef} type="light" radius={12} pointerEvents="none" style={StyleSheet.absoluteFill} />
      </View>
      <Text style={styles.hint}>{HINT}</Text>
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
  stripeRow: { flex: 1, flexDirection: 'row' },
  stripe: { flex: 1 },
  probeBox: {
    width: '100%',
    height: 72,
    marginTop: 8,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  hint: { color: '#8f8f9c', fontSize: 9, marginTop: 6 },
});
