# react-native-nfc-x

NFC reader/writer for Expo/React Native, wrapping **Core NFC** on iOS and the **Android NFC APIs** — tag reading, writing, formatting, locking, raw APDU transceive, and **Host Card Emulation (HCE)**.

- TypeScript public API, Swift on iOS, Kotlin on Android (no Objective-C, no Java).
- Ships an Expo config plugin so `expo prebuild` wires up the required entitlements, Info.plist keys, and Android manifest/HCE service automatically.
- **HCE is Android-only.** Core NFC has no public API for a third-party app to emulate a card — only Apple Pay/PassKit can, via a private entitlement Apple doesn't grant to general developers.

## Install

```bash
npx expo install react-native-nfc-x
```

This is a native module — after installing, run `npx expo prebuild` to apply the config plugin.

## Quick start

```ts
import Nfc, { Ndef } from 'react-native-nfc-x';

const supported = await Nfc.isSupported();

const tag = await Nfc.readTag({ alertMessage: 'Hold your device near a tag' });
console.log(tag.id, tag.ndefMessage);

await Nfc.writeTag([Ndef.textRecord('Hello, NFC!')]);
```

More to come: continuous scanning, raw APDU transceive, HCE, and the full API reference.

## License

MIT
