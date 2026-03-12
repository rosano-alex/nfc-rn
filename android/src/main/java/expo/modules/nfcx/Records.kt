package expo.modules.nfcx

import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record

/** Mirrors `NdefRecord` from src/NfcX.types.ts — `type`/`id`/`payload` are base64 to survive the bridge intact. */
class NdefRecordOptions : Record {
  @Field var tnf: Int = 0
  @Field var type: String = ""
  @Field var id: String = ""
  @Field var payload: String = ""
}

/** Mirrors `NfcOptions` (src/NfcX.types.ts). Fields Android doesn't use (e.g. iOS's alert messages) are simply absent from here. */
class NfcOptionsRecord : Record {
  @Field var techList: List<String>? = null
  @Field var readerMode: ReaderModeOptions? = null
  @Field var timeoutSeconds: Double? = null
}

class ReaderModeOptions : Record {
  @Field var skipNdefCheck: Boolean = false
  @Field var noPlatformSounds: Boolean = false
  @Field var noPlatformDebounce: Boolean = false
}

/** Mirrors `HceAidGroup` (src/NfcX.types.ts). */
class HceAidGroupOptions : Record {
  @Field var category: String = "other"
  @Field var description: String = ""
  @Field var aids: List<String> = emptyList()
}

/** Mirrors `NdefMessage` (src/NfcX.types.ts). */
class NdefMessageResult : Record {
  @Field var records: List<NdefRecordOptions> = emptyList()
}

/** Mirrors `NfcTag` (src/NfcX.types.ts). */
class NfcTagResult : Record {
  @Field var id: String = ""
  @Field var techTypes: List<String> = emptyList()
  @Field var ndefMessage: NdefMessageResult? = null
  @Field var maxSize: Int? = null
  @Field var isWritable: Boolean? = null
  @Field var canMakeReadOnly: Boolean? = null
}
