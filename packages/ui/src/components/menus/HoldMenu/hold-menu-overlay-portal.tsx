import { memo, type ReactNode, useMemo } from 'react';
import { OverlayPortal } from '../Overlay/overlay-host';
import { HoldMenuInternalContext, useHoldMenuInternal } from './context';

type HoldMenuOverlayPortalProps = {
  /** `menu` for the backdrop + menu, `twin` for a `HoldItem`'s lifted copy. */
  layer: 'menu' | 'twin';
  children: ReactNode;
};

/**
 * Teleports HoldMenu overlay content out of the `BlurTarget` into the
 * `BlurProvider` overlay host, carrying the provider's value on the node.
 *
 * The host renders its entries OUTSIDE the provider's React tree, where
 * `useContext` resolves to null — React context travels with the node it is
 * rendered under, not with the tree the element was created in, so the value
 * has to ride along inside the node the portal hands over. Baking it in is what
 * makes an entry self-sufficient: without it the teleported pieces would need a
 * module-level mirror of the value, and such a mirror's lifetime is not the
 * entry's — a provider unmounting while an entry it registered is still in the
 * host (or with a second provider mounted) nulls a slot the entry still depends
 * on, and the host's next render of it throws "HoldMenu components must be used
 * within a `<HoldMenuProvider>`". That throw is uncaught under the root and
 * killed the app on Android.
 *
 * Every HoldMenu teleport goes through here, so the wrap cannot be forgotten at
 * a call site — see `__tests__/teleport-context.test.ts`, which holds that line.
 */
const HoldMenuOverlayPortalComponent = ({ layer, children }: HoldMenuOverlayPortalProps) => {
  // Read in-tree, where the provider's own context still reaches us.
  const value = useHoldMenuInternal();

  // Memoised so the entry's identity stays stable across renders — `OverlayPortal`
  // re-registers whenever its `children` change.
  const wrapped = useMemo(
    () => <HoldMenuInternalContext.Provider value={value}>{children}</HoldMenuInternalContext.Provider>,
    [value, children],
  );

  return <OverlayPortal layer={layer}>{wrapped}</OverlayPortal>;
};

export const HoldMenuOverlayPortal = memo(HoldMenuOverlayPortalComponent);
