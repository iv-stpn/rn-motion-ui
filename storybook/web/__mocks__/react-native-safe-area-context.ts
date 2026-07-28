/** Stub for react-native-safe-area-context in the Storybook web environment. */
export const useSafeAreaInsets = () => ({ top: 0, bottom: 0, left: 0, right: 0 });
export const SafeAreaProvider = ({ children }: { children: React.ReactNode }) => children;
export const SafeAreaView = ({ children }: { children: React.ReactNode }) => children;
export const SafeAreaConsumer = ({ children }: { children: (insets: ReturnType<typeof useSafeAreaInsets>) => React.ReactNode }) =>
  children({ top: 0, bottom: 0, left: 0, right: 0 });
