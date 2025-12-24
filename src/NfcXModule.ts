import { NativeModule, requireNativeModule } from 'expo';

declare class NfcXModule extends NativeModule<{}> {}

export default requireNativeModule<NfcXModule>('NfcX');
