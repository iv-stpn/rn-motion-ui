import type { Ref, RefCallback, RefObject } from 'react';

export function mergeRefs<T = unknown>(refs: Array<RefObject<T> | Ref<T>>): RefCallback<T> {
  return (value) => {
    for (const ref of refs) {
      if (typeof ref === 'function') ref(value);
      else if (ref) ref.current = value;
    }
  };
}
