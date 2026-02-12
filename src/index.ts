import { NfcManager } from './NfcManager';

export { NfcManager } from './NfcManager';
export { HceManager } from './HceManager';
export { Ndef } from './Ndef';
export * from './NfcX.types';
export { bytesToHex, hexToBytes, bytesToBase64, base64ToBytes } from './binary';

/** Shared singleton — the common case needs nothing more than `import Nfc from 'react-native-nfc-x'`. */
const Nfc = new NfcManager();
export default Nfc;
