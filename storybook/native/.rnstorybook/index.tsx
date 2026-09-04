import AsyncStorage from '@react-native-async-storage/async-storage';
import { View } from 'react-native';
import { OverlayBlurHost } from 'rn-motion-ui/overlay/blur-host';
import { view } from './storybook.requires';

const StorybookUIRoot = view.getStorybookUI({
  storage: {
    getItem: AsyncStorage.getItem,
    setItem: AsyncStorage.setItem,
  },
});

export default function StorybookRoot() {
  return (
    <View style={{ flex: 1 }}>
      <StorybookUIRoot />
      {/* Android modal-menu backdrop blur — paints the plain-blur pane behind
          transparent Modal windows while a menu in overlay="blur" is open.
          No-op on iOS/web. See rn-motion-ui/overlay/blur-host. */}
      <OverlayBlurHost />
    </View>
  );
}
