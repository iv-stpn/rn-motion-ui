import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';
import { describe, expect, it } from 'vitest';

// On Android the HoldMenu overlay is teleported out of the `BlurTarget` into the
// `BlurProvider` overlay host, which renders it OUTSIDE the provider's React
// tree. React context does not cross that boundary on its own — it travels with
// the node it is RENDERED under, not with the tree the element was created in —
// so a teleported entry that does not carry the provider's value on its own node
// has to read it from somewhere else. It used to read a module-level mirror, and
// a provider unmounting while one of its entries was still registered nulled
// that mirror: the host's next render of the entry threw "HoldMenu components
// must be used within a `<HoldMenuProvider>`", uncaught, and killed the app.
// (Reproduced by closing a tab whose pane owned the only provider on screen.)
//
// The fix is structural and cannot be asserted by rendering here — these tests
// can't import react-native — so this file pins the structure that makes it
// hold: every hold-menu teleport goes through the one wrapper that bakes the
// value into the node, and nothing reads a module-level slot instead.
//
// Resolved from the vitest root (packages/ui) rather than import.meta.url — the
// jsdom environment doesn't hand this module a file: URL.
const HOLD_MENU_DIR = resolve(process.cwd(), 'src/components/menus/HoldMenu');

/** The component that owns the wrap. The only file allowed to teleport. */
const WRAPPER_FILE = 'hold-menu-overlay-portal.tsx';

/** A module-scope mutable binding — the shape of the hazard (see below). */
const MODULE_SCOPE_LET = /^let /m;

const read = (name: string) => readFileSync(resolve(HOLD_MENU_DIR, name), 'utf8');

const SOURCE_FILES = readdirSync(HOLD_MENU_DIR)
  .filter((name) => name.endsWith('.tsx'))
  .map((name) => ({ name, text: read(name) }));

describe('hold-menu teleport context', () => {
  it('teleports only through the wrapper that carries the value', () => {
    const offenders = SOURCE_FILES.filter(
      ({ name, text }) =>
        name !== WRAPPER_FILE && (text.includes("from '../Overlay/overlay-host'") || text.includes('<OverlayPortal')),
    ).map(({ name }) => name);

    expect(offenders).toEqual([]);
  });

  it('wraps the teleported node in the provider value', () => {
    const wrapper = read(WRAPPER_FILE);

    expect(wrapper).toContain('<OverlayPortal layer={layer}>');
    expect(wrapper).toContain('<HoldMenuInternalContext.Provider value={value}>');
  });

  it('routes both the menu and the twin through it', () => {
    expect(read('provider.tsx')).toContain('<HoldMenuOverlayPortal layer="menu">');
    expect(read('hold-item-twin.tsx')).toContain('<HoldMenuOverlayPortal layer="twin">');
  });

  it('leaves no module-level slot for the value to go stale in', () => {
    const context = readFileSync(resolve(HOLD_MENU_DIR, 'context.ts'), 'utf8');
    const reader = context.slice(context.indexOf('export const useHoldMenuInternal'));

    // A module-scope `let` (or a store subscription) is exactly the hazard: its
    // lifetime is not the consumer's. The reader resolves through `useContext`.
    expect(context).not.toMatch(MODULE_SCOPE_LET);
    expect(context).not.toContain('useSyncExternalStore');
    expect(reader).toContain('const value = useContext(HoldMenuInternalContext);');
  });
});
