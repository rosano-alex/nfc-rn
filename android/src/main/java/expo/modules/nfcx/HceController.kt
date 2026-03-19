package expo.modules.nfcx

import android.content.ComponentName
import android.content.pm.PackageManager
import android.nfc.NfcAdapter
import android.nfc.cardemulation.CardEmulation
import expo.modules.kotlin.AppContext
import expo.modules.nfcx.hce.HceBridge
import expo.modules.nfcx.hce.NfcXHostApduService

/**
 * Wraps `CardEmulation.registerAidsForService` for dynamic AID registration
 * and [HceBridge] for command/response plumbing. The static half of HCE
 * setup (declaring `NfcXHostApduService` and a minimal `apduservice.xml`)
 * lives in this package's AndroidManifest and is optionally extended by the
 * Expo config plugin (`plugin/`) with app-declared AID groups.
 */
class HceController(private val appContext: AppContext) {
  private val context get() = appContext.reactContext

  fun isSupported(): Boolean =
    context?.packageManager?.hasSystemFeature(PackageManager.FEATURE_NFC_HOST_CARD_EMULATION) == true

  fun setAidGroups(groups: List<HceAidGroupOptions>) {
    val ctx = context ?: throw NfcXException.hceUnsupported()
    val adapter = NfcAdapter.getDefaultAdapter(ctx) ?: throw NfcXException.hceUnsupported()
    val cardEmulation = CardEmulation.getInstance(adapter)
    val component = ComponentName(ctx, NfcXHostApduService::class.java)
    groups.forEach { group ->
      cardEmulation.registerAidsForService(component, group.category, group.aids)
    }
  }

  fun isDefaultServiceForCategory(category: String): Boolean {
    val ctx = context ?: return false
    val adapter = NfcAdapter.getDefaultAdapter(ctx) ?: return false
    val cardEmulation = CardEmulation.getInstance(adapter)
    val component = ComponentName(ctx, NfcXHostApduService::class.java)
    return cardEmulation.isDefaultServiceForCategory(component, category)
  }

  fun respond(responseApduHex: String) {
    val sent = HceBridge.respond(responseApduHex.hexToBytes())
    if (!sent) throw NfcXException.hceNoActiveSession()
  }
}
