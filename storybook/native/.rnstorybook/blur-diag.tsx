/**
 * TEMP on-device blur diagnostics for the storybook APK (2026-09-05).
 *
 * Symptom: on Android every menu overlay in blur mode shows only the dim.
 * The library's scrim blur needs three links to line up: the optional peer
 * JS module, its native ViewManagers (`BlurView`/`TargetView`), and a
 * mounted `BlurTarget` the scrim points at. This panel answers, on the
 * device, without logcat:
 *
 *  1. Does `require('@danielsaraldi/react-native-blur-view')` resolve and
 *     expose `BlurView`/`BlurTarget`?
 *  2. Do the `requireNativeComponent` probes pass (the library's own
 *     guards, same module-scope timing)?
 *  3. Does a RAW peer pair — `BlurTarget` wrapping stripes + a `BlurView`
 *     pointing at it, bypassing all rn-motion-ui wiring — frost the
 *     stripes? Frosted stripes = the peer blurs on this device/arch and the
 *     bug is in the library wiring; sharp stripes = the peer itself cannot
 *     blur here (arch/autolink/API-level issue).
 *
 * Remove this file (and its mount in preview.tsx) once the diagnosis is
 * settled.
 */

import { BlurTarget, BlurView } from '@danielsaraldi/react-native-blur-view';
import { useRef } from 'react';
import { Platform, requireNativeComponent, StyleSheet, Text, View } from 'react-native';

const STRIPES = ['#e5484d', '#f5a524', '#30a46c', '#6e56cf'];

function probeResult(label: string, fn: () => unknown): string {
  try {
    const out = fn();
    return `${label}: ok${out == null ? '' : ` -> ${typeof out}`}`;
  } catch (e) {
    return `${label}: THREW — ${e instanceof Error ? e.message : String(e)}`;
  }
}

// Module-scope probes, replicating the library's guarded resolution timing.
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
const blurViewProbe = probeResult('probe BlurView', () => requireNativeComponent('BlurView'));
const targetProbe = probeResult('probe TargetView', () => requireNativeComponent('TargetView'));

export function BlurDiag() {
  const targetRef = useRef<View | null>(null);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Blur diagnostics (temp)</Text>
      <Text style={styles.line}>{`platform: ${Platform.OS} api=${Platform.Version}`}</Text>
      <Text style={styles.line}>{moduleProbe}</Text>
      <Text style={styles.line}>{blurViewProbe}</Text>
      <Text style={styles.line}>{targetProbe}</Text>
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
      <Text style={styles.hint}>
        Stripes above: frosted/soft = RAW peer blurs on this device (bug is in library wiring). Sharp stripes = the peer itself
        does not blur here.
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
