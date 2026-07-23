/**
 * cn — joins class strings with last-wins conflict resolution for the utility
 * groups this library emits.
 *
 * Consumer `className` beats component defaults: when two classes target the
 * same utility group (bg-*, text-*, border-*, rounded-*, h-*, w-*, p-*, gap-*,
 * and the other groups listed below), only the last one in argument order is
 * kept. Values that share no group are always preserved.
 *
 * The resolver is intentionally scoped to the groups this library uses — it
 * does not attempt full tailwind-merge coverage, keeping zero runtime
 * dependencies. Guarantee: consumer className passed as the last argument
 * always wins over earlier component-default classes.
 */

// Each entry is [pattern-matching-the-base-class, group-key].
// Groups are matched against the class with responsive/state prefixes stripped.
const GROUP_PATTERNS: [RegExp, string][] = [
  // Layout
  // `flex-row/col/…` (flex-direction) is a different property from `flex-1/auto/…`
  // (the flex shorthand), so they get separate groups — otherwise `flex-row flex-1`
  // collapse into one group and the direction utility is dropped.
  [/^flex-(?:row|col|wrap|nowrap)$/, 'flex-direction'],
  [/^flex-(?:1|auto|initial|none)$/, 'flex'],
  [/^items-/, 'items'],
  [/^justify-/, 'justify'],
  [/^self-/, 'self'],
  [/^overflow(?:-[xy])?-/, 'overflow'],
  [/^z-/, 'z'],
  [/^inset(?:-[xy0]|-[trbl])?-/, 'inset'],
  [/^top-/, 'top'],
  [/^right-/, 'right'],
  [/^bottom-/, 'bottom'],
  [/^left-/, 'left'],
  [/^grow(?:-|$)/, 'grow'],
  [/^shrink(?:-|$)/, 'shrink'],
  // Sizing
  [/^w-/, 'w'],
  [/^min-w-/, 'min-w'],
  [/^max-w-/, 'max-w'],
  [/^h-/, 'h'],
  [/^min-h-/, 'min-h'],
  [/^max-h-/, 'max-h'],
  // Spacing
  [/^p-/, 'p'],
  [/^px-/, 'px'],
  [/^py-/, 'py'],
  [/^pt-/, 'pt'],
  [/^pr-/, 'pr'],
  [/^pb-/, 'pb'],
  [/^pl-/, 'pl'],
  [/^m-/, 'm'],
  [/^mx-/, 'mx'],
  [/^my-/, 'my'],
  [/^mt-/, 'mt'],
  [/^mr-/, 'mr'],
  [/^mb-/, 'mb'],
  [/^ml-/, 'ml'],
  [/^gap-x-/, 'gap-x'],
  [/^gap-y-/, 'gap-y'],
  [/^gap-/, 'gap'],
  // Typography — size before color so text-sm doesn't collide with text-foreground
  [/^text-(?:xs|sm|base|lg|xl|\dxl)$/, 'text-size'],
  [/^text-(?:left|center|right|justify)$/, 'text-align'],
  [/^font-(?:thin|extralight|light|normal|medium|semibold|bold|extrabold|black|\d+)$/, 'font-weight'],
  [/^font-(?:sans|serif|mono)$/, 'font-family'],
  [/^leading-/, 'leading'],
  [/^tracking-/, 'tracking'],
  // Color
  [/^text-/, 'text-color'],
  [/^bg-/, 'bg'],
  [/^ring-/, 'ring'],
  [/^shadow-/, 'shadow'],
  [/^opacity-/, 'opacity'],
  // Border — width patterns MUST precede the color catch-all. The color regex
  // `/^border-(?!\d)[a-z]/` matches the side letter in `border-b`/`border-t`/…,
  // so without this ordering `border-b border-border` collapses both into the
  // color group and the one-sided border WIDTH is silently dropped.
  [/^rounded/, 'rounded'],
  [/^border(?:-[trbl])?-\d/, 'border-width'],
  [/^border(?:$|-[trblxy]$)/, 'border-width'],
  [/^border-(?!\d)[a-z]/, 'border-color'],
  // Transforms
  [/^scale-/, 'scale'],
  [/^translate-x-/, 'translate-x'],
  [/^translate-y-/, 'translate-y'],
  [/^rotate-/, 'rotate'],
];

/**
 * Returns a stable group key for a class name, or null if the class belongs to
 * no known conflict group (safe to always keep).
 */
function getGroup(cls: string): string | null {
  // Strip responsive / state prefixes (e.g. "dark:", "hover:", "sm:").
  const colonIdx = cls.lastIndexOf(':');
  const base = colonIdx >= 0 ? cls.slice(colonIdx + 1) : cls;
  const prefix = colonIdx >= 0 ? cls.slice(0, colonIdx + 1) : '';
  for (const [pattern, group] of GROUP_PATTERNS) {
    if (pattern.test(base)) return `${prefix}${group}`;
  }
  return null;
}

const WHITESPACE_RE = /\s+/;

/** Joins truthy class strings with last-wins conflict resolution. */
export function cn(...classes: (string | undefined | null | false)[]): string {
  // Flatten all tokens into a single ordered list.
  const all: string[] = [];
  for (const arg of classes) {
    if (arg) {
      for (const cls of arg.split(WHITESPACE_RE)) {
        if (cls) all.push(cls);
      }
    }
  }

  // Walk right-to-left; keep the first (rightmost) winner per group.
  // Spread into a reversed copy so for...of gives string (not string|undefined).
  const seen = new Set<string>();
  const kept: string[] = [];
  for (const cls of [...all].reverse()) {
    const group = getGroup(cls);
    if (group === null || !seen.has(group)) {
      if (group !== null) seen.add(group);
      kept.unshift(cls);
    }
  }

  return kept.join(' ');
}
