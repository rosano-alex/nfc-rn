import { NativeModule, requireNativeModule } from 'expo';

import {
  FormatOptions,
  HceAidGroup,
  HceCategory,
  NdefRecord,
  NfcOptions,
  NfcTag,
  NfcXModuleEvents,
  TransceiveOptions,
  WriteOptions,
} from './NfcX.types';

/**
 * Low-level native module spec. This maps 1:1 onto the functions exported by
 * ios/NfcXModule.swift and android/.../NfcXModule.kt — prefer the ergonomic
 * `NfcManager` (default export of the package) over calling this directly.
 */
declare class NfcXModule extends NativeModule<NfcXModuleEvents> {
  isSupported(): Promise<boolean>;
  isEnabled(): Promise<boolean>;

  readTag(options: NfcOptions): Promise<NfcTag>;
  writeTag(records: NdefRecord[], options: WriteOptions): Promise<NfcTag>;
  formatTag(records: NdefRecord[] | null, options: FormatOptions): Promise<NfcTag>;
  makeReadOnly(options: NfcOptions): Promise<NfcTag>;
  transceive(commandApduHex: string, options: TransceiveOptions): Promise<string>;
  cancelSession(): Promise<void>;

  startScan(options: NfcOptions): Promise<void>;
  stopScan(): Promise<void>;

  hceIsSupported(): Promise<boolean>;
  hceSetAidGroups(groups: HceAidGroup[]): Promise<void>;
  hceIsDefaultServiceForCategory(category: HceCategory): Promise<boolean>;
  hceRespond(responseApduHex: string): Promise<void>;
}

export default requireNativeModule<NfcXModule>('NfcX');
