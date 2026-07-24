import CoreNFC

/// Owns every Core NFC session this module opens — at most one at a time,
/// whether that's a single-shot `NFCTagReaderSession` op or a continuous
/// `NFCNDEFReaderSession` scan.
///
/// Core NFC itself is delegate/completion-handler based; wrapping it in
/// async/await here keeps `NfcXModule`'s function bodies flat instead of
/// nesting callbacks three deep.
final class NfcSessionController: NSObject {
  private let sessionQueue = DispatchQueue(label: "expo.modules.nfcx.session")

  private var activeTagSession: NFCTagReaderSession?
  private var activeNdefSession: NFCNDEFReaderSession?

  // Bridges the delegate callbacks (which aren't generic) to the strongly
  // typed continuation captured by the in-flight `runSingleShot` call.
  private var tagDetectedHandler: ((NFCTagReaderSession, [NFCTag]) -> Void)?
  private var tagSessionInvalidatedHandler: ((Error) -> Void)?

  var onTagDiscovered: ((NfcTagRecord) -> Void)?
  var onScanClosed: ((_ reason: String, _ message: String?) -> Void)?

  // MARK: Single-shot operations

  func readTag(options: NfcOptionsRecord) async throws -> NfcTagRecord {
    try await runSingleShot(options: options) { [self] _, tag in
      try await readTagInfo(tag)
    }
  }

  func writeTag(records: [NdefRecordRecord], options: NfcOptionsRecord) async throws -> NfcTagRecord {
    try await runSingleShot(options: options) { [self] _, tag in
      try await writeTagInfo(tag, records: records)
    }
  }

  func formatTag(records: [NdefRecordRecord]?, options: NfcOptionsRecord) async throws -> NfcTagRecord {
    let recordsToWrite = (records?.isEmpty == false) ? records! : [NdefRecordRecord.empty()]
    return try await runSingleShot(options: options) { [self] _, tag in
      try await writeTagInfo(tag, records: recordsToWrite)
    }
  }

  func makeReadOnly(options: NfcOptionsRecord) async throws -> NfcTagRecord {
    try await runSingleShot(options: options) { [self] _, tag in
      try await lockTag(tag)
    }
  }

  func transceive(commandHex: String, options: NfcOptionsRecord) async throws -> String {
    try await runSingleShot(options: options) { [self] _, tag in
      try await transceiveOnTag(tag, commandHex: commandHex)
    }
  }

  func cancelSession() {
    activeTagSession?.invalidate()
    activeTagSession = nil
    activeNdefSession?.invalidate()
    activeNdefSession = nil
  }

  // MARK: Continuous scan

  func startScan(options: NfcOptionsRecord) throws {
    guard NFCNDEFReaderSession.readingAvailable else {
      throw NfcXException.unsupported()
    }
    guard activeTagSession == nil, activeNdefSession == nil else {
      throw NfcXException.sessionAlreadyActive()
    }
    let session = NFCNDEFReaderSession(delegate: self, queue: sessionQueue, invalidateAfterFirstRead: false)
    session.alertMessage = options.alertMessage ?? "Hold your device near an NFC tag."
    activeNdefSession = session
    session.begin()
  }

  func stopScan() {
    activeNdefSession?.invalidate()
    activeNdefSession = nil
  }

  // MARK: Single-shot session plumbing

  private func runSingleShot<T>(
    options: NfcOptionsRecord,
    perform: @escaping (NFCTagReaderSession, NFCTag) async throws -> T
  ) async throws -> T {
    guard NFCTagReaderSession.readingAvailable else {
      throw NfcXException.unsupported()
    }
    guard activeTagSession == nil, activeNdefSession == nil else {
      throw NfcXException.sessionAlreadyActive()
    }

    return try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<T, Error>) in
      var didResume = false
      let resume: (Result<T, Error>) -> Void = { [weak self] result in
        guard !didResume else { return }
        didResume = true
        self?.tagDetectedHandler = nil
        self?.tagSessionInvalidatedHandler = nil
        switch result {
        case .success(let value):
          continuation.resume(returning: value)
        case .failure(let error):
          continuation.resume(throwing: error)
        }
      }

      tagSessionInvalidatedHandler = { [weak self] error in
        self?.activeTagSession = nil
        resume(.failure(self?.mapSessionError(error) ?? error))
      }

      tagDetectedHandler = { [weak self] session, tags in
        guard let self else { return }
        guard let tag = tags.first else { return }
        if tags.count > 1 {
          session.alertMessage = "More than one tag detected. Move all but one tag away and try again."
          self.sessionQueue.asyncAfter(deadline: .now() + 0.75) { session.restartPolling() }
          return
        }
        session.connect(to: tag) { connectError in
          if let connectError {
            resume(.failure(self.mapSessionError(connectError)))
            session.invalidate(errorMessage: "Unable to connect to tag.")
            return
          }
          Task {
            do {
              let value = try await perform(session, tag)
              resume(.success(value))
              session.alertMessage = options.successAlertMessage ?? session.alertMessage
              session.invalidate()
            } catch {
              resume(.failure(error))
              let message = options.errorAlertMessage ?? (error as? NfcXException)?.reason
              session.invalidate(errorMessage: message ?? "NFC operation failed.")
            }
          }
        }
      }

      let session = NFCTagReaderSession(
        pollingOption: [.iso14443, .iso15693, .iso18092],
        delegate: self,
        queue: sessionQueue
      )
      session?.alertMessage = options.alertMessage ?? "Hold your device near an NFC tag."
      activeTagSession = session
      session?.begin()

      if session == nil {
        resume(.failure(NfcXException.unsupported()))
      }

      if let timeoutSeconds = options.timeoutSeconds {
        sessionQueue.asyncAfter(deadline: .now() + timeoutSeconds) { [weak self] in
          guard let self, self.activeTagSession === session else { return }
          session?.invalidate(errorMessage: "Timed out waiting for a tag.")
        }
      }
    }
  }

  // MARK: Tag operations

  private func readTagInfo(_ tag: NFCTag) async throws -> NfcTagRecord {
    let info = TagInfo(tag)
    var result = NfcTagRecord()
    result.id = info.id.hexEncoded
    result.techTypes = info.techTypes

    guard let ndefTag = info.ndef else { return result }
    let (status, capacity) = try await queryStatus(ndefTag)
    result.maxSize = capacity
    result.isWritable = status == .readWrite
    result.canMakeReadOnly = status == .readWrite

    if status != .notSupported, let message = try await readNdefMessage(ndefTag) {
      result.ndefMessage = toRecord(message)
    }
    return result
  }

  private func writeTagInfo(_ tag: NFCTag, records: [NdefRecordRecord]) async throws -> NfcTagRecord {
    let info = TagInfo(tag)
    guard let ndefTag = info.ndef else { throw NfcXException.tagNotNdef() }

    let (status, capacity) = try await queryStatus(ndefTag)
    guard status != .notSupported else { throw NfcXException.tagNotNdef() }
    guard status != .readOnly else { throw NfcXException.tagReadOnly() }

    let message = try toNFCNDEFMessage(records)
    guard message.length <= capacity else { throw NfcXException.messageTooLarge() }
    try await writeNdefMessage(ndefTag, message: message)

    var result = NfcTagRecord()
    result.id = info.id.hexEncoded
    result.techTypes = info.techTypes
    result.ndefMessage = toRecord(message)
    result.maxSize = capacity
    result.isWritable = true
    result.canMakeReadOnly = true
    return result
  }

  private func lockTag(_ tag: NFCTag) async throws -> NfcTagRecord {
    let info = TagInfo(tag)
    guard let ndefTag = info.ndef else { throw NfcXException.tagNotNdef() }
    try await writeLock(ndefTag)

    var result = NfcTagRecord()
    result.id = info.id.hexEncoded
    result.techTypes = info.techTypes
    result.isWritable = false
    result.canMakeReadOnly = false
    return result
  }

  private func transceiveOnTag(_ tag: NFCTag, commandHex: String) async throws -> String {
    guard case let .iso7816(iso7816Tag) = tag else {
      throw NfcXException.transceiveUnsupported()
    }
    guard let apdu = NFCISO7816APDU(data: Data(hexEncoded: commandHex)) else {
      throw NfcXException.invalidApdu()
    }
    let response = try await sendIso7816(iso7816Tag, apdu: apdu)
    return response.hexEncoded
  }

  // MARK: Core NFC completion-handler -> async bridges

  private func queryStatus(_ tag: NFCNDEFTag) async throws -> (status: NFCNDEFStatus, capacity: Int) {
    try await withCheckedThrowingContinuation { continuation in
      tag.queryNDEFStatus { status, capacity, error in
        if let error {
          continuation.resume(throwing: NfcXException.tagResponseError(error.localizedDescription))
          return
        }
        continuation.resume(returning: (status, capacity))
      }
    }
  }

  private func readNdefMessage(_ tag: NFCNDEFTag) async throws -> NFCNDEFMessage? {
    try await withCheckedThrowingContinuation { continuation in
      tag.readNDEF { message, error in
        if let error {
          let nsError = error as NSError
          // A blank-but-formatted tag reports an error here rather than an empty message.
          if nsError.domain == NFCErrorDomain,
             nsError.code == NFCReaderError.ndefReaderSessionErrorZeroLengthMessage.rawValue {
            continuation.resume(returning: nil)
            return
          }
          continuation.resume(throwing: NfcXException.tagResponseError(error.localizedDescription))
          return
        }
        continuation.resume(returning: message)
      }
    }
  }

  private func writeNdefMessage(_ tag: NFCNDEFTag, message: NFCNDEFMessage) async throws {
    try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
      tag.writeNDEF(message) { error in
        if let error {
          continuation.resume(throwing: NfcXException.tagResponseError(error.localizedDescription))
          return
        }
        continuation.resume()
      }
    }
  }

  private func writeLock(_ tag: NFCNDEFTag) async throws {
    try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
      tag.writeLock { error in
        if let error {
          continuation.resume(throwing: NfcXException.tagResponseError(error.localizedDescription))
          return
        }
        continuation.resume()
      }
    }
  }

  private func sendIso7816(_ tag: NFCISO7816Tag, apdu: NFCISO7816APDU) async throws -> Data {
    try await withCheckedThrowingContinuation { continuation in
      tag.sendCommand(apdu: apdu) { responseData, sw1, sw2, error in
        if let error {
          continuation.resume(throwing: NfcXException.tagResponseError(error.localizedDescription))
          return
        }
        var full = responseData
        full.append(sw1)
        full.append(sw2)
        continuation.resume(returning: full)
      }
    }
  }

  // MARK: NDEF <-> wire format

  private func toNFCNDEFMessage(_ records: [NdefRecordRecord]) throws -> NFCNDEFMessage {
    let payloads = try records.map { record -> NFCNDEFPayload in
      guard let typeData = Data(base64Encoded: record.type) else {
        throw NfcXException.invalidRecord()
      }
      guard let payloadData = Data(base64Encoded: record.payload) else {
        throw NfcXException.invalidRecord()
      }
      let idData = record.id.isEmpty ? Data() : (Data(base64Encoded: record.id) ?? Data())
      return NFCNDEFPayload(
        format: typeNameFormat(from: record.tnf),
        type: typeData,
        identifier: idData,
        payload: payloadData
      )
    }
    return NFCNDEFMessage(records: payloads)
  }

  private func toRecord(_ message: NFCNDEFMessage) -> NdefMessageRecord {
    var result = NdefMessageRecord()
    result.records = message.records.map { payload in
      var record = NdefRecordRecord()
      record.tnf = tnfValue(from: payload.typeNameFormat)
      record.type = payload.type.base64EncodedString()
      record.id = payload.identifier.isEmpty ? "" : payload.identifier.base64EncodedString()
      record.payload = payload.payload.base64EncodedString()
      return record
    }
    return result
  }

  private func typeNameFormat(from tnf: Int) -> NFCTypeNameFormat {
    switch tnf {
    case 0: return .empty
    case 1: return .nfcWellKnown
    case 2: return .media
    case 3: return .absoluteURI
    case 4: return .nfcExternal
    case 6: return .unchanged
    default: return .unknown
    }
  }

  private func tnfValue(from format: NFCTypeNameFormat) -> Int {
    switch format {
    case .empty: return 0
    case .nfcWellKnown: return 1
    case .media: return 2
    case .absoluteURI: return 3
    case .nfcExternal: return 4
    case .unchanged: return 6
    default: return 5
    }
  }

  private func mapSessionError(_ error: Error) -> Error {
    let nsError = error as NSError
    guard nsError.domain == NFCErrorDomain else {
      return NfcXException.tagResponseError(nsError.localizedDescription)
    }
    switch nsError.code {
    case NFCReaderError.readerSessionInvalidationErrorUserCanceled.rawValue:
      return NfcXException.cancelled()
    case NFCReaderError.readerSessionInvalidationErrorSessionTimeout.rawValue:
      return NfcXException.timeout()
    case NFCReaderError.readerTransceiveErrorTagConnectionLost.rawValue:
      return NfcXException.tagLost()
    default:
      return NfcXException.tagResponseError(nsError.localizedDescription)
    }
  }

  private func reasonCode(for error: Error) -> String {
    let nsError = error as NSError
    if nsError.domain == NFCErrorDomain,
       nsError.code == NFCReaderError.readerSessionInvalidationErrorUserCanceled.rawValue {
      return "cancelled"
    }
    if nsError.domain == NFCErrorDomain,
       nsError.code == NFCReaderError.readerSessionInvalidationErrorSessionTimeout.rawValue {
      return "timeout"
    }
    return "error"
  }
}

// MARK: - NFCTagReaderSessionDelegate

extension NfcSessionController: NFCTagReaderSessionDelegate {
  func tagReaderSessionDidBecomeActive(_ session: NFCTagReaderSession) {}

  func tagReaderSession(_ session: NFCTagReaderSession, didInvalidateWithError error: Error) {
    activeTagSession = nil
    tagSessionInvalidatedHandler?(error)
  }

  func tagReaderSession(_ session: NFCTagReaderSession, didDetect tags: [NFCTag]) {
    tagDetectedHandler?(session, tags)
  }
}

// MARK: - NFCNDEFReaderSessionDelegate (continuous scan)

extension NfcSessionController: NFCNDEFReaderSessionDelegate {
  func readerSession(_ session: NFCNDEFReaderSession, didDetectNDEFs messages: [NFCNDEFMessage]) {
    // Superseded by didDetect(tags:) below, which we need for tag identity.
    // Required by the protocol regardless.
  }

  func readerSession(_ session: NFCNDEFReaderSession, didDetect tags: [NFCNDEFTag]) {
    guard let tag = tags.first else { return }
    session.connect(to: tag) { [weak self] error in
      guard let self, error == nil else {
        session.restartPolling()
        return
      }
      Task {
        if let message = try? await self.readNdefMessage(tag) {
          let info = TagInfo(tag)
          var record = NfcTagRecord()
          record.id = info.id.hexEncoded
          record.techTypes = info.techTypes
          record.ndefMessage = self.toRecord(message)
          self.onTagDiscovered?(record)
        }
        session.restartPolling()
      }
    }
  }

  func readerSession(_ session: NFCNDEFReaderSession, didInvalidateWithError error: Error) {
    activeNdefSession = nil
    onScanClosed?(reasonCode(for: error), error.localizedDescription)
  }
}

// MARK: - Tag introspection

/// Unwraps the `NFCTag`/`NFCNDEFTag` existentials Core NFC hands back into
/// the pieces this module needs: an `NFCNDEFTag` (for NDEF ops, when the
/// underlying tag supports it), a UID, and an approximate tech-type list.
/// Core NFC doesn't expose the same fine-grained tech info Android's
/// `Tag.getTechList()` does, so this is best-effort.
private struct TagInfo {
  let ndef: NFCNDEFTag?
  let id: Data
  let techTypes: [String]

  init(_ tag: NFCTag) {
    switch tag {
    case .iso7816(let t):
      ndef = t
      id = t.identifier
      techTypes = ["IsoDep"]
    case .miFare(let t):
      ndef = t
      id = t.identifier
      techTypes = ["MifareClassic", "NfcA"]
    case .iso15693(let t):
      ndef = t
      id = t.identifier
      techTypes = ["Iso15693", "NfcV"]
    case .feliCa(let t):
      ndef = t
      id = t.currentIDm
      techTypes = ["FeliCa", "NfcF"]
    @unknown default:
      ndef = nil
      id = Data()
      techTypes = []
    }
  }

  init(_ tag: NFCNDEFTag) {
    ndef = tag
    if let t = tag as? NFCISO7816Tag {
      id = t.identifier
      techTypes = ["IsoDep"]
    } else if let t = tag as? NFCMiFareTag {
      id = t.identifier
      techTypes = ["MifareClassic", "NfcA"]
    } else if let t = tag as? NFCISO15693Tag {
      id = t.identifier
      techTypes = ["Iso15693", "NfcV"]
    } else if let t = tag as? NFCFeliCaTag {
      id = t.currentIDm
      techTypes = ["FeliCa", "NfcF"]
    } else {
      id = Data()
      techTypes = []
    }
  }
}

// MARK: - Hex helpers

private extension Data {
  var hexEncoded: String {
    map { String(format: "%02x", $0) }.joined()
  }

  init(hexEncoded hex: String) {
    var data = Data()
    var chars = Array(hex)
    if chars.count % 2 != 0 { chars.removeLast() }
    var index = 0
    while index < chars.count {
      let byteString = String(chars[index]) + String(chars[index + 1])
      if let byte = UInt8(byteString, radix: 16) {
        data.append(byte)
      }
      index += 2
    }
    self = data
  }
}
