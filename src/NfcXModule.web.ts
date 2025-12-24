import { registerWebModule, NativeModule } from 'expo';

// NfcXModule is not available on the web platform.
class NfcXModule extends NativeModule<{}> {}

export default registerWebModule(NfcXModule, 'NfcXModule');
