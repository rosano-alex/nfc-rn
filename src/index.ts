// Reexport the native module. On web, it will be resolved to NfcXModule.web.ts
// and on native platforms to NfcXModule.ts
export { default } from './NfcXModule';
export * from './NfcX.types';
