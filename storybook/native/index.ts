import 'react-native-gesture-handler';
// Side-effect import: resolves every platform-twin subpath by package name so
// the release guard can assert the native twin reached the bundle. See the file.
import './native-twin-probe';
import { registerRootComponent } from 'expo';
import StorybookUIRoot from './.rnstorybook';

registerRootComponent(StorybookUIRoot);
