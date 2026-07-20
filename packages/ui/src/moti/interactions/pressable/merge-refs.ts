export function mergeRefs<T = unknown>(refs: Array<React.MutableRefObject<T> | React.LegacyRef<T>>): React.RefCallback<T> {
  return (value) => {
    for (const ref of refs) {
      if (typeof ref === 'function') ref(value);
      // biome-ignore lint/plugin: RefObject.current is readonly in the type; assigning it requires narrowing to a mutable ref, which only a cast expresses here
      else if (ref) (ref as React.MutableRefObject<T | null>).current = value;
    }
  };
}
