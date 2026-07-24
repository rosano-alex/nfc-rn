import { NdefRecord, NdefTnf, NdefMessage } from './NfcX.types';
import {
  asciiDecode,
  asciiEncode,
  base64ToBytes,
  bytesToBase64,
  concatBytes,
  utf8Decode,
  utf8Encode,
} from './binary';

// Pure-TS NDEF helpers — record builders/parsers and full message encode/decode.
// None of this touches hardware, just the byte format from the NFC Forum
// NDEF/RTD specs, so it works the same on iOS, Android, and web.

// NFC Forum "URI Record Type Definition" abbreviation table (RTD_URI).
const URI_PREFIXES = [
  '',
  'http://www.',
  'https://www.',
  'http://',
  'https://',
  'tel:',
  'mailto:',
  'ftp://anonymous:anonymous@',
  'ftp://ftp.',
  'ftps://',
  'sftp://',
  'smb://',
  'nfs://',
  'ftp://',
  'dav://',
  'news:',
  'telnet://',
  'imap:',
  'rtsp://',
  'urn:',
  'pop:',
  'sip:',
  'sips:',
  'tftp:',
  'btspp://',
  'btl2cap://',
  'btgoep://',
  'tcpobex://',
  'irdaobex://',
  'file://',
  'urn:epc:id:',
  'urn:epc:tag:',
  'urn:epc:pat:',
  'urn:epc:raw:',
  'urn:epc:',
  'urn:nfc:',
];

const RTD_TEXT = asciiEncode('T');
const RTD_URI = asciiEncode('U');
const RTD_ANDROID_APP_PACKAGE = 'android.com:pkg';

function bytesToType(bytes: Uint8Array): string {
  return bytesToBase64(bytes);
}
function typeToBytes(type: string): Uint8Array {
  return base64ToBytes(type);
}

function makeRecord(
  tnf: NdefTnf,
  type: Uint8Array,
  payload: Uint8Array,
  id?: Uint8Array
): NdefRecord {
  return {
    tnf,
    type: bytesToBase64(type),
    id: id ? bytesToBase64(id) : '',
    payload: bytesToBase64(payload),
  };
}

// ---------------------------------------------------------------------------
// Record builders
// ---------------------------------------------------------------------------

// RTD_TEXT
function textRecord(text: string, languageCode = 'en', id?: Uint8Array): NdefRecord {
  const languageBytes = asciiEncode(languageCode);
  if (languageBytes.length > 63) {
    throw new RangeError('languageCode must be at most 63 bytes');
  }
  const textBytes = utf8Encode(text);
  const statusByte = languageBytes.length & 0x3f; // bit 7 = 0 => UTF-8
  const payload = concatBytes(new Uint8Array([statusByte]), languageBytes, textBytes);
  return makeRecord(NdefTnf.WELL_KNOWN, RTD_TEXT, payload, id);
}

// RTD_URI, using the standard prefix abbreviation table
function uriRecord(uri: string, id?: Uint8Array): NdefRecord {
  let prefixIndex = 0;
  let rest = uri;
  for (let i = URI_PREFIXES.length - 1; i >= 1; i--) {
    if (uri.startsWith(URI_PREFIXES[i])) {
      prefixIndex = i;
      rest = uri.substring(URI_PREFIXES[i].length);
      break;
    }
  }
  const payload = concatBytes(new Uint8Array([prefixIndex]), utf8Encode(rest));
  return makeRecord(NdefTnf.WELL_KNOWN, RTD_URI, payload, id);
}

function mimeMediaRecord(mimeType: string, payload: Uint8Array, id?: Uint8Array): NdefRecord {
  return makeRecord(NdefTnf.MIME_MEDIA, asciiEncode(mimeType), payload, id);
}

// The URI itself is the record type here, not a well-known RTD; payload is opaque.
function absoluteUriRecord(
  uri: string,
  payload: Uint8Array = new Uint8Array(0),
  id?: Uint8Array
): NdefRecord {
  return makeRecord(NdefTnf.ABSOLUTE_URI, asciiEncode(uri), payload, id);
}

function externalRecord(
  domain: string,
  type: string,
  payload: Uint8Array = new Uint8Array(0),
  id?: Uint8Array
): NdefRecord {
  return makeRecord(NdefTnf.EXTERNAL_TYPE, asciiEncode(`${domain}:${type}`), payload, id);
}

/** Android Application Record — launches `packageName` when the tag is scanned. */
function androidApplicationRecord(packageName: string): NdefRecord {
  return makeRecord(
    NdefTnf.EXTERNAL_TYPE,
    asciiEncode(RTD_ANDROID_APP_PACKAGE),
    utf8Encode(packageName)
  );
}

/** Useful for erasing a tag's contents while leaving it NDEF-formatted. */
function emptyRecord(): NdefRecord {
  return makeRecord(NdefTnf.EMPTY, new Uint8Array(0), new Uint8Array(0));
}

// ---------------------------------------------------------------------------
// Record parsers
// ---------------------------------------------------------------------------

function isType(record: NdefRecord, tnf: NdefTnf, type: Uint8Array): boolean {
  if (record.tnf !== tnf) return false;
  const recordType = typeToBytes(record.type);
  if (recordType.length !== type.length) return false;
  for (let i = 0; i < type.length; i++) {
    if (recordType[i] !== type[i]) return false;
  }
  return true;
}

function isText(record: NdefRecord): boolean {
  return isType(record, NdefTnf.WELL_KNOWN, RTD_TEXT);
}

/** Decodes a Text record's payload back into `{ text, languageCode }`. Returns null if not a text record. */
function text(record: NdefRecord): { text: string; languageCode: string } | null {
  if (!isText(record)) return null;
  const payload = base64ToBytes(record.payload);
  if (payload.length === 0) return { text: '', languageCode: 'en' };
  const statusByte = payload[0];
  const isUtf16 = (statusByte & 0x80) !== 0;
  const languageLength = statusByte & 0x3f;
  const languageCode = asciiDecode(payload.slice(1, 1 + languageLength));
  const textBytes = payload.slice(1 + languageLength);
  return {
    text: isUtf16 ? utf16Decode(textBytes) : utf8Decode(textBytes),
    languageCode,
  };
}

function isUri(record: NdefRecord): boolean {
  return isType(record, NdefTnf.WELL_KNOWN, RTD_URI);
}

/** Decodes a URI record's payload back into the full URI string. Returns null if not a URI record. */
function uri(record: NdefRecord): string | null {
  if (!isUri(record)) return null;
  const payload = base64ToBytes(record.payload);
  if (payload.length === 0) return '';
  const prefixIndex = payload[0];
  const prefix = URI_PREFIXES[prefixIndex] ?? '';
  return prefix + utf8Decode(payload.slice(1));
}

function isMime(record: NdefRecord, mimeType?: string): boolean {
  if (record.tnf !== NdefTnf.MIME_MEDIA) return false;
  if (!mimeType) return true;
  return asciiDecode(typeToBytes(record.type)) === mimeType;
}

/** Returns the raw payload bytes of a record, regardless of its type. */
function payload(record: NdefRecord): Uint8Array {
  return base64ToBytes(record.payload);
}

function utf16Decode(bytes: Uint8Array): string {
  // Assume big-endian, which is what RTD_TEXT mandates when no BOM is present.
  let result = '';
  for (let i = 0; i + 1 < bytes.length; i += 2) {
    result += String.fromCharCode((bytes[i] << 8) | bytes[i + 1]);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Full binary message encode/decode (NFC Forum NDEF spec §2.3)
// ---------------------------------------------------------------------------

const FLAG_MB = 0x80; // message begin
const FLAG_ME = 0x40; // message end
const FLAG_CF = 0x20; // chunk flag
const FLAG_SR = 0x10; // short record
const FLAG_IL = 0x08; // id length present
const FLAG_TNF = 0x07;

function encodeMessage(records: NdefRecord[]): Uint8Array {
  if (records.length === 0) return new Uint8Array(0);
  const chunks: Uint8Array[] = [];
  records.forEach((record, index) => {
    const type = typeToBytes(record.type);
    const id = record.id ? base64ToBytes(record.id) : new Uint8Array(0);
    const recordPayload = base64ToBytes(record.payload);
    const isShort = recordPayload.length < 256;
    const hasId = id.length > 0;

    let flags = record.tnf & FLAG_TNF;
    if (index === 0) flags |= FLAG_MB;
    if (index === records.length - 1) flags |= FLAG_ME;
    if (isShort) flags |= FLAG_SR;
    if (hasId) flags |= FLAG_IL;

    const header: number[] = [flags, type.length];
    if (isShort) {
      header.push(recordPayload.length);
    } else {
      header.push(
        (recordPayload.length >>> 24) & 0xff,
        (recordPayload.length >>> 16) & 0xff,
        (recordPayload.length >>> 8) & 0xff,
        recordPayload.length & 0xff
      );
    }
    if (hasId) header.push(id.length);

    chunks.push(new Uint8Array(header), type, id, recordPayload);
  });
  return concatBytes(...chunks);
}

// Doesn't support chunked records (CF flag) — no writer we know of produces those.
function decodeMessage(bytes: Uint8Array): NdefRecord[] {
  const records: NdefRecord[] = [];
  let offset = 0;
  while (offset < bytes.length) {
    const flags = bytes[offset];
    if (flags & FLAG_CF) {
      throw new Error('Ndef.decodeMessage: chunked records are not supported');
    }
    const tnf = (flags & FLAG_TNF) as NdefTnf;
    const isShort = (flags & FLAG_SR) !== 0;
    const hasId = (flags & FLAG_IL) !== 0;
    offset += 1;

    const typeLength = bytes[offset];
    offset += 1;

    let payloadLength: number;
    if (isShort) {
      payloadLength = bytes[offset];
      offset += 1;
    } else {
      payloadLength =
        (bytes[offset] << 24) |
        (bytes[offset + 1] << 16) |
        (bytes[offset + 2] << 8) |
        bytes[offset + 3];
      offset += 4;
    }

    let idLength = 0;
    if (hasId) {
      idLength = bytes[offset];
      offset += 1;
    }

    const type = bytes.slice(offset, offset + typeLength);
    offset += typeLength;
    const id = bytes.slice(offset, offset + idLength);
    offset += idLength;
    const recordPayload = bytes.slice(offset, offset + payloadLength);
    offset += payloadLength;

    records.push({
      tnf,
      type: bytesToType(type),
      id: idLength > 0 ? bytesToBase64(id) : '',
      payload: bytesToBase64(recordPayload),
    });

    if (flags & FLAG_ME) break;
  }
  return records;
}

function message(records: NdefRecord[]): NdefMessage {
  return { records };
}

export const Ndef = {
  // builders
  textRecord,
  uriRecord,
  mimeMediaRecord,
  absoluteUriRecord,
  externalRecord,
  androidApplicationRecord,
  emptyRecord,
  message,
  // parsers / predicates
  isText,
  text,
  isUri,
  uri,
  isMime,
  payload,
  // binary codec
  encodeMessage,
  decodeMessage,
};
