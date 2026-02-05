import { EventSubscription } from 'expo-modules-core';

import NativeNfcX from './NfcXModule';
import { bytesToHex, hexToBytes } from './binary';
import {
  HceAidGroup,
  HceCategory,
  HceCommandEvent,
  HceDeactivatedEvent,
  NfcXEventNames,
} from './NfcX.types';

/**
 * Host Card Emulation control surface.
 *
 * **Android only.** Apple's Core NFC framework does not expose a public HCE
 * API to third-party apps — only Apple Pay/PassKit can emulate a card, via a
 * private entitlement Apple does not grant to general developers. On iOS
 * every method here rejects with `ERR_HCE_UNSUPPORTED_PLATFORM`; check
 * `isSupported()` before wiring up HCE UI.
 *
 * The static parts of AID registration (the `<service>`/`apduservice.xml`
 * Android requires at install time) are configured through this package's
 * Expo config plugin — see the README. `setAidGroups` additionally lets you
 * register AIDs dynamically at runtime via `CardEmulation.registerAidsForService`.
 */
export class HceManager {
  /** Whether this device can act as an NFC card (Android with HCE hardware support only). */
  isSupported(): Promise<boolean> {
    return NativeNfcX.hceIsSupported();
  }

  /**
   * Registers the AID groups this app's HCE service should respond to. AIDs
   * must be hex strings, 5-16 bytes. Safe to call repeatedly as the set of
   * AIDs the app cares about changes.
   */
  setAidGroups(groups: HceAidGroup[]): Promise<void> {
    return NativeNfcX.hceSetAidGroups(groups);
  }

  /**
   * Whether this app is currently the platform's default handler for the
   * given category (relevant mainly for "payment" — Android only lets one
   * app be the default payment HCE service at a time).
   */
  isDefaultServiceForCategory(category: HceCategory): Promise<boolean> {
    return NativeNfcX.hceIsDefaultServiceForCategory(category);
  }

  /**
   * Sends the response APDU (R-APDU) for the command most recently delivered
   * via `addCommandListener`. Android's `HostApduService.processCommandApdu`
   * is called from a Binder thread and expects either a synchronous or a
   * (via `sendResponseApdu`) asynchronous reply — this wraps the async path
   * so the JS-side handler can take its time (look up a value, hit a server, etc).
   */
  respond(responseApdu: Uint8Array): Promise<void> {
    return NativeNfcX.hceRespond(bytesToHex(responseApdu));
  }

  /** Fires for every command APDU (C-APDU) the emulated card receives. */
  addCommandListener(
    listener: (event: { commandApdu: Uint8Array; aid?: string }) => void
  ): EventSubscription {
    return NativeNfcX.addListener(
      NfcXEventNames.HceCommand,
      (event: HceCommandEvent) =>
        listener({ commandApdu: hexToBytes(event.commandApdu), aid: event.aid })
    );
  }

  /** Fires when the reader deselects this app's AID or moves out of range. */
  addDeactivatedListener(
    listener: (event: HceDeactivatedEvent) => void
  ): EventSubscription {
    return NativeNfcX.addListener(NfcXEventNames.HceDeactivated, listener);
  }
}
