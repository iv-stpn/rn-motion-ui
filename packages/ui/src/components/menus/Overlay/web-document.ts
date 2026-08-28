// Minimal web-only DOM helpers — the RN package tsconfig omits the DOM lib, so
// the browser `document`/pointer globals aren't declared here. Mirrors
// HoverMenu's `WebNode`/`getWebDocument` (Reflect.get + a typeof guard, no cast).
import { Platform } from 'react-native';

type WebNode = { contains: (node: unknown) => boolean };
type WebDocument = {
  addEventListener: (type: 'pointerdown', listener: (event: WebPointerEvent) => void) => void;
  removeEventListener: (type: 'pointerdown', listener: (event: WebPointerEvent) => void) => void;
};

function isWebDocument(value: unknown): value is WebDocument {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof Reflect.get(value, 'addEventListener') === 'function' &&
    typeof Reflect.get(value, 'removeEventListener') === 'function'
  );
}

/** The `pointerdown` event's target, surfaced as `unknown` — the handler casts at the call site. */
export type WebPointerEvent = { target: unknown };

export function isWebNode(node: unknown): node is WebNode {
  return node !== null && typeof node === 'object' && typeof Reflect.get(node, 'contains') === 'function';
}

/** The browser `document`, typed narrowly; `undefined` off-web. */
export function getWebDocument(): WebDocument | undefined {
  if (Platform.OS !== 'web') return;
  const doc = Reflect.get(globalThis, 'document');
  return isWebDocument(doc) ? doc : undefined;
}
