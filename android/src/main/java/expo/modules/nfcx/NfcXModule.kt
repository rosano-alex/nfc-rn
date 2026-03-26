package expo.modules.nfcx

import android.nfc.cardemulation.HostApduService
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.nfcx.hce.HceBridge

class NfcXModule : Module() {
  private val tagController by lazy { TagSessionController(appContext) }
  private val hceController by lazy { HceController(appContext) }

  override fun definition() = ModuleDefinition {
    Name("NfcX")

    Events(
      "onTagDiscovered",
      "onSessionClosed",
      "onAdapterStateChanged",
      "onHceCommand",
      "onHceDeactivated"
    )

    OnCreate {
      tagController.onTagDiscovered = { tag ->
        sendEvent("onTagDiscovered", mapOf("tag" to tag))
      }
      tagController.onScanClosed = { reason, message ->
        sendEvent("onSessionClosed", mapOf("reason" to reason, "message" to message))
      }
      HceBridge.onCommand = { apdu ->
        sendEvent("onHceCommand", mapOf("commandApdu" to apdu.toHex()))
      }
      HceBridge.onDeactivated = { reason ->
        sendEvent("onHceDeactivated", mapOf("reason" to deactivationReasonName(reason)))
      }
    }

    OnDestroy {
      HceBridge.onCommand = null
      HceBridge.onDeactivated = null
    }

    AsyncFunction("isSupported") {
      tagController.isSupported()
    }

    AsyncFunction("isEnabled") {
      tagController.isEnabled()
    }

    AsyncFunction("readTag") Coroutine { options: NfcOptionsRecord ->
      tagController.readTag(options)
    }

    AsyncFunction("writeTag") Coroutine { records: List<NdefRecordOptions>, options: NfcOptionsRecord ->
      tagController.writeTag(records, options)
    }

    AsyncFunction("formatTag") Coroutine { records: List<NdefRecordOptions>?, options: NfcOptionsRecord ->
      tagController.formatTag(records, options)
    }

    AsyncFunction("makeReadOnly") Coroutine { options: NfcOptionsRecord ->
      tagController.makeReadOnly(options)
    }

    AsyncFunction("transceive") Coroutine { commandApduHex: String, options: NfcOptionsRecord ->
      tagController.transceive(commandApduHex, options)
    }

    AsyncFunction("cancelSession") {
      tagController.cancelSession()
    }

    AsyncFunction("startScan") { options: NfcOptionsRecord ->
      tagController.startScan(options)
    }

    AsyncFunction("stopScan") {
      tagController.stopScan()
    }

    AsyncFunction("hceIsSupported") {
      hceController.isSupported()
    }

    AsyncFunction("hceSetAidGroups") { groups: List<HceAidGroupOptions> ->
      hceController.setAidGroups(groups)
    }

    AsyncFunction("hceIsDefaultServiceForCategory") { category: String ->
      hceController.isDefaultServiceForCategory(category)
    }

    AsyncFunction("hceRespond") { responseApduHex: String ->
      hceController.respond(responseApduHex)
    }
  }

  private fun deactivationReasonName(reason: Int): String = when (reason) {
    HostApduService.DEACTIVATION_LINK_LOSS -> "LINK_LOSS"
    HostApduService.DEACTIVATION_DESELECTED -> "DESELECTED"
    else -> "UNKNOWN"
  }
}
