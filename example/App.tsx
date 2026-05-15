import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Nfc, { Ndef, NfcTag, bytesToHex, hexToBytes } from 'react-native-nfc-x';

function describeTag(tag: NfcTag | null): string {
  if (!tag) return '';
  if (!tag.ndefMessage || tag.ndefMessage.records.length === 0) return '(no NDEF message)';
  return tag.ndefMessage.records
    .map((record) => {
      const text = Ndef.text(record);
      if (text) return `Text: "${text.text}" (${text.languageCode})`;
      const uri = Ndef.uri(record);
      if (uri) return `URI: ${uri}`;
      return `Record: tnf=${record.tnf}, ${Ndef.payload(record).length} bytes`;
    })
    .join('\n');
}

function fmtBool(value: boolean | null): string {
  return value === null ? 'checking…' : value ? 'yes' : 'no';
}

export default function App() {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [hceSupported, setHceSupported] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [lastTag, setLastTag] = useState<NfcTag | null>(null);
  const [log, setLog] = useState<string[]>([]);

  const [textToWrite, setTextToWrite] = useState('Hello from react-native-nfc-x!');
  const [uriToWrite, setUriToWrite] = useState('https://example.com');

  const [scanning, setScanning] = useState(false);
  const [scannedTags, setScannedTags] = useState<NfcTag[]>([]);

  const [transceiveCommand, setTransceiveCommand] = useState('00A404000000');
  const [transceiveResponse, setTransceiveResponse] = useState('');

  const [autoRespond, setAutoRespond] = useState(true);
  const [hceCommands, setHceCommands] = useState<string[]>([]);

  const appendLog = useCallback((line: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLog((prev) => [`${timestamp}  ${line}`, ...prev].slice(0, 40));
  }, []);

  useEffect(() => {
    Nfc.isSupported().then(setSupported);
    Nfc.isEnabled().then(setEnabled);
    Nfc.hce.isSupported().then(setHceSupported);
  }, []);

  useEffect(() => {
    const tagSub = Nfc.addTagDiscoveredListener(({ tag }) => {
      setScannedTags((prev) => [tag, ...prev].slice(0, 20));
    });
    const closedSub = Nfc.addSessionClosedListener(({ reason, message }) => {
      appendLog(`Session closed: ${reason}${message ? ` — ${message}` : ''}`);
      setScanning(false);
    });
    const adapterSub = Nfc.addAdapterStateChangedListener((event) => {
      setEnabled(event.enabled);
      appendLog(`NFC adapter ${event.enabled ? 'enabled' : 'disabled'}`);
    });
    return () => {
      tagSub.remove();
      closedSub.remove();
      adapterSub.remove();
    };
  }, [appendLog]);

  useEffect(() => {
    const commandSub = Nfc.hce.addCommandListener(({ commandApdu, aid }) => {
      const hex = bytesToHex(commandApdu);
      appendLog(`HCE command${aid ? ` (aid ${aid})` : ''}: ${hex}`);
      setHceCommands((prev) => [hex, ...prev].slice(0, 20));
      if (autoRespond) {
        Nfc.hce
          .respond(new Uint8Array([0x90, 0x00]))
          .catch((error: Error) => appendLog(`HCE respond failed: ${error.message}`));
      }
    });
    const deactivatedSub = Nfc.hce.addDeactivatedListener(({ reason }) => {
      appendLog(`HCE deactivated: ${reason}`);
    });
    return () => {
      commandSub.remove();
      deactivatedSub.remove();
    };
  }, [appendLog, autoRespond]);

  const runTagOp = useCallback(
    async (label: string, op: () => Promise<NfcTag>) => {
      setBusy(true);
      appendLog(`${label}…`);
      try {
        const tag = await op();
        setLastTag(tag);
        appendLog(`${label} succeeded — tag ${tag.id}`);
      } catch (error: any) {
        appendLog(`${label} failed: ${error?.message ?? String(error)}`);
      } finally {
        setBusy(false);
      }
    },
    [appendLog]
  );

  const handleReadTag = () =>
    runTagOp('Read tag', () => Nfc.readTag({ alertMessage: 'Hold near a tag to read it' }));

  const handleWriteText = () =>
    runTagOp('Write text tag', () =>
      Nfc.writeTag([Ndef.textRecord(textToWrite)], { alertMessage: 'Hold near a tag to write' })
    );

  const handleWriteUri = () =>
    runTagOp('Write URI tag', () =>
      Nfc.writeTag([Ndef.uriRecord(uriToWrite)], { alertMessage: 'Hold near a tag to write' })
    );

  const handleFormat = () =>
    runTagOp('Format tag', () =>
      Nfc.formatTag(null, { alertMessage: 'Hold near a blank tag to format' })
    );

  const handleMakeReadOnly = () => {
    Alert.alert(
      'Make tag read-only?',
      'This permanently locks the tag. It can never be written to or reformatted again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Lock permanently',
          style: 'destructive',
          onPress: () =>
            runTagOp('Make read-only', () =>
              Nfc.makeReadOnly({ alertMessage: 'Hold near the tag to lock' })
            ),
        },
      ]
    );
  };

  const handleTransceive = async () => {
    setBusy(true);
    appendLog('Transceive…');
    try {
      const response = await Nfc.transceive(hexToBytes(transceiveCommand), {
        alertMessage: 'Hold near an ISO-DEP tag',
      });
      const hex = bytesToHex(response);
      setTransceiveResponse(hex);
      appendLog(`Transceive succeeded: ${hex}`);
    } catch (error: any) {
      appendLog(`Transceive failed: ${error?.message ?? String(error)}`);
    } finally {
      setBusy(false);
    }
  };

  const toggleScan = async (next: boolean) => {
    try {
      if (next) {
        await Nfc.startScan({ alertMessage: 'Scanning for tags…' });
        setScanning(true);
        appendLog('Started continuous scan');
      } else {
        await Nfc.stopScan();
        setScanning(false);
        appendLog('Stopped continuous scan');
      }
    } catch (error: any) {
      appendLog(`${next ? 'Start' : 'Stop'} scan failed: ${error?.message ?? String(error)}`);
    }
  };

  const registerDemoAids = async () => {
    try {
      await Nfc.hce.setAidGroups([
        { category: 'other', description: 'Demo applet', aids: ['F0010203040506'] },
      ]);
      appendLog('Registered demo AID group (F0010203040506)');
    } catch (error: any) {
      appendLog(`Register AID failed: ${error?.message ?? String(error)}`);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.header}>react-native-nfc-x</Text>

        <Group title="Status">
          <Row label="Supported" value={fmtBool(supported)} />
          <Row label="NFC enabled" value={fmtBool(enabled)} />
          <Row label="HCE supported" value={fmtBool(hceSupported)} />
        </Group>

        <Group title="Read / Write NDEF">
          <PrimaryButton title="Read Tag" onPress={handleReadTag} disabled={busy} />

          <TextInput
            style={styles.input}
            value={textToWrite}
            onChangeText={setTextToWrite}
            placeholder="Text to write"
          />
          <PrimaryButton title="Write Text Tag" onPress={handleWriteText} disabled={busy} />

          <TextInput
            style={styles.input}
            value={uriToWrite}
            onChangeText={setUriToWrite}
            placeholder="URI to write"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <PrimaryButton title="Write URI Tag" onPress={handleWriteUri} disabled={busy} />

          <PrimaryButton title="Format Tag (blank)" onPress={handleFormat} disabled={busy} />
          <PrimaryButton
            title="Make Read-Only (destructive)"
            onPress={handleMakeReadOnly}
            disabled={busy}
            danger
          />

          {lastTag && (
            <View style={styles.tagCard}>
              <Text style={styles.tagId}>Tag {lastTag.id}</Text>
              <Text style={styles.tagMeta}>{lastTag.techTypes.join(', ')}</Text>
              <Text style={styles.tagMeta}>
                writable: {fmtBool(lastTag.isWritable ?? null)} · maxSize: {lastTag.maxSize ?? '?'}
              </Text>
              <Text style={styles.tagNdef}>{describeTag(lastTag)}</Text>
            </View>
          )}
        </Group>

        <Group title="Continuous Scan">
          <Row label="Scanning" value={<Switch value={scanning} onValueChange={toggleScan} />} />
          {scannedTags.map((tag, index) => (
            <Text key={`${tag.id}-${index}`} style={styles.logLine}>
              {tag.id} — {describeTag(tag)}
            </Text>
          ))}
        </Group>

        <Group title="Raw Transceive (ISO-DEP)">
          <TextInput
            style={styles.input}
            value={transceiveCommand}
            onChangeText={setTransceiveCommand}
            placeholder="Command APDU (hex)"
            autoCapitalize="characters"
            autoCorrect={false}
          />
          <PrimaryButton title="Send Command" onPress={handleTransceive} disabled={busy} />
          {transceiveResponse ? (
            <Text style={styles.logLine}>Response: {transceiveResponse}</Text>
          ) : null}
        </Group>

        <Group title="Host Card Emulation (Android only)">
          <Text style={styles.hint}>
            Core NFC has no public HCE API on iOS — this section is only functional on Android.
          </Text>
          <PrimaryButton title="Register Demo AID (F0010203040506)" onPress={registerDemoAids} />
          <Row
            label="Auto-respond 9000"
            value={<Switch value={autoRespond} onValueChange={setAutoRespond} />}
          />
          {hceCommands.map((command, index) => (
            <Text key={index} style={styles.logLine}>
              ← {command}
            </Text>
          ))}
        </Group>

        <Group title="Log">
          {log.map((line, index) => (
            <Text key={index} style={styles.logLine}>
              {line}
            </Text>
          ))}
        </Group>
      </ScrollView>
    </SafeAreaView>
  );
}

function Group(props: { title: string; children: ReactNode }) {
  return (
    <View style={styles.group}>
      <Text style={styles.groupHeader}>{props.title}</Text>
      {props.children}
    </View>
  );
}

function Row(props: { label: string; value: ReactNode }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{props.label}</Text>
      {typeof props.value === 'string' ? (
        <Text style={styles.rowValue}>{props.value}</Text>
      ) : (
        props.value
      )}
    </View>
  );
}

function PrimaryButton(props: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={props.onPress}
      disabled={props.disabled}
      style={[
        styles.button,
        props.danger && styles.buttonDanger,
        props.disabled && styles.buttonDisabled,
      ]}>
      <Text style={styles.buttonText}>{props.title}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f2f2f7' },
  scrollContent: { paddingBottom: 40 },
  header: { fontSize: 28, fontWeight: '700', margin: 20, marginBottom: 8 },
  group: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
  },
  groupHeader: { fontSize: 17, fontWeight: '600', marginBottom: 12 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  rowLabel: { fontSize: 15, color: '#444' },
  rowValue: { fontSize: 15, fontWeight: '600' },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#c7c7cc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    marginBottom: 10,
  },
  button: {
    backgroundColor: '#007aff',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  buttonDanger: { backgroundColor: '#ff3b30' },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  tagCard: { backgroundColor: '#f2f2f7', borderRadius: 8, padding: 12, marginTop: 4 },
  tagId: { fontSize: 15, fontWeight: '700' },
  tagMeta: { fontSize: 13, color: '#666', marginTop: 2 },
  tagNdef: { fontSize: 14, marginTop: 8 },
  hint: { fontSize: 13, color: '#888', marginBottom: 10 },
  logLine: { fontSize: 12, color: '#333', fontFamily: 'Courier', marginBottom: 4 },
});
