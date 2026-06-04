import { Ndef } from '../Ndef';
import { NdefTnf } from '../NfcX.types';

describe('text records', () => {
  it('builds and decodes a UTF-8 text record', () => {
    const record = Ndef.textRecord('Hello, NFC!', 'en');
    expect(Ndef.isText(record)).toBe(true);
    expect(Ndef.text(record)).toEqual({ text: 'Hello, NFC!', languageCode: 'en' });
  });

  it('preserves non-ASCII text', () => {
    const record = Ndef.textRecord('日本語テキスト', 'ja');
    expect(Ndef.text(record)).toEqual({ text: '日本語テキスト', languageCode: 'ja' });
  });

  it('rejects an oversized language code', () => {
    expect(() => Ndef.textRecord('x', 'a'.repeat(64))).toThrow(RangeError);
  });
});

describe('uri records', () => {
  it.each([
    'https://example.com/path',
    'http://www.example.com',
    'mailto:test@example.com',
    'tel:+15551234567',
    'ftp://ftp.example.com/file',
    'urn:isbn:0451450523',
  ])('round-trips %s through the abbreviation table', (uri) => {
    const record = Ndef.uriRecord(uri);
    expect(Ndef.isUri(record)).toBe(true);
    expect(Ndef.uri(record)).toBe(uri);
  });
});

describe('other builders', () => {
  it('builds a MIME media record', () => {
    const payload = new Uint8Array([1, 2, 3]);
    const record = Ndef.mimeMediaRecord('application/octet-stream', payload);
    expect(record.tnf).toBe(NdefTnf.MIME_MEDIA);
    expect(Ndef.isMime(record, 'application/octet-stream')).toBe(true);
    expect(Ndef.payload(record)).toEqual(payload);
  });

  it('builds an Android Application Record', () => {
    const record = Ndef.androidApplicationRecord('com.example.app');
    expect(record.tnf).toBe(NdefTnf.EXTERNAL_TYPE);
  });
});

describe('binary message encode/decode', () => {
  it('round-trips a single short record', () => {
    const records = [Ndef.textRecord('single')];
    const decoded = Ndef.decodeMessage(Ndef.encodeMessage(records));
    expect(decoded).toEqual(records);
  });

  it('round-trips multiple records including one with an id', () => {
    const records = [
      Ndef.uriRecord('https://example.com'),
      Ndef.textRecord('second record', 'en', new Uint8Array([0x01])),
      Ndef.mimeMediaRecord('text/plain', new Uint8Array([104, 105])),
    ];
    const decoded = Ndef.decodeMessage(Ndef.encodeMessage(records));
    expect(decoded).toEqual(records);
    expect(Ndef.uri(decoded[0])).toBe('https://example.com');
    expect(Ndef.text(decoded[1])?.text).toBe('second record');
  });

  it('round-trips a long record (>= 256 byte payload)', () => {
    const payload = new Uint8Array(300).fill(0x42);
    const records = [Ndef.mimeMediaRecord('application/octet-stream', payload)];
    const decoded = Ndef.decodeMessage(Ndef.encodeMessage(records));
    expect(Ndef.payload(decoded[0])).toEqual(payload);
  });

  it('returns an empty array for an empty message', () => {
    expect(Ndef.encodeMessage([]).length).toBe(0);
    expect(Ndef.decodeMessage(new Uint8Array(0))).toEqual([]);
  });
});
