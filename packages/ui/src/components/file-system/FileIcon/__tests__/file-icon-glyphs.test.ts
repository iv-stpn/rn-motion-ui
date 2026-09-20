import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';
import { describe, expect, it } from 'vitest';

// react-native-svg parses a gradient stop's `offset` more strictly than
// `Number()` does: it matches the value against /^([+-]?\d+…)(%?)$/, which
// demands a leading digit. ".5" has none, so it warns and yields 0 — and since
// the stops are then sorted, every one of them collapses onto 0 and the
// gradient loses its ramp. That is how the paper glyph shipped flat white on
// native while looking right on web, where a browser accepts ".5" in an
// `offset`.
//
// The generator writes such a value with its leading zero (see
// `withLeadingDigit` in scripts/gen-file-icons.mjs). Nothing else in the suite
// reads the glyphs and the symptom only appears on a device, so the invariant
// is pinned here, on the generated text, rather than left to a device log.

// Resolved from the vitest root (packages/ui) rather than import.meta.url — the
// jsdom environment doesn't hand this module a file: URL.
const glyphs = readFileSync(resolve(process.cwd(), 'src/components/file-system/FileIcon/file-icon-glyphs.tsx'), 'utf8');

/** An attribute whose whole value is a number written with a leading dot. */
const LEADING_DOT_VALUE = /\b[a-zA-Z]+="[+-]?\.[0-9]/g;

/** An `offset` prop, however it is spelled — as a string or as an expression. */
const OFFSET_VALUE = /offset=(?:"([^"]*)"|\{([^}]*)\})/g;

/** A number, optionally a percentage — what `percentReg` upstream accepts. */
const PARSEABLE_OFFSET = /^[+-]?\d+(?:\.\d+)?%?$/;

/** Every `offset`, whether it is written as a string or as an expression. */
const offsetsOf = (source: string) =>
  [...source.matchAll(OFFSET_VALUE)].map(([, quoted, expression]) => (quoted ?? expression ?? '').trim());

describe('generated file-type glyphs', () => {
  it('writes every numeric attribute value with a leading digit', () => {
    // A value the generator leaves dot-leading is one it thought was a
    // mini-language; `d` and `transform` are the only ones that may be.
    expect(glyphs.match(LEADING_DOT_VALUE)).toBeNull();
  });

  it('hands react-native-svg offsets it can parse, rather than coercing them to 0', () => {
    const offsets = offsetsOf(glyphs);
    // Guards the scan itself: a rewrite that stopped matching would otherwise
    // leave the assertion below vacuously true.
    expect(offsets.length).toBeGreaterThan(0);
    expect(offsets.filter((offset) => !PARSEABLE_OFFSET.test(offset))).toEqual([]);
  });
});
