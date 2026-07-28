import type { ReactNode } from 'react';
import { type Direction, DirectionContext } from './use-direction';

export type DirectionProviderProps = { value: Direction; children: ReactNode };

/**
 * States the writing direction for a subtree, for `useDirection` to read.
 *
 * This sets the direction the *library* reasons about. It lays nothing out by
 * itself — pair it with the platform's own mechanism so the two agree: on web
 * put `dir` on the wrapping element (react-native-web forwards it to the DOM
 * and to its own locale context), and on native let `I18nManager` flip rows.
 *
 * ```tsx
 * <View dir="rtl">
 *   <DirectionProvider value="rtl">{children}</DirectionProvider>
 * </View>
 * ```
 *
 * On web this is the only way to get an RTL subtree the library can see:
 * `I18nManager` is a no-op stub there, so nothing else reports the direction.
 */
export function DirectionProvider({ value, children }: DirectionProviderProps) {
  return <DirectionContext.Provider value={value}>{children}</DirectionContext.Provider>;
}
