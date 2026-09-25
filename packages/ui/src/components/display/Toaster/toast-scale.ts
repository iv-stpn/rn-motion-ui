/**
 * The Toaster's size ramp — the one place a toast's icon, text, gap and padding
 * are decided, so the native twin (`Text` size tokens + inline spacing) and the
 * web twin (inline px) read the same numbers and can't drift. Mirrors the button
 * family's `button-scale.ts`: data only, no React.
 *
 * The `message` field carries both the native `Text` size token and its px twin
 * because the twins spell font size differently — native through the `Text` size
 * token, web through an inline `fontSize`. `description` is one step under the
 * message on native; the web twin lets it inherit the toast's `fontSize`.
 */

import type { ToastSize } from './toast-types';

/** Geometry one size assigns to every toast of that size. */
export type ToastSizeGeometry = {
  /** Status glyph edge length in px. */
  icon: number;
  /** Message size — the native `Text` token and its px twin. */
  message: { token: 'xs' | 'sm' | 'base'; px: number };
  /** Description size — one step under the message on native. */
  description: 'xs' | 'sm';
  /** Icon↔text gap in px. */
  gap: number;
  /** Compact line height shared by the message and description, in px. */
  lineHeight: number;
  /** Leading / vertical padding in px. */
  padX: number;
  padY: number;
  /** Trailing padding for capsules, giving the text room before the curved edge. */
  pillPadEnd: number;
};

export const TOAST_SIZE: Record<ToastSize, ToastSizeGeometry> = {
  sm: {
    icon: 24,
    message: { token: 'xs', px: 12 },
    description: 'xs',
    gap: 10,
    lineHeight: 15,
    padX: 10,
    padY: 8,
    pillPadEnd: 18,
  },
  md: {
    icon: 28,
    message: { token: 'sm', px: 14 },
    description: 'sm',
    gap: 12,
    lineHeight: 17,
    padX: 10,
    padY: 8,
    pillPadEnd: 20,
  },
  lg: {
    icon: 32,
    message: { token: 'base', px: 16 },
    description: 'sm',
    gap: 14,
    lineHeight: 19,
    padX: 12,
    padY: 10,
    pillPadEnd: 24,
  },
};

export const TOAST_SIZE_DEFAULT: ToastSize = 'md';
