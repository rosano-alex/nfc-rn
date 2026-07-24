import { EventSubscription } from 'expo-modules-core';

import { HceManager } from './HceManager';
import {
  AdapterStateChangedEvent,
  FormatOptions,
  NdefRecord,
  NfcOptions,
  NfcTag,
  NfcXEventNames,
  SessionClosedEvent,
  TagDiscoveredEvent,
  TransceiveOptions,
  WriteOptions,
} from './NfcX.types';
import NativeNfcX from './NfcXModule';
import { bytesToHex, hexToBytes } from './binary';

/**
 * High-level, ergonomic NFC API. Wraps the native module 1:1 but converts
 * hex <-> bytes and gives each call a `{}` default for `options`.
 *
 * Every method other than `startScan`/`addTagDiscoveredListener` is
 * single-shot: it opens a scanning session, waits for one tag, performs the
 * operation, and tears the session down again. That mirrors how Core NFC
 * itself is meant to be used, and sidesteps the session-management footguns
 * `NfcAdapter.enableReaderMode` has on Android if you try to keep one open.
 */
export class NfcManager {
  readonly hce = new HceManager();

  isSupported(): Promise<boolean> {
    return NativeNfcX.isSupported();
  }

  /** iOS has no NFC toggle, so this just mirrors `isSupported()` there. */
  isEnabled(): Promise<boolean> {
    return NativeNfcX.isEnabled();
  }

  readTag(options: NfcOptions = {}): Promise<NfcTag> {
    return NativeNfcX.readTag(options);
  }

  /** The tag needs to already be NDEF-formatted — see `formatTag` otherwise. */
  writeTag(records: NdefRecord[], options: WriteOptions = {}): Promise<NfcTag> {
    return NativeNfcX.writeTag(records, options);
  }

  /** Pass `records` to write an initial message as part of formatting, or leave it out for a blank tag. */
  formatTag(records: NdefRecord[] | null = null, options: FormatOptions = {}): Promise<NfcTag> {
    return NativeNfcX.formatTag(records, options);
  }

  /** Permanent — the tag can never be written to or reformatted again. */
  makeReadOnly(options: NfcOptions = {}): Promise<NfcTag> {
    return NativeNfcX.makeReadOnly(options);
  }

  /** For ISO-DEP tags and use cases NDEF doesn't cover — smart cards, custom applets, etc. */
  async transceive(commandApdu: Uint8Array, options: TransceiveOptions = {}): Promise<Uint8Array> {
    const responseHex = await NativeNfcX.transceive(bytesToHex(commandApdu), options);
    return hexToBytes(responseHex);
  }

  cancelSession(): Promise<void> {
    return NativeNfcX.cancelSession();
  }

  /** Unlike the methods above, stays open and fires `onTagDiscovered` per tag until `stopScan()`. Read-only. */
  startScan(options: NfcOptions = {}): Promise<void> {
    return NativeNfcX.startScan(options);
  }

  stopScan(): Promise<void> {
    return NativeNfcX.stopScan();
  }

  addTagDiscoveredListener(listener: (event: TagDiscoveredEvent) => void): EventSubscription {
    return NativeNfcX.addListener(NfcXEventNames.TagDiscovered, listener);
  }

  /** Fires when a session ends abnormally — cancelled, timed out, tag lost, etc. */
  addSessionClosedListener(listener: (event: SessionClosedEvent) => void): EventSubscription {
    return NativeNfcX.addListener(NfcXEventNames.SessionClosed, listener);
  }

  /** Android only — never fires on iOS. */
  addAdapterStateChangedListener(
    listener: (event: AdapterStateChangedEvent) => void
  ): EventSubscription {
    return NativeNfcX.addListener(NfcXEventNames.AdapterStateChanged, listener);
  }
}
