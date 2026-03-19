package expo.modules.nfcx.hce

import android.nfc.cardemulation.HostApduService
import android.os.Bundle

/**
 * Android instantiates this service itself (declared in AndroidManifest.xml
 * with the `HOST_APDU_SERVICE` intent filter) whenever a reader selects one
 * of this app's registered AIDs — there's no JS/React lifecycle involved.
 *
 * `processCommandApdu` runs on a Binder thread and normally must reply
 * synchronously, but returning `null` here defers the reply: we forward the
 * command to [HceBridge], which the JS side observes via the `onHceCommand`
 * event, and the actual response comes back later through
 * `HceManager.respond()` -> [HceBridge.respond] -> [sendResponseApdu].
 */
class NfcXHostApduService : HostApduService() {
  override fun onCreate() {
    super.onCreate()
    HceBridge.activeService = this
  }

  override fun onDestroy() {
    if (HceBridge.activeService === this) {
      HceBridge.activeService = null
    }
    super.onDestroy()
  }

  override fun processCommandApdu(commandApdu: ByteArray, extras: Bundle?): ByteArray? {
    HceBridge.onCommand?.invoke(commandApdu)
    return null
  }

  override fun onDeactivated(reason: Int) {
    HceBridge.onDeactivated?.invoke(reason)
  }
}
