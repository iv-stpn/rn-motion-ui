import type { ComponentType } from 'react';

import type { IconProps } from 'rn-motion-ui-icons/icon-props';
import { CheckCircleLine } from 'rn-motion-ui-icons/icons/check-circle-line';
import { CloseCircleLine } from 'rn-motion-ui-icons/icons/close-circle-line';
import { InformationLine } from 'rn-motion-ui-icons/icons/information-line';
import { WarningLine } from 'rn-motion-ui-icons/icons/warning-line';

import type { ToastVariant } from './toast-types';

/**
 * The toast family's default status glyphs — the single place a semantic
 * variant's icon is decided. `danger` is the "error" state (the same rename the
 * Button palette uses), so it wears the close-circle; the neutral fill and the
 * Button fills (`primary` / `secondary` / `accent`) carry no glyph.
 *
 * Component references only, no JSX — each twin picks the glyph and colours it
 * itself (native resolves the ink to a string, web themes it through
 * `ThemedIcon`).
 */
export const TOAST_STATUS_ICON: Partial<Record<ToastVariant, ComponentType<IconProps>>> = {
  success: CheckCircleLine,
  danger: CloseCircleLine,
  warning: WarningLine,
  info: InformationLine,
};
