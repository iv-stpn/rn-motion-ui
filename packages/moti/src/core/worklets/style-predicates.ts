import type { Transforms } from '../types';

export const isColor = (styleKey: string) => {
  'worklet';
  const keys: Record<string, boolean> = {
    backgroundColor: true,
    borderBottomColor: true,
    borderLeftColor: true,
    borderRightColor: true,
    borderTopColor: true,
    color: true,
    shadowColor: true,
    borderColor: true,
    borderEndColor: true,
    borderStartColor: true,
  };
  return Boolean(keys[styleKey]);
};

export const isTransform = (styleKey: string) => {
  'worklet';
  const transforms: Record<string, boolean> = {
    perspective: true,
    rotate: true,
    rotateX: true,
    rotateY: true,
    rotateZ: true,
    scale: true,
    scaleX: true,
    scaleY: true,
    translateX: true,
    translateY: true,
    skewX: true,
    skewY: true,
  } satisfies Record<keyof Transforms, boolean>;
  return Boolean(transforms[styleKey]);
};
