import { useEffect, useState } from 'react';

const GLYPHS = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789#%&@$?';
const SCRAMBLE_MS = 700;
const TICK_MS = 45;

/**
 * Progressive character-scramble reveal. Cycles random glyphs left-to-right
 * until each character settles into its final value over `SCRAMBLE_MS`.
 * Replays from scratch whenever `text` changes. Skips animation when `reduce`
 * is true and returns `text` immediately.
 */
export function useScramble(text: string, reduce: boolean): string {
  const [display, setDisplay] = useState(text);

  // biome-ignore lint/plugin: setInterval-driven scramble animation cannot be expressed without useEffect — the interval must be set up and torn down whenever `text` or `reduce` changes
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
            .map((ch, i) => (i < settled || ch === ' ' ? ch : (GLYPHS[Math.floor(Math.random() * GLYPHS.length)] ?? ch)))
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
