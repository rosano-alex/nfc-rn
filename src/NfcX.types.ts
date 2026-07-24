/**
 * Shared type definitions for react-native-nfc-x. These mirror the wire
 * format sent across the Expo Modules bridge, so native code on both
 * platforms produces/consumes exactly these shapes.
 */

/** Not every tech is available on every platform/tag. */
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

/** NDEF Type Name Format, per the NFC Forum NDEF spec. */
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
 * `type`, `id`, and `payload` are base64 rather than plain strings — the
 * payload is arbitrary binary and has to survive the native<->JS bridge
 * intact.
 */
export interface NdefRecord {
  tnf: NdefTnf;
  type: string;
  /** Empty string if the record has no id. */
  id: string;
  payload: string;
}

export interface NdefMessage {
  records: NdefRecord[];
}

export interface NfcTag {
  /** Hex-encoded UID, e.g. "04A1B2C3". */
  id: string;
  techTypes: NfcTech[];
  /** null if the tag has no NDEF message, or isn't NDEF at all. */
  ndefMessage: NdefMessage | null;
  maxSize?: number;
  isWritable?: boolean;
  canMakeReadOnly?: boolean;
}

export interface NfcOptions {
  /** iOS: message shown in the system NFC scanning sheet. */
  alertMessage?: string;
  /** iOS: message shown briefly after a successful scan. */
  successAlertMessage?: string;
  /** iOS: message shown if the operation fails inside the system sheet. */
  errorAlertMessage?: string;
  /** Android: defaults to all supported techs if omitted. */
  techList?: NfcTech[];
  readerMode?: {
    skipNdefCheck?: boolean;
    noPlatformSounds?: boolean;
    /** Lets the same tag be re-tapped immediately instead of waiting out the platform's debounce. */
    noPlatformDebounce?: boolean;
  };
  timeoutSeconds?: number;
}

export interface WriteOptions extends NfcOptions {}
export interface FormatOptions extends NfcOptions {}
export interface TransceiveOptions extends NfcOptions {}

export interface TagDiscoveredEvent {
  tag: NfcTag;
}

export interface SessionClosedEvent {
  reason: string;
  message?: string;
}

/** Android only — iOS has no equivalent system toggle to listen for. */
export interface AdapterStateChangedEvent {
  enabled: boolean;
}

// ---------------------------------------------------------------------------
// Host Card Emulation (Android only — see README for the iOS limitation).
// ---------------------------------------------------------------------------

/** Hex-encoded, 5-16 bytes. */
export type Aid = string;

export type HceCategory = 'payment' | 'other';

export interface HceAidGroup {
  category: HceCategory;
  /** Shown by the platform's "default app" UI. */
  description: string;
  aids: Aid[];
}

export interface HceCommandEvent {
  commandApdu: string;
  aid?: string;
}

export interface HceDeactivatedEvent {
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
  // expo-modules-core's EventsMap constraint needs an index signature here.
  [eventName: string]: (...args: any[]) => void;
}

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
