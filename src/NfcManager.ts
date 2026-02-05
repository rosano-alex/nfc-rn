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
 * single-shot: it opens a native scanning session (an `NFCTagReaderSession`
 * on iOS, `NfcAdapter.enableReaderMode` on Android), waits for one tag,
 * performs the operation, and tears the session down — mirroring how Core
 * NFC itself is meant to be used, and avoiding session-management footguns
 * on Android.
 */
export class NfcManager {
  readonly hce = new HceManager();

  /** Whether this device has NFC hardware capable of tag reading. */
  isSupported(): Promise<boolean> {
    return NativeNfcX.isSupported();
  }

  /**
   * Whether NFC is currently turned on. Always equal to `isSupported()` on
   * iOS (there's no user-facing NFC toggle); on Android this reflects the
   * system NFC radio setting.
   */
  isEnabled(): Promise<boolean> {
    return NativeNfcX.isEnabled();
  }

  /** Opens a scanning session, waits for a tag, and reads its NDEF message (if any). */
  readTag(options: NfcOptions = {}): Promise<NfcTag> {
    return NativeNfcX.readTag(options);
  }

  /** Opens a scanning session, waits for a tag, and writes `records` to it. The tag must already be NDEF-formatted. */
  writeTag(records: NdefRecord[], options: WriteOptions = {}): Promise<NfcTag> {
    return NativeNfcX.writeTag(records, options);
  }

  /**
   * Opens a scanning session, waits for a blank tag, and NDEF-formats it.
   * Pass `records` to write an initial message as part of formatting;
   * omit it (or pass `null`) to format with an empty message.
   */
  formatTag(records: NdefRecord[] | null = null, options: FormatOptions = {}): Promise<NfcTag> {
    return NativeNfcX.formatTag(records, options);
  }

  /**
   * Opens a scanning session, waits for a tag, and permanently locks it
   * read-only. **This cannot be undone** — the tag can never be written to
   * or reformatted again.
   */
  makeReadOnly(options: NfcOptions = {}): Promise<NfcTag> {
    return NativeNfcX.makeReadOnly(options);
  }

  /**
   * Opens a scanning session, waits for an ISO-DEP (ISO 14443-4) tag, and
   * sends a raw command APDU, returning the response APDU. For advanced use
   * cases NDEF doesn't cover (smart cards, custom applets, etc).
   */
  async transceive(commandApdu: Uint8Array, options: TransceiveOptions = {}): Promise<Uint8Array> {
    const responseHex = await NativeNfcX.transceive(bytesToHex(commandApdu), options);
    return hexToBytes(responseHex);
  }

  /** Cancels whichever single-shot operation or continuous scan is currently in flight. */
  cancelSession(): Promise<void> {
    return NativeNfcX.cancelSession();
  }

  /**
   * Starts a continuous scan: unlike the single-shot methods above, the
   * session stays open and `onTagDiscovered` fires for every tag until you
   * call `stopScan()`. Read-only — use the single-shot methods for writes.
   */
  startScan(options: NfcOptions = {}): Promise<void> {
    return NativeNfcX.startScan(options);
  }

  stopScan(): Promise<void> {
    return NativeNfcX.stopScan();
  }

  /** Fires for each tag seen while a continuous scan (`startScan`) is active. */
  addTagDiscoveredListener(listener: (event: TagDiscoveredEvent) => void): EventSubscription {
    return NativeNfcX.addListener(NfcXEventNames.TagDiscovered, listener);
  }

  /** Fires when a session ends without the caller's promise resolving normally (cancelled, timed out, tag lost, etc). */
  addSessionClosedListener(listener: (event: SessionClosedEvent) => void): EventSubscription {
    return NativeNfcX.addListener(NfcXEventNames.SessionClosed, listener);
  }

  /** Android only: fires when the user toggles NFC in system settings. Never fires on iOS. */
  addAdapterStateChangedListener(
    listener: (event: AdapterStateChangedEvent) => void
  ): EventSubscription {
    return NativeNfcX.addListener(NfcXEventNames.AdapterStateChanged, listener);
  }
}
