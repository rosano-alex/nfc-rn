package expo.modules.nfcx.hce

/**
 * In-process singleton connecting the always-running [NfcXHostApduService]
 * (started by the OS on APDU selection, independent of any JS lifecycle) to
 * whichever `NfcXModule` instance is currently alive. The service forwards
 * every command here; the module subscribes to hear about them and replies
 * through [respond].
 */
object HceBridge {
  @Volatile
  internal var activeService: NfcXHostApduService? = null

  var onCommand: ((commandApdu: ByteArray) -> Unit)? = null
  var onDeactivated: ((reason: Int) -> Unit)? = null

  /**
   * Sends the response APDU for the most recent command. Returns false if
   * there is no live HCE service to send it through (e.g. the reader
   * already moved away, or no command is pending).
   */
  fun respond(responseApdu: ByteArray): Boolean {
    val service = activeService ?: return false
    service.sendResponseApdu(responseApdu)
    return true
  }
}
