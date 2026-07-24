import { NativeModule, registerWebModule } from 'expo';

import { NfcXModuleEvents } from './NfcX.types';

const UNSUPPORTED = () =>
  Promise.reject(
    Object.assign(new Error('NFC is not supported on web by nfc-rn'), {
      code: 'ERR_NFC_UNSUPPORTED',
    })
  );

/**
 * Web has no counterpart to Core NFC / Android NFC (the experimental Web NFC
 * API only covers NDEF reads on Chrome for Android, behind a user gesture,
 * with no HCE and no formatting). Every method here rejects consistently so
 * callers can branch on `isSupported()` once instead of per-platform checks.
 */
class NfcXModuleWeb extends NativeModule<NfcXModuleEvents> {
  isSupported = () => Promise.resolve(false);
  isEnabled = () => Promise.resolve(false);

  readTag = UNSUPPORTED;
  writeTag = UNSUPPORTED;
  formatTag = UNSUPPORTED;
  makeReadOnly = UNSUPPORTED;
  transceive = UNSUPPORTED;
  cancelSession = () => Promise.resolve();

  startScan = UNSUPPORTED;
  stopScan = () => Promise.resolve();

  hceIsSupported = () => Promise.resolve(false);
  hceSetAidGroups = UNSUPPORTED;
  hceIsDefaultServiceForCategory = () => Promise.resolve(false);
  hceRespond = UNSUPPORTED;
}

export default registerWebModule(NfcXModuleWeb, 'NfcX');
