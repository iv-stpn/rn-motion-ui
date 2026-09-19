import type { ComponentType } from 'react';

import type { IconProps } from 'rn-motion-ui-icons/icon-props';
import { CheckCircleFill } from 'rn-motion-ui-icons/icons/check-circle-fill';
import { CloseCircleFill } from 'rn-motion-ui-icons/icons/close-circle-fill';
import { InformationFill } from 'rn-motion-ui-icons/icons/information-fill';
import { WarningFill } from 'rn-motion-ui-icons/icons/warning-fill';

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
  success: CheckCircleFill,
  danger: CloseCircleFill,
  warning: WarningFill,
  info: InformationFill,
};
