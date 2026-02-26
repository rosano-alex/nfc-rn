import ExpoModulesCore

// MARK: - NDEF

/// Mirrors `NdefRecord` from src/NfcX.types.ts. `type`/`id`/`payload` travel
/// across the bridge as base64 strings so arbitrary binary payloads survive
/// the JS<->native boundary intact.
struct NdefRecordRecord: Record {
  @Field var tnf: Int = 0
  @Field var type: String = ""
  @Field var id: String = ""
  @Field var payload: String = ""

  static func empty() -> NdefRecordRecord {
    var record = NdefRecordRecord()
    record.tnf = 0
    record.type = ""
    record.id = ""
    record.payload = ""
    return record
  }
}

/// Mirrors `NdefMessage` from src/NfcX.types.ts.
struct NdefMessageRecord: Record {
  @Field var records: [NdefRecordRecord] = []
}

// MARK: - Tag

/// Mirrors `NfcTag` from src/NfcX.types.ts.
struct NfcTagRecord: Record {
  @Field var id: String = ""
  @Field var techTypes: [String] = []
  @Field var ndefMessage: NdefMessageRecord?
  @Field var maxSize: Int?
  @Field var isWritable: Bool?
  @Field var canMakeReadOnly: Bool?
}

// MARK: - Options

/// Mirrors the fields of `NfcOptions` (src/NfcX.types.ts) that are
/// meaningful on iOS. `techList`/`readerMode` are Android-only and simply
/// ignored here if present in the JS object — Expo's Record decoding only
/// reads keys it declares a `@Field` for.
struct NfcOptionsRecord: Record {
  @Field var alertMessage: String?
  @Field var successAlertMessage: String?
  @Field var errorAlertMessage: String?
  @Field var timeoutSeconds: Double?
}

// MARK: - HCE (Android-only; declared here only so the module's function
// signatures type-check — every HCE AsyncFunction on iOS throws before
// touching these).

struct HceAidGroupRecord: Record {
  @Field var category: String = "other"
  @Field var description: String = ""
  @Field var aids: [String] = []
}
