import {
  asciiDecode,
  asciiEncode,
  base64ToBytes,
  bytesToBase64,
  bytesToHex,
  hexToBytes,
  utf8Decode,
  utf8Encode,
} from '../binary';

describe('base64', () => {
  it('round-trips arbitrary byte lengths (padding edge cases)', () => {
    for (let length = 0; length < 8; length++) {
      const bytes = new Uint8Array(length).map((_, i) => (i * 37 + 11) % 256);
      expect(base64ToBytes(bytesToBase64(bytes))).toEqual(bytes);
    }
  });

  it('matches known vectors', () => {
    expect(bytesToBase64(asciiEncode('hello'))).toBe('aGVsbG8=');
    expect(asciiDecode(base64ToBytes('aGVsbG8='))).toBe('hello');
  });
});

describe('hex', () => {
  it('round-trips bytes', () => {
    const bytes = new Uint8Array([0x00, 0x01, 0x0a, 0xff, 0x7f]);
    expect(hexToBytes(bytesToHex(bytes))).toEqual(bytes);
    expect(bytesToHex(bytes)).toBe('00010aff7f');
  });
});

describe('utf8', () => {
  it('round-trips ASCII, multi-byte, and surrogate-pair (emoji) text', () => {
    for (const text of ['hello', 'héllo wörld', '日本語', '🎉🚀', '']) {
      expect(utf8Decode(utf8Encode(text))).toBe(text);
    }
  });
});
