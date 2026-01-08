/**
 * Self-contained byte<->string codecs.
 *
 * Deliberately dependency-free (no `Buffer`, `btoa`/`atob`, or
 * `TextEncoder`/`TextDecoder`) so NDEF payloads can be built and parsed the
 * same way regardless of JS engine (Hermes/JSC) or RN version.
 */

const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function bytesToBase64(bytes: Uint8Array): string {
  let result = '';
  let i = 0;
  for (; i + 3 <= bytes.length; i += 3) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    result +=
      BASE64_CHARS[(n >> 18) & 0x3f] +
      BASE64_CHARS[(n >> 12) & 0x3f] +
      BASE64_CHARS[(n >> 6) & 0x3f] +
      BASE64_CHARS[n & 0x3f];
  }
  const remaining = bytes.length - i;
  if (remaining === 1) {
    const n = bytes[i] << 16;
    result += BASE64_CHARS[(n >> 18) & 0x3f] + BASE64_CHARS[(n >> 12) & 0x3f] + '==';
  } else if (remaining === 2) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8);
    result +=
      BASE64_CHARS[(n >> 18) & 0x3f] +
      BASE64_CHARS[(n >> 12) & 0x3f] +
      BASE64_CHARS[(n >> 6) & 0x3f] +
      '=';
  }
  return result;
}

const BASE64_LOOKUP: Record<string, number> = (() => {
  const map: Record<string, number> = {};
  for (let i = 0; i < BASE64_CHARS.length; i++) map[BASE64_CHARS[i]] = i;
  return map;
})();

export function base64ToBytes(base64: string): Uint8Array {
  const clean = base64.replace(/[^A-Za-z0-9+/]/g, '');
  const byteLength = Math.floor((clean.length * 6) / 8);
  const bytes = new Uint8Array(byteLength);
  let bitBuffer = 0;
  let bitCount = 0;
  let outIndex = 0;
  for (let i = 0; i < clean.length; i++) {
    const value = BASE64_LOOKUP[clean[i]];
    if (value === undefined) continue;
    bitBuffer = (bitBuffer << 6) | value;
    bitCount += 6;
    if (bitCount >= 8) {
      bitCount -= 8;
      bytes[outIndex++] = (bitBuffer >> bitCount) & 0xff;
    }
  }
  return bytes;
}

export function utf8Encode(text: string): Uint8Array {
  const bytes: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const codePoint = text.codePointAt(i)!;
    if (codePoint > 0xffff) i++; // consumed a surrogate pair

    if (codePoint < 0x80) {
      bytes.push(codePoint);
    } else if (codePoint < 0x800) {
      bytes.push(0xc0 | (codePoint >> 6), 0x80 | (codePoint & 0x3f));
    } else if (codePoint < 0x10000) {
      bytes.push(
        0xe0 | (codePoint >> 12),
        0x80 | ((codePoint >> 6) & 0x3f),
        0x80 | (codePoint & 0x3f)
      );
    } else {
      bytes.push(
        0xf0 | (codePoint >> 18),
        0x80 | ((codePoint >> 12) & 0x3f),
        0x80 | ((codePoint >> 6) & 0x3f),
        0x80 | (codePoint & 0x3f)
      );
    }
  }
  return new Uint8Array(bytes);
}

export function utf8Decode(bytes: Uint8Array): string {
  let result = '';
  let i = 0;
  while (i < bytes.length) {
    const byte1 = bytes[i++];
    if (byte1 < 0x80) {
      result += String.fromCharCode(byte1);
    } else if (byte1 >= 0xc0 && byte1 < 0xe0 && i < bytes.length) {
      const byte2 = bytes[i++];
      result += String.fromCharCode(((byte1 & 0x1f) << 6) | (byte2 & 0x3f));
    } else if (byte1 >= 0xe0 && byte1 < 0xf0 && i + 1 < bytes.length) {
      const byte2 = bytes[i++];
      const byte3 = bytes[i++];
      result += String.fromCharCode(
        ((byte1 & 0x0f) << 12) | ((byte2 & 0x3f) << 6) | (byte3 & 0x3f)
      );
    } else if (byte1 >= 0xf0 && i + 2 < bytes.length) {
      const byte2 = bytes[i++];
      const byte3 = bytes[i++];
      const byte4 = bytes[i++];
      let codePoint =
        ((byte1 & 0x07) << 18) | ((byte2 & 0x3f) << 12) | ((byte3 & 0x3f) << 6) | (byte4 & 0x3f);
      codePoint -= 0x10000;
      result += String.fromCharCode(0xd800 + (codePoint >> 10), 0xdc00 + (codePoint & 0x3ff));
    } else {
      // Invalid leading byte — skip it rather than throwing on malformed input.
    }
  }
  return result;
}

export function asciiEncode(text: string): Uint8Array {
  const bytes = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) bytes[i] = text.charCodeAt(i) & 0xff;
  return bytes;
}

export function asciiDecode(bytes: Uint8Array): string {
  let result = '';
  for (let i = 0; i < bytes.length; i++) result += String.fromCharCode(bytes[i]);
  return result;
}

export function bytesToHex(bytes: Uint8Array): string {
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/[^0-9a-fA-F]/g, '');
  const bytes = new Uint8Array(Math.floor(clean.length / 2));
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

export function concatBytes(...chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, c) => sum + c.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}
