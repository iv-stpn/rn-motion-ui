import { type RefObject, useEffect } from 'react';
import { Platform, type View } from 'react-native';

/** Let wheel gestures over the browser chrome reach the file pane below it. */
export function useFileSystemChromeScroll(rootRef: RefObject<View | null>) {
  // biome-ignore lint/plugin: a non-passive DOM listener needs explicit lifecycle cleanup
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const root: unknown = rootRef.current;
    if (!(root instanceof HTMLElement)) return;

    const handleWheel = (event: WheelEvent) => {
      if (event.defaultPrevented || event.ctrlKey || event.shiftKey || !event.deltaY) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const panes = [...root.querySelectorAll<HTMLElement>('*')].filter((node) => {
        if (!node.clientHeight || node.scrollHeight <= node.clientHeight) return false;
        const overflow = getComputedStyle(node).overflowY;
        return overflow === 'auto' || overflow === 'scroll';
      });
      // Native scrolling already owns gestures inside a pane (including menus).
      // Forwarding those would scroll twice or steal an inner scroller's edge.
      if (panes.some((node) => node.contains(target))) return;
      // Columns scroll independently. Prefer the column beneath the pointer.
      const pane =
        panes.find((node) => {
          const bounds = node.getBoundingClientRect();
          return event.clientX >= bounds.left && event.clientX <= bounds.right;
        }) ?? panes[0];
      if (!pane) return;
      const unit = [1, 16, pane.clientHeight][event.deltaMode] ?? 1;
      pane.scrollTop += event.deltaY * unit;
      event.preventDefault();
    };

    root.addEventListener('wheel', handleWheel, { passive: false });
    return () => root.removeEventListener('wheel', handleWheel);
  }, [rootRef]);
}
