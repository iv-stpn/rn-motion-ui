import { createContext, type ReactNode, useCallback, useContext, useId, useMemo, useState } from 'react';
import { useMountEffect } from '../../../hooks/use-mount-effect';
import { clearClearance, maxClearance, reportClearance } from './dock-clearance';

/**
 * DockInset — exposes the floating dock's measured bottom clearance so
 * bottom-anchored controls (a FAB, a bulk-actions bar) clear the *actual* dock
 * instead of a hand-derived magic constant.
 *
 * Wrap the screen (or app) in {@link DockInsetProvider}. `MorphingDockSwitch`
 * reports its resting clearance (viewport bottom → dock top, so safe-area and
 * any host margin are already baked in) into the nearest provider;
 * {@link useDockInset} reads the resulting px. Without a provider the hook
 * returns `0`, so a consumer never breaks when no dock is present.
 */

type DockInsetContextValue = {
  /** The largest reported clearance (px), or 0 when no dock has reported. */
  bottom: number;
  report: (id: string, clearance: number) => void;
  clear: (id: string) => void;
};

const DockInsetContext = createContext<DockInsetContextValue>({
  bottom: 0,
  report: () => undefined,
  clear: () => undefined,
});

export type DockInsetProviderProps = { children: ReactNode };

/** Holds the dock-clearance value and hands it to {@link useDockInset} consumers. */
export function DockInsetProvider({ children }: DockInsetProviderProps) {
  const [entries, setEntries] = useState<Record<string, number>>({});

  const report = useCallback((id: string, clearance: number) => {
    setEntries((prev) => reportClearance(prev, id, clearance));
  }, []);

  const clear = useCallback((id: string) => {
    setEntries((prev) => clearClearance(prev, id));
  }, []);

  const bottom = useMemo(() => maxClearance(entries), [entries]);
  const value = useMemo(() => ({ bottom, report, clear }), [bottom, report, clear]);

  return <DockInsetContext.Provider value={value}>{children}</DockInsetContext.Provider>;
}

/**
 * The dock's bottom clearance in px — the distance a bottom-anchored control
 * must lift itself to sit clear of the floating dock. `0` when no dock is
 * present (no provider, or the dock hasn't measured yet).
 */
// biome-ignore lint/style/useComponentExportOnlyModules: hook co-located with its provider — DockInsetProvider, useDockInset and useDockInsetReporter share one internal context and form a single cohesive API
export function useDockInset(): number {
  return useContext(DockInsetContext).bottom;
}

/**
 * Reports a clearance into the nearest `DockInsetProvider` for the lifetime of
 * the calling component. Used by `MorphingDockSwitch`; exported so other
 * dock-like surfaces can participate. Returns a no-op when no provider is
 * mounted.
 */
// biome-ignore lint/style/useComponentExportOnlyModules: hook co-located with its provider — DockInsetProvider, useDockInset and useDockInsetReporter share one internal context and form a single cohesive API
export function useDockInsetReporter(): (clearance: number) => void {
  const { report, clear } = useContext(DockInsetContext);
  const id = useId();
  const reportFn = useCallback((clearance: number) => report(id, clearance), [report, id]);
  useMountEffect(() => () => clear(id));
  return reportFn;
}
