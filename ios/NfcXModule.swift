import CoreNFC
import ExpoModulesCore

public class NfcXModule: Module {
  private let controller = NfcSessionController()

  public func definition() -> ModuleDefinition {
    Name("NfcX")

    Events(
      "onTagDiscovered",
      "onSessionClosed",
      "onAdapterStateChanged",
      "onHceCommand",
      "onHceDeactivated"
    )

    OnCreate {
      self.controller.onTagDiscovered = { [weak self] tag in
        self?.sendEvent("onTagDiscovered", ["tag": tag.toDictionary(appContext: self?.appContext)])
      }
      self.controller.onScanClosed = { [weak self] reason, message in
        self?.sendEvent("onSessionClosed", ["reason": reason, "message": message as Any])
      }
    }

    AsyncFunction("isSupported") { () -> Bool in
      NFCTagReaderSession.readingAvailable
    }

    // iOS has no user-facing NFC on/off toggle — "enabled" and "supported" coincide.
    AsyncFunction("isEnabled") { () -> Bool in
      NFCTagReaderSession.readingAvailable
    }

    AsyncFunction("readTag") { (options: NfcOptionsRecord) -> NfcTagRecord in
      try await self.controller.readTag(options: options)
    }

    AsyncFunction("writeTag") { (records: [NdefRecordRecord], options: NfcOptionsRecord) -> NfcTagRecord in
      try await self.controller.writeTag(records: records, options: options)
    }

    AsyncFunction("formatTag") { (records: [NdefRecordRecord]?, options: NfcOptionsRecord) -> NfcTagRecord in
      try await self.controller.formatTag(records: records, options: options)
    }

    AsyncFunction("makeReadOnly") { (options: NfcOptionsRecord) -> NfcTagRecord in
      try await self.controller.makeReadOnly(options: options)
    }

    AsyncFunction("transceive") { (commandApduHex: String, options: NfcOptionsRecord) -> String in
      try await self.controller.transceive(commandHex: commandApduHex, options: options)
    }

    AsyncFunction("cancelSession") {
      self.controller.cancelSession()
    }

    AsyncFunction("startScan") { (options: NfcOptionsRecord) in
      try self.controller.startScan(options: options)
    }

    AsyncFunction("stopScan") {
      self.controller.stopScan()
    }

    // MARK: HCE — unsupported on iOS. See NfcXException.hceUnsupportedPlatform().

    AsyncFunction("hceIsSupported") { () -> Bool in
      false
    }

    AsyncFunction("hceSetAidGroups") { (_: [HceAidGroupRecord]) in
      throw NfcXException.hceUnsupportedPlatform()
    }

    AsyncFunction("hceIsDefaultServiceForCategory") { (_: String) -> Bool in
      false
    }

    AsyncFunction("hceRespond") { (_: String) in
      throw NfcXException.hceUnsupportedPlatform()
    }
  }
}
