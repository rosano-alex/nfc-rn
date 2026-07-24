package expo.modules.nfcx

import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record

// These mirror the shapes in src/NfcX.types.ts.

/** `type`/`id`/`payload` are base64 so they survive the bridge intact. */
class NdefRecordOptions : Record {
  @Field var tnf: Int = 0
  @Field var type: String = ""
  @Field var id: String = ""
  @Field var payload: String = ""
}

/** Fields Android doesn't use, like iOS's alert messages, are just absent here. */
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

class HceAidGroupOptions : Record {
  @Field var category: String = "other"
  @Field var description: String = ""
  @Field var aids: List<String> = emptyList()
}

class NdefMessageResult : Record {
  @Field var records: List<NdefRecordOptions> = emptyList()
}

class NfcTagResult : Record {
  @Field var id: String = ""
  @Field var techTypes: List<String> = emptyList()
  @Field var ndefMessage: NdefMessageResult? = null
  @Field var maxSize: Int? = null
  @Field var isWritable: Boolean? = null
  @Field var canMakeReadOnly: Boolean? = null
}
