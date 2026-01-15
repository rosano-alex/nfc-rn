/**
 * Shared type definitions for react-native-nfc-x.
 * These mirror the wire format sent across the Expo Modules bridge — native
 * code on both platforms produces/consumes exactly these shapes.
 */

/** Tag technologies. Not every tech is available on every platform/tag. */
export enum NfcTech {
  Ndef = 'Ndef',
  NdefFormatable = 'NdefFormatable',
  IsoDep = 'IsoDep',
  MifareClassic = 'MifareClassic',
  MifareUltralight = 'MifareUltralight',
  NfcA = 'NfcA',
  NfcB = 'NfcB',
  NfcF = 'NfcF',
  NfcV = 'NfcV',
  FeliCa = 'FeliCa',
  Iso15693 = 'Iso15693',
}

/** NDEF Type Name Format, as defined by the NFC Forum NDEF spec. */
export enum NdefTnf {
  EMPTY = 0x00,
  WELL_KNOWN = 0x01,
  MIME_MEDIA = 0x02,
  ABSOLUTE_URI = 0x03,
  EXTERNAL_TYPE = 0x04,
  UNKNOWN = 0x05,
  UNCHANGED = 0x06,
  RESERVED = 0x07,
}

/**
 * A single NDEF record. `type`, `id`, and `payload` are base64-encoded byte
 * strings — base64 is used (rather than raw JS strings) because payloads are
 * arbitrary binary and must survive the native<->JS bridge intact.
 */
export interface NdefRecord {
  tnf: NdefTnf;
  /** Base64-encoded record type (e.g. "VA==" for well-known type "T"). */
  type: string;
  /** Base64-encoded record id. Empty string if the record has no id. */
  id: string;
  /** Base64-encoded record payload. */
  payload: string;
}

export interface NdefMessage {
  records: NdefRecord[];
}

/** A tag observed by a scan or read/write/format operation. */
export interface NfcTag {
  /** Hex-encoded tag UID, e.g. "04A1B2C3". */
  id: string;
  techTypes: NfcTech[];
  /** The tag's NDEF message, or null if the tag has none / isn't NDEF. */
  ndefMessage: NdefMessage | null;
  /** Max NDEF storage size in bytes, if known. */
  maxSize?: number;
  isWritable?: boolean;
  canMakeReadOnly?: boolean;
}

/** Options accepted by the single-shot and continuous-scan operations. */
export interface NfcOptions {
  /** iOS: message shown in the system NFC scanning sheet. */
  alertMessage?: string;
  /** iOS: message shown briefly after a successful scan. */
  successAlertMessage?: string;
  /** iOS: message shown if the operation fails inside the system sheet. */
  errorAlertMessage?: string;
  /** Android: tag technologies reader mode should filter for. Defaults to all supported. */
  techList?: NfcTech[];
  /** Android reader-mode flags. */
  readerMode?: {
    /** Skip the platform-level NDEF check for a small perf win. */
    skipNdefCheck?: boolean;
    /** Suppress the platform's tag-detected sound. */
    noPlatformSounds?: boolean;
    /** Disable the platform-level tag debounce, allowing rapid re-taps of the same tag. */
    noPlatformDebounce?: boolean;
  };
  /** Abort the operation if no tag is found within this many seconds. */
  timeoutSeconds?: number;
}

export interface WriteOptions extends NfcOptions {}
export interface FormatOptions extends NfcOptions {}

export interface TransceiveOptions extends NfcOptions {}

/** Emitted repeatedly while a continuous scan session (`startScan`) is active. */
export interface TagDiscoveredEvent {
  tag: NfcTag;
}

/** Emitted when a scan session or single-shot operation ends unexpectedly. */
export interface SessionClosedEvent {
  /** Machine-readable reason, e.g. "cancelled" | "timeout" | "error". */
  reason: string;
  message?: string;
}

/** Emitted when the Android NFC adapter is toggled in system settings. */
export interface AdapterStateChangedEvent {
  enabled: boolean;
}

// ---------------------------------------------------------------------------
// Host Card Emulation (Android only — see README for the iOS limitation).
// ---------------------------------------------------------------------------

/** A single ISO 7816 Application Identifier, hex-encoded, 5-16 bytes. */
export type Aid = string;

export type HceCategory = 'payment' | 'other';

export interface HceAidGroup {
  category: HceCategory;
  /** Human-readable label shown by the platform's "default app" UI. */
  description: string;
  aids: Aid[];
}

/** Emitted for every APDU command the emulated card receives. */
export interface HceCommandEvent {
  /** Hex-encoded C-APDU, e.g. "00A4040007A000000...". */
  commandApdu: string;
  /** The registered AID this command was routed to, if determinable. */
  aid?: string;
}

export interface HceDeactivatedEvent {
  /** "LINK_LOSS" (tag moved out of range) or "DESELECTED" (another AID selected). */
  reason: 'LINK_LOSS' | 'DESELECTED' | 'UNKNOWN';
}

export const NfcXEventNames = {
  TagDiscovered: 'onTagDiscovered',
  SessionClosed: 'onSessionClosed',
  AdapterStateChanged: 'onAdapterStateChanged',
  HceCommand: 'onHceCommand',
  HceDeactivated: 'onHceDeactivated',
} as const;

export interface NfcXModuleEvents {
  onTagDiscovered(event: TagDiscoveredEvent): void;
  onSessionClosed(event: SessionClosedEvent): void;
  onAdapterStateChanged(event: AdapterStateChangedEvent): void;
  onHceCommand(event: HceCommandEvent): void;
  onHceDeactivated(event: HceDeactivatedEvent): void;
  // Index signature required to satisfy expo-modules-core's `EventsMap` constraint.
  [eventName: string]: (...args: any[]) => void;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export type NfcErrorCode =
  | 'ERR_NFC_UNSUPPORTED'
  | 'ERR_NFC_DISABLED'
  | 'ERR_SESSION_ALREADY_ACTIVE'
  | 'ERR_NO_SESSION'
  | 'ERR_TAG_NOT_NDEF'
  | 'ERR_TAG_READ_ONLY'
  | 'ERR_TAG_MESSAGE_TOO_LARGE'
  | 'ERR_TAG_LOST'
  | 'ERR_TAG_RESPONSE_ERROR'
  | 'ERR_CANCELLED'
  | 'ERR_TIMEOUT'
  | 'ERR_HCE_UNSUPPORTED_PLATFORM'
  | 'ERR_HCE_NOT_DEFAULT_SERVICE'
  | 'ERR_UNKNOWN';
