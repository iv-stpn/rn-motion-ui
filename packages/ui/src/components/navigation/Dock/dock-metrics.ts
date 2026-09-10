export const DOCK_GAP = 6;
export const DOCK_INSET = 4;
export const DOCK_ICON_SCALE = 1.12;
export const DOCK_CAPTION_HEIGHT = 12;
export const DOCK_INACTIVE_OPACITY = 0.5;

/** Shared target geometry; measurement must never feed an in-flight size back into a spring. */
export function dockMetrics(itemPx: number, labelled: boolean) {
  const iconSize = Math.round(itemPx / 2);
  const height = labelled
    ? Math.max(itemPx + Math.round((itemPx + DOCK_INSET * 2) * 0.23), Math.ceil(iconSize * DOCK_ICON_SCALE + 16))
    : itemPx;
  const stackHeight = iconSize * DOCK_ICON_SCALE + 2 + DOCK_CAPTION_HEIGHT;
  const iconCenter = labelled ? (height - stackHeight) / 2 + (iconSize * DOCK_ICON_SCALE) / 2 : itemPx / 2;
  return {
    width: itemPx * (labelled ? 1.44 : 1.2),
    height,
    iconSize,
    iconY: iconCenter - iconSize / 2,
    captionY: (height + stackHeight) / 2 - DOCK_CAPTION_HEIGHT,
  };
}

export function dockRowSize(itemPx: number, labelled: boolean, count: number) {
  const box = dockMetrics(itemPx, labelled);
  return { width: count * box.width + Math.max(0, count - 1) * DOCK_GAP, height: box.height };
}
