# react-native-nfc-x

NFC reader/writer for Expo/React Native, wrapping **Core NFC** on iOS and the **Android NFC APIs** — tag reading, writing, formatting, locking, raw APDU transceive, and **Host Card Emulation (HCE)**.

- TypeScript public API, Swift on iOS, Kotlin on Android (no Objective-C, no Java).
- Ships an [Expo config plugin](#setup) so `expo prebuild` wires up the required entitlements, Info.plist keys, and Android manifest/HCE service automatically.
- **HCE is Android-only.** Core NFC has no public API for a third-party app to emulate a card — only Apple Pay/PassKit can, via a private entitlement Apple doesn't grant to general developers. Every `Nfc.hce.*` call rejects with `ERR_HCE_UNSUPPORTED_PLATFORM` on iOS; see [Host Card Emulation](#host-card-emulation-android-only).

A full test app lives in [`example/`](./example) — see [Running the example app](#running-the-example-app).

## Install

```bash
npx expo install react-native-nfc-x
```

This is a native module — after installing, run `npx expo prebuild` (or `expo run:ios` / `expo run:android`, which prebuild automatically) to apply the config plugin.

## Setup

Add the plugin to `app.json` / `app.config.js`. All fields are optional:

```json
{
  "expo": {
    "plugins": [
      [
        "react-native-nfc-x",
        {
          "ios": {
            "nfcReaderUsageDescription": "This app uses NFC to read and write tags.",
            "select7816Identifiers": ["F0010203040506"]
          },
          "android": {
            "hce": {
              "aidGroups": [
                { "category": "other", "description": "My applet", "aids": ["F0010203040506"] }
              ]
            }
          }
        }
      ]
    ]
  }
}
```

- **`ios.nfcReaderUsageDescription`** — shown in the system permission prompt (`NFCReaderUsageDescription`). Also adds the `com.apple.developer.nfc.readersession.formats` entitlement Core NFC requires.
- **`ios.select7816Identifiers`** — optional; only needed if the app should be offered as a handler for specific ISO 7816 AIDs (background/passive tag matching). Most NDEF-only apps can omit this.
- **`android.hce.aidGroups`** — statically declares the AIDs your Android HCE service handles, so the app shows up as a card-emulation option immediately. You can also (or instead) register AIDs at runtime with `Nfc.hce.setAidGroups()`.

## Quick start

```ts
import Nfc, { Ndef } from 'react-native-nfc-x';

// Check support once, up front.
const supported = await Nfc.isSupported();

// Read: opens a scanning session, waits for a tag, reads its NDEF message.
const tag = await Nfc.readTag({ alertMessage: 'Hold your device near a tag' });
console.log(tag.id, tag.ndefMessage);

// Write: same session lifecycle, writes instead of reads.
await Nfc.writeTag([Ndef.textRecord('Hello, NFC!')]);
await Nfc.writeTag([Ndef.uriRecord('https://example.com')]);

// Format a blank tag (writes an empty NDEF message, or an initial one).
await Nfc.formatTag([Ndef.textRecord('First message')]);

// Permanently lock a tag read-only. Cannot be undone.
await Nfc.makeReadOnly();
```

Every operation above is **single-shot**: it opens a native scanning session, waits for exactly one tag, performs the operation, and tears the session down — mirroring how Core NFC itself is meant to be used, and avoiding session-management footguns on Android's `enableReaderMode`.

### Continuous scanning

For a "badge scanner" style flow that keeps reading tags until you stop it:

```ts
const subscription = Nfc.addTagDiscoveredListener(({ tag }) => {
  console.log('Saw tag', tag.id, tag.ndefMessage);
});

await Nfc.startScan({ alertMessage: 'Scanning…' });
// ... later
await Nfc.stopScan();
subscription.remove();
```

Continuous scan is read-only — use the single-shot methods above for writes.

### Raw APDU (ISO-DEP / ISO 7816)

For use cases NDEF doesn't cover (smart cards, custom applets):

```ts
import { hexToBytes, bytesToHex } from 'react-native-nfc-x';

const response = await Nfc.transceive(hexToBytes('00A4040000'));
console.log(bytesToHex(response));
```

### NDEF helpers

`Ndef` is pure TypeScript (no native calls) — it builds/parses records and encodes/decodes full NDEF binary messages per the NFC Forum spec:

```ts
Ndef.textRecord(text, languageCode?, id?)
Ndef.uriRecord(uri, id?)
Ndef.mimeMediaRecord(mimeType, payloadBytes, id?)
Ndef.absoluteUriRecord(uri, payloadBytes?, id?)
Ndef.externalRecord(domain, type, payloadBytes?, id?)
Ndef.androidApplicationRecord(packageName)
Ndef.emptyRecord()

Ndef.isText(record) / Ndef.text(record)   // -> { text, languageCode } | null
Ndef.isUri(record)  / Ndef.uri(record)    // -> string | null
Ndef.isMime(record, mimeType?)
Ndef.payload(record)                      // -> Uint8Array, any record type

Ndef.encodeMessage(records)  // -> Uint8Array (raw NDEF binary)
Ndef.decodeMessage(bytes)    // -> NdefRecord[]
```

`NdefRecord.type` / `.id` / `.payload` travel across the native bridge as base64 strings (arbitrary binary, JSON-safe); the helpers above handle that encoding for you.

## Host Card Emulation (Android only)

```ts
await Nfc.hce.setAidGroups([
  { category: 'other', description: 'My applet', aids: ['F0010203040506'] },
]);

const commandSub = Nfc.hce.addCommandListener(({ commandApdu, aid }) => {
  console.log('Reader sent', bytesToHex(commandApdu), 'for AID', aid);
  Nfc.hce.respond(hexToBytes('9000')); // success status word
});

const deactivatedSub = Nfc.hce.addDeactivatedListener(({ reason }) => {
  console.log('Reader moved away or deselected us:', reason); // 'LINK_LOSS' | 'DESELECTED'
});
```

Android instantiates the HCE service itself whenever a reader selects one of your AIDs — there's no JS lifecycle involved, and `processCommandApdu` normally must reply synchronously, but this library defers the reply so your JS handler (`addCommandListener` -> `respond()`) can take its time, e.g. to look something up or hit a server.

Check `await Nfc.hce.isSupported()` before building HCE UI — it's `false` on iOS and on Android devices without `FEATURE_NFC_HOST_CARD_EMULATION`.

## Error handling

Every rejected promise carries a `code` matching one of:

`ERR_NFC_UNSUPPORTED`, `ERR_NFC_DISABLED`, `ERR_SESSION_ALREADY_ACTIVE`, `ERR_NO_SESSION`, `ERR_TAG_NOT_NDEF`, `ERR_TAG_READ_ONLY`, `ERR_TAG_MESSAGE_TOO_LARGE`, `ERR_TAG_LOST`, `ERR_TAG_RESPONSE_ERROR`, `ERR_CANCELLED`, `ERR_TIMEOUT`, `ERR_HCE_UNSUPPORTED_PLATFORM`, `ERR_HCE_NOT_DEFAULT_SERVICE`, `ERR_UNKNOWN`

```ts
try {
  await Nfc.readTag();
} catch (error: any) {
  if (error.code === 'ERR_CANCELLED') return; // user dismissed the scan sheet
  throw error;
}
```

## API reference

| Method | Description |
|---|---|
| `Nfc.isSupported()` | Device has NFC tag-reading hardware. |
| `Nfc.isEnabled()` | NFC radio is on (Android); mirrors `isSupported()` on iOS. |
| `Nfc.readTag(options?)` | Single-shot read. |
| `Nfc.writeTag(records, options?)` | Single-shot write to an already NDEF-formatted tag. |
| `Nfc.formatTag(records?, options?)` | Single-shot NDEF format (+ optional initial message). |
| `Nfc.makeReadOnly(options?)` | Single-shot, **permanent** read-only lock. |
| `Nfc.transceive(bytes, options?)` | Single-shot raw APDU exchange (ISO-DEP tags). |
| `Nfc.cancelSession()` | Cancels whatever single-shot op or scan is in flight. |
| `Nfc.startScan(options?)` / `Nfc.stopScan()` | Continuous read-only scanning. |
| `Nfc.addTagDiscoveredListener(fn)` | Fires per tag during a continuous scan. |
| `Nfc.addSessionClosedListener(fn)` | Fires when a session ends abnormally (cancelled/timeout/error). |
| `Nfc.addAdapterStateChangedListener(fn)` | Android only: fires when NFC is toggled in settings. |
| `Nfc.hce.isSupported()` | Device supports HCE (Android only). |
| `Nfc.hce.setAidGroups(groups)` | Dynamically registers AIDs for the HCE service. |
| `Nfc.hce.isDefaultServiceForCategory(category)` | Whether this app is the default handler for `'payment'`/`'other'`. |
| `Nfc.hce.respond(bytes)` | Sends the response APDU for the most recent command. |
| `Nfc.hce.addCommandListener(fn)` | Fires per incoming command APDU. |
| `Nfc.hce.addDeactivatedListener(fn)` | Fires when the reader deselects/moves away. |

`options` (all optional) on the tag operations:

| Field | Platform | Description |
|---|---|---|
| `alertMessage` | iOS | Message in the system scanning sheet. |
| `successAlertMessage` / `errorAlertMessage` | iOS | Message shown briefly after success/failure. |
| `techList` | Android | Tech filter for reader mode (defaults to all supported). |
| `readerMode` | Android | `{ skipNdefCheck?, noPlatformSounds?, noPlatformDebounce? }`. |
| `timeoutSeconds` | both | Abort if no tag is found in time. |

## Running the example app

```bash
cd example
yarn
npx expo run:ios      # or: npx expo run:android
```

The example exercises every API: read/write/format/lock, continuous scan, raw transceive, and an HCE panel (Android) with a live incoming-command log and auto-respond toggle.

## Platform notes

- **iOS**: requires a physical device — Core NFC does not work in the Simulator. `NFCTagReaderSession`/`NFCNDEFReaderSession` require iOS 13+.
- **Android**: `minSdkVersion` 24+ (matches this module's `build.gradle`). HCE requires `FEATURE_NFC_HOST_CARD_EMULATION`, absent on some tablets/devices.
- **Formatting on iOS**: Core NFC has no separate "format" call — writing an NDEF message to a blank-but-NDEF-capable tag formats it as a side effect of `writeNDEF`. `formatTag()` implements this; it fails with `ERR_TAG_NOT_NDEF` if the tag can't support NDEF at all.

## License

MIT
