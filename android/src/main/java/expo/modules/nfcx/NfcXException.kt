package expo.modules.nfcx

import expo.modules.kotlin.exception.CodedException

/**
 * A [CodedException] whose [code] matches one of the `NfcErrorCode` values
 * declared in src/NfcX.types.ts, so JS can branch on `error.code` the same
 * way on both platforms.
 */
class NfcXException(private val errorCode: String, message: String) : CodedException(message) {
  override val code: String
    get() = errorCode

  companion object {
    fun unsupported() = NfcXException(
      "ERR_NFC_UNSUPPORTED",
      "This device does not have NFC hardware."
    )

    fun disabled() = NfcXException(
      "ERR_NFC_DISABLED",
      "NFC is turned off. Ask the user to enable it in system settings."
    )

    fun sessionAlreadyActive() = NfcXException(
      "ERR_SESSION_ALREADY_ACTIVE",
      "An NFC session is already active. Call cancelSession() first."
    )

    fun noActivity() = NfcXException(
      "ERR_UNKNOWN",
      "No foreground activity is available to attach the NFC reader to."
    )

    fun tagNotNdef() = NfcXException(
      "ERR_TAG_NOT_NDEF",
      "This tag does not support NDEF and cannot be read, written, or formatted."
    )

    fun tagReadOnly() = NfcXException("ERR_TAG_READ_ONLY", "This tag is locked read-only.")

    fun messageTooLarge() = NfcXException(
      "ERR_TAG_MESSAGE_TOO_LARGE",
      "The NDEF message is larger than this tag's capacity."
    )

    fun tagLost() = NfcXException(
      "ERR_TAG_LOST",
      "The tag moved out of range before the operation finished."
    )

    fun cancelled() = NfcXException("ERR_CANCELLED", "The NFC session was cancelled.")

    fun timeout() = NfcXException("ERR_TIMEOUT", "Timed out waiting for a tag.")

    fun tagResponseError(message: String) = NfcXException("ERR_TAG_RESPONSE_ERROR", message)

    fun invalidRecord() = NfcXException(
      "ERR_UNKNOWN",
      "Received a malformed NDEF record: type/id/payload must be valid base64."
    )

    fun transceiveUnsupported() = NfcXException(
      "ERR_UNKNOWN",
      "This tag does not support raw command transceive (IsoDep only)."
    )

    fun hceUnsupported() = NfcXException(
      "ERR_HCE_UNSUPPORTED_PLATFORM",
      "This device does not support Host Card Emulation (FEATURE_NFC_HOST_CARD_EMULATION)."
    )

    fun hceNoActiveSession() = NfcXException(
      "ERR_NO_SESSION",
      "There is no in-flight HCE command to respond to."
    )
  }
}
