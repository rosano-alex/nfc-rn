import ExpoModulesCore

/// A `CodedError` whose `code` matches one of the `NfcErrorCode` values
/// declared in src/NfcX.types.ts, so JS can branch on `error.code` the same
/// way on both platforms.
final class NfcXException: Exception {
  private let _code: String
  private let _reason: String

  init(code: String, reason: String) {
    self._code = code
    self._reason = reason
    super.init()
  }

  override var code: String { _code }
  override var reason: String { _reason }

  static func unsupported() -> NfcXException {
    NfcXException(
      code: "ERR_NFC_UNSUPPORTED",
      reason: "This device does not support NFC tag reading."
    )
  }

  static func sessionAlreadyActive() -> NfcXException {
    NfcXException(
      code: "ERR_SESSION_ALREADY_ACTIVE",
      reason: "An NFC session is already active. Call cancelSession() first."
    )
  }

  static func noSession() -> NfcXException {
    NfcXException(
      code: "ERR_NO_SESSION",
      reason: "There is no active NFC session."
    )
  }

  static func tagNotNdef() -> NfcXException {
    NfcXException(
      code: "ERR_TAG_NOT_NDEF",
      reason: "This tag does not support NDEF and cannot be read, written, or formatted."
    )
  }

  static func tagReadOnly() -> NfcXException {
    NfcXException(
      code: "ERR_TAG_READ_ONLY",
      reason: "This tag is locked read-only."
    )
  }

  static func messageTooLarge() -> NfcXException {
    NfcXException(
      code: "ERR_TAG_MESSAGE_TOO_LARGE",
      reason: "The NDEF message is larger than this tag's capacity."
    )
  }

  static func tagLost() -> NfcXException {
    NfcXException(
      code: "ERR_TAG_LOST",
      reason: "The tag moved out of range before the operation finished."
    )
  }

  static func cancelled() -> NfcXException {
    NfcXException(
      code: "ERR_CANCELLED",
      reason: "The NFC session was cancelled."
    )
  }

  static func timeout() -> NfcXException {
    NfcXException(
      code: "ERR_TIMEOUT",
      reason: "Timed out waiting for a tag."
    )
  }

  static func tagResponseError(_ message: String) -> NfcXException {
    NfcXException(code: "ERR_TAG_RESPONSE_ERROR", reason: message)
  }

  static func invalidRecord() -> NfcXException {
    NfcXException(
      code: "ERR_UNKNOWN",
      reason: "Received a malformed NDEF record: type/id/payload must be valid base64."
    )
  }

  static func invalidApdu() -> NfcXException {
    NfcXException(code: "ERR_UNKNOWN", reason: "Malformed command APDU.")
  }

  static func transceiveUnsupported() -> NfcXException {
    NfcXException(
      code: "ERR_UNKNOWN",
      reason: "This tag does not support raw APDU commands (ISO 7816 tags only)."
    )
  }

  static func hceUnsupportedPlatform() -> NfcXException {
    NfcXException(
      code: "ERR_HCE_UNSUPPORTED_PLATFORM",
      reason: """
        Host Card Emulation has no public API on iOS: Core NFC does not let \
        third-party apps emulate a card — only Apple Pay/PassKit can, via a \
        private entitlement Apple does not grant to general developers. HCE \
        is only available on Android in this library.
        """
    )
  }
}
