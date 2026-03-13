package expo.modules.nfcx

import android.app.Activity
import android.nfc.NfcAdapter
import android.nfc.Tag
import android.nfc.tech.IsoDep
import android.nfc.tech.Ndef
import android.nfc.tech.NdefFormatable
import android.nfc.tech.TagTechnology
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import expo.modules.kotlin.AppContext
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

/**
 * Drives Android's `NfcAdapter.enableReaderMode` for both the single-shot
 * operations (read/write/format/makeReadOnly/transceive — each opens reader
 * mode, waits for exactly one tag, and disables it again) and the
 * continuous scan mode, which leaves reader mode enabled and forwards every
 * tag it sees until `stopScan()`.
 *
 * Unlike Core NFC's session objects, Android's reader mode has no built-in
 * "stop after first tag" behavior — that's implemented here by disabling
 * reader mode from inside the callback as soon as one tag has been handled.
 */
class TagSessionController(private val appContext: AppContext) {
  private val handler = Handler(Looper.getMainLooper())
  private val nfcAdapter: NfcAdapter?
    get() = NfcAdapter.getDefaultAdapter(appContext.reactContext)

  private var readerModeActive = false

  var onTagDiscovered: ((NfcTagResult) -> Unit)? = null
  var onScanClosed: ((reason: String, message: String?) -> Unit)? = null

  fun isSupported(): Boolean = nfcAdapter != null

  fun isEnabled(): Boolean = nfcAdapter?.isEnabled == true

  suspend fun readTag(options: NfcOptionsRecord): NfcTagResult =
    runSingleShot(options) { tag -> readTagInfo(tag) }

  suspend fun writeTag(records: List<NdefRecordOptions>, options: NfcOptionsRecord): NfcTagResult =
    runSingleShot(options) { tag -> writeTagInfo(tag, records) }

  suspend fun formatTag(records: List<NdefRecordOptions>?, options: NfcOptionsRecord): NfcTagResult {
    val recordsToWrite = if (records.isNullOrEmpty()) listOf(NdefCodec.emptyRecord()) else records
    return runSingleShot(options) { tag -> formatTagInfo(tag, recordsToWrite) }
  }

  suspend fun makeReadOnly(options: NfcOptionsRecord): NfcTagResult =
    runSingleShot(options) { tag -> lockTagInfo(tag) }

  suspend fun transceive(commandHex: String, options: NfcOptionsRecord): String =
    runSingleShot(options) { tag -> transceiveOnTag(tag, commandHex) }

  fun cancelSession() {
    stopReaderMode()
  }

  fun startScan(options: NfcOptionsRecord) {
    val adapter = nfcAdapter ?: throw NfcXException.unsupported()
    if (!adapter.isEnabled) throw NfcXException.disabled()
    if (readerModeActive) throw NfcXException.sessionAlreadyActive()
    val activity = appContext.currentActivity ?: throw NfcXException.noActivity()

    val callback = NfcAdapter.ReaderCallback { tag ->
      val info = try {
        readTagInfo(tag)
      } catch (e: Throwable) {
        null
      }
      info?.let { onTagDiscovered?.invoke(it) }
    }
    readerModeActive = true
    adapter.enableReaderMode(activity, callback, flagsFor(options), bundleFor(options))
  }

  fun stopScan() {
    stopReaderMode()
    onScanClosed?.invoke("cancelled", null)
  }

  // MARK: single-shot plumbing

  private suspend fun <T> runSingleShot(
    options: NfcOptionsRecord,
    perform: (Tag) -> T
  ): T {
    val adapter = nfcAdapter ?: throw NfcXException.unsupported()
    if (!adapter.isEnabled) throw NfcXException.disabled()
    if (readerModeActive) throw NfcXException.sessionAlreadyActive()
    val activity = appContext.currentActivity ?: throw NfcXException.noActivity()

    return suspendCancellableCoroutine { continuation ->
      var settled = false

      fun settle(block: () -> Unit) {
        if (settled) return
        settled = true
        stopReaderModeInternal(adapter, activity)
        block()
      }

      val timeoutRunnable = options.timeoutSeconds?.let {
        Runnable { settle { continuation.resumeWithException(NfcXException.timeout()) } }
      }

      val callback = NfcAdapter.ReaderCallback { tag ->
        timeoutRunnable?.let { handler.removeCallbacks(it) }
        try {
          val result = perform(tag)
          settle { continuation.resume(result) }
        } catch (error: Throwable) {
          settle { continuation.resumeWithException(error) }
        }
      }

      readerModeActive = true
      adapter.enableReaderMode(activity, callback, flagsFor(options), bundleFor(options))

      timeoutRunnable?.let {
        handler.postDelayed(it, (options.timeoutSeconds!! * 1000).toLong())
      }

      continuation.invokeOnCancellation {
        timeoutRunnable?.let { handler.removeCallbacks(it) }
        settle { }
      }
    }
  }

  private fun stopReaderMode() {
    val adapter = nfcAdapter ?: return
    val activity = appContext.currentActivity
    if (activity != null) {
      stopReaderModeInternal(adapter, activity)
    } else {
      readerModeActive = false
    }
  }

  private fun stopReaderModeInternal(adapter: NfcAdapter, activity: Activity) {
    if (readerModeActive) {
      try {
        adapter.disableReaderMode(activity)
      } catch (e: IllegalStateException) {
        // Activity already finishing/destroyed — reader mode is torn down with it regardless.
      }
    }
    readerModeActive = false
  }

  private fun flagsFor(options: NfcOptionsRecord): Int {
    val requested = options.techList
    var flags = if (requested.isNullOrEmpty()) {
      NfcAdapter.FLAG_READER_NFC_A or NfcAdapter.FLAG_READER_NFC_B or
        NfcAdapter.FLAG_READER_NFC_F or NfcAdapter.FLAG_READER_NFC_V
    } else {
      requested.fold(0) { acc, tech ->
        acc or when (tech) {
          "NfcA", "MifareClassic", "MifareUltralight", "IsoDep" -> NfcAdapter.FLAG_READER_NFC_A
          "NfcB" -> NfcAdapter.FLAG_READER_NFC_B
          "NfcF", "FeliCa" -> NfcAdapter.FLAG_READER_NFC_F
          "NfcV", "Iso15693" -> NfcAdapter.FLAG_READER_NFC_V
          else -> 0
        }
      }
    }
    val readerMode = options.readerMode
    if (readerMode?.skipNdefCheck == true) flags = flags or NfcAdapter.FLAG_READER_SKIP_NDEF_CHECK
    if (readerMode?.noPlatformSounds == true) flags = flags or NfcAdapter.FLAG_READER_NO_PLATFORM_SOUNDS
    return flags
  }

  private fun bundleFor(options: NfcOptionsRecord): Bundle {
    val bundle = Bundle()
    if (options.readerMode?.noPlatformDebounce == true) {
      bundle.putInt(NfcAdapter.EXTRA_READER_PRESENCE_CHECK_DELAY, 0)
    }
    return bundle
  }

  // MARK: tag operations

  private fun readTagInfo(tag: Tag): NfcTagResult {
    val result = NfcTagResult()
    result.id = tag.id.toHex()
    result.techTypes = techTypesOf(tag)

    val ndef = Ndef.get(tag) ?: return result
    try {
      ndef.connect()
      result.maxSize = ndef.maxSize
      result.isWritable = ndef.isWritable
      result.canMakeReadOnly = ndef.canMakeReadOnly()
      val message = ndef.ndefMessage
      if (message != null) {
        result.ndefMessage = NdefCodec.toResult(message)
      }
    } catch (e: Exception) {
      throw NfcXException.tagResponseError(e.message ?: "Failed to read tag.")
    } finally {
      safeClose(ndef)
    }
    return result
  }

  private fun writeTagInfo(tag: Tag, records: List<NdefRecordOptions>): NfcTagResult {
    val message = NdefCodec.toAndroidMessage(records)
    val ndef = Ndef.get(tag) ?: throw NfcXException.tagNotNdef()
    try {
      ndef.connect()
      if (!ndef.isWritable) throw NfcXException.tagReadOnly()
      if (message.toByteArray().size > ndef.maxSize) throw NfcXException.messageTooLarge()
      ndef.writeNdefMessage(message)

      val result = NfcTagResult()
      result.id = tag.id.toHex()
      result.techTypes = techTypesOf(tag)
      result.ndefMessage = NdefCodec.toResult(message)
      result.maxSize = ndef.maxSize
      result.isWritable = true
      result.canMakeReadOnly = ndef.canMakeReadOnly()
      return result
    } catch (e: NfcXException) {
      throw e
    } catch (e: Exception) {
      throw NfcXException.tagResponseError(e.message ?: "Failed to write tag.")
    } finally {
      safeClose(ndef)
    }
  }

  private fun formatTagInfo(tag: Tag, records: List<NdefRecordOptions>): NfcTagResult {
    // Already NDEF-formatted: "format" degrades to a normal write, matching
    // the behavior of writing an empty message to reset a formatted tag.
    if (Ndef.get(tag) != null) {
      return writeTagInfo(tag, records)
    }

    val message = NdefCodec.toAndroidMessage(records)
    val formatable = NdefFormatable.get(tag) ?: throw NfcXException.tagNotNdef()
    try {
      formatable.connect()
      formatable.format(message)
    } catch (e: Exception) {
      throw NfcXException.tagResponseError(e.message ?: "Failed to format tag.")
    } finally {
      safeClose(formatable)
    }

    val result = NfcTagResult()
    result.id = tag.id.toHex()
    result.techTypes = techTypesOf(tag)
    result.ndefMessage = NdefCodec.toResult(message)
    result.isWritable = true
    result.canMakeReadOnly = true
    return result
  }

  private fun lockTagInfo(tag: Tag): NfcTagResult {
    val ndef = Ndef.get(tag) ?: throw NfcXException.tagNotNdef()
    try {
      ndef.connect()
      val locked = ndef.makeReadOnly()
      if (!locked) throw NfcXException.tagResponseError("The tag refused to be locked read-only.")
    } catch (e: NfcXException) {
      throw e
    } catch (e: Exception) {
      throw NfcXException.tagResponseError(e.message ?: "Failed to lock tag.")
    } finally {
      safeClose(ndef)
    }

    val result = NfcTagResult()
    result.id = tag.id.toHex()
    result.techTypes = techTypesOf(tag)
    result.isWritable = false
    result.canMakeReadOnly = false
    return result
  }

  private fun transceiveOnTag(tag: Tag, commandHex: String): String {
    val isoDep = IsoDep.get(tag) ?: throw NfcXException.transceiveUnsupported()
    try {
      isoDep.connect()
      val response = isoDep.transceive(commandHex.hexToBytes())
      return response.toHex()
    } catch (e: Exception) {
      throw NfcXException.tagResponseError(e.message ?: "Transceive failed.")
    } finally {
      safeClose(isoDep)
    }
  }

  private fun techTypesOf(tag: Tag): List<String> = tag.techList.map { it.substringAfterLast('.') }

  private fun safeClose(tech: TagTechnology) {
    try {
      tech.close()
    } catch (e: Exception) {
      // Tag already moved out of range — nothing left to clean up.
    }
  }
}
