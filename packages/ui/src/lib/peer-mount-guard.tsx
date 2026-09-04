import { Component, type ReactNode } from 'react';

/**
 * Contains a first-render failure of an optional-peer native view and renders
 * a fallback instead.
 *
 * The rn-motion-ui blur peers (`react-native-liquid-glassmorphism`) are
 * mounted through codegen'd Fabric components. When the native module is
 * installed in JS but NOT autolinked into the app, the component's view config
 * cannot be resolved and React throws ("View config not found for component
 * ...") the first time the view renders — not at `require` time. This boundary
 * converts that throw into the same graceful degradation the library already
 * has for a missing peer (tint fill / plain dim).
 *
 * Do NOT probe peers with `requireNativeComponent(name)` to detect this: the
 * probe REGISTERS the name in React Native's view-config registry, and a
 * codegen peer has already registered it when its JS was imported — the second
 * registration throws "Tried to register two views with the same name", which
 * degrades the surface exactly when the peer is present and should render
 * (2026-09-04, Android no-frost regression). The lazy config lookup at first
 * render is the correct and only signal.
 *
 * Internal to the package — not exported.
 */
export class PeerMountGuard extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
