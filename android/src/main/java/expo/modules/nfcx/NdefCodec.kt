package expo.modules.nfcx

import android.nfc.NdefMessage
import android.nfc.NdefRecord
import android.util.Base64

/** Converts between `android.nfc.NdefMessage`/`NdefRecord` and the base64 wire format defined by src/NfcX.types.ts. */
object NdefCodec {
  fun toAndroidMessage(records: List<NdefRecordOptions>): NdefMessage {
    val androidRecords = records.map { record ->
      val type = decodeBase64(record.type) ?: throw NfcXException.invalidRecord()
      val payload = decodeBase64(record.payload) ?: throw NfcXException.invalidRecord()
      val id = if (record.id.isEmpty()) ByteArray(0) else (decodeBase64(record.id) ?: ByteArray(0))
      NdefRecord(record.tnf.toShort(), type, id, payload)
    }
    return NdefMessage(androidRecords.toTypedArray())
  }

  fun toResult(message: NdefMessage): NdefMessageResult {
    val result = NdefMessageResult()
    result.records = message.records.map { record ->
      val options = NdefRecordOptions()
      options.tnf = record.tnf.toInt()
      options.type = Base64.encodeToString(record.type, Base64.NO_WRAP)
      options.id = if (record.id.isEmpty()) "" else Base64.encodeToString(record.id, Base64.NO_WRAP)
      options.payload = Base64.encodeToString(record.payload, Base64.NO_WRAP)
      options
    }
    return result
  }

  fun emptyRecord(): NdefRecordOptions {
    val record = NdefRecordOptions()
    record.tnf = NdefRecord.TNF_EMPTY.toInt()
    record.type = ""
    record.id = ""
    record.payload = ""
    return record
  }

  private fun decodeBase64(value: String): ByteArray? =
    try {
      Base64.decode(value, Base64.DEFAULT)
    } catch (e: IllegalArgumentException) {
      null
    }
}

fun ByteArray.toHex(): String = joinToString("") { "%02x".format(it) }

fun String.hexToBytes(): ByteArray {
  val clean = replace(Regex("[^0-9a-fA-F]"), "")
  val result = ByteArray(clean.length / 2)
  for (i in result.indices) {
    val index = i * 2
    result[i] = clean.substring(index, index + 2).toInt(16).toByte()
  }
  return result
}
