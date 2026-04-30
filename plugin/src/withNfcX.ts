import {
  ConfigPlugin,
  withDangerousMod,
  withEntitlementsPlist,
  withInfoPlist,
} from '@expo/config-plugins';
import * as fs from 'fs';
import * as path from 'path';

export interface HceAidGroupConfig {
  category: 'payment' | 'other';
  description: string;
  aids: string[];
}

export interface NfcXPluginOptions {
  ios?: {
    /** Required by Core NFC — shown in the permission prompt the first time the app scans a tag. */
    nfcReaderUsageDescription?: string;
    /** For background/passive tag matching against specific smart-card AIDs. Most NDEF-only apps can skip this. */
    select7816Identifiers?: string[];
  };
  android?: {
    hce?: {
      /** So the app shows up as a card-emulation option immediately, without waiting on `Nfc.hce.setAidGroups()` at runtime. */
      aidGroups?: HceAidGroupConfig[];
    };
  };
}

const DEFAULT_READER_USAGE_DESCRIPTION =
  'This app uses NFC to read and write tags near your device.';

const APDU_SERVICE_RESOURCE_NAME = 'nfcx_apduservice';
const STRINGS_RESOURCE_NAME = 'nfcx_hce_strings';

const withNfcXIos: ConfigPlugin<NfcXPluginOptions> = (config, options) => {
  config = withInfoPlist(config, (config) => {
    config.modResults.NFCReaderUsageDescription =
      options.ios?.nfcReaderUsageDescription ?? DEFAULT_READER_USAGE_DESCRIPTION;

    if (options.ios?.select7816Identifiers?.length) {
      config.modResults['com.apple.developer.nfc.readersession.iso7816.select-identifiers'] =
        options.ios.select7816Identifiers;
    }
    return config;
  });

  config = withEntitlementsPlist(config, (config) => {
    // NDEF-only reads don't strictly need the TAG format, but declaring both
    // keeps transceive() and raw ISO7816/ISO15693/FeliCa access working too.
    config.modResults['com.apple.developer.nfc.readersession.formats'] = ['TAG', 'NDEF'];
    return config;
  });

  return config;
};

/**
 * Overwrites the empty `nfcx_apduservice.xml` placeholder this package
 * ships with by writing a real one into the app's own res/xml — Android's
 * resource merger lets an app module's resource win over a library's
 * same-named one, so the `<service>` in the library manifest keeps
 * resolving `@xml/nfcx_apduservice` to this version.
 */
const withNfcXHceAidGroups: ConfigPlugin<NfcXPluginOptions> = (config, options) => {
  const aidGroups = options.android?.hce?.aidGroups;
  if (!aidGroups || aidGroups.length === 0) {
    return config;
  }

  return withDangerousMod(config, [
    'android',
    async (config) => {
      const resDir = path.join(config.modRequest.platformProjectRoot, 'app', 'src', 'main', 'res');
      const xmlDir = path.join(resDir, 'xml');
      const valuesDir = path.join(resDir, 'values');
      fs.mkdirSync(xmlDir, { recursive: true });
      fs.mkdirSync(valuesDir, { recursive: true });

      // Android's `android:description` on <host-apdu-service>/<aid-group> is
      // format="reference" only — it rejects inline strings — so every
      // description needs a generated @string resource to point at.
      const strings: { name: string; value: string }[] = [
        { name: 'nfcx_hce_service_description', value: 'NFC Card' },
      ];
      const groupDescriptionNames = aidGroups.map((group, index) => {
        const name = `nfcx_hce_aid_group_${index}_description`;
        strings.push({ name, value: group.description });
        return name;
      });

      fs.writeFileSync(
        path.join(valuesDir, `${STRINGS_RESOURCE_NAME}.xml`),
        renderStringsXml(strings),
        'utf8'
      );
      fs.writeFileSync(
        path.join(xmlDir, `${APDU_SERVICE_RESOURCE_NAME}.xml`),
        renderApduServiceXml(aidGroups, groupDescriptionNames),
        'utf8'
      );
      return config;
    },
  ]);
};

function renderStringsXml(strings: { name: string; value: string }[]): string {
  const entries = strings
    .map((s) => `  <string name="${s.name}">${escapeXml(s.value)}</string>`)
    .join('\n');
  return `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n${entries}\n</resources>\n`;
}

function renderApduServiceXml(
  aidGroups: HceAidGroupConfig[],
  groupDescriptionNames: string[]
): string {
  const groups = aidGroups
    .map(
      (
        group,
        index
      ) => `  <aid-group android:description="@string/${groupDescriptionNames[index]}" android:category="${group.category}">
${group.aids.map((aid) => `    <aid-filter android:name="${escapeXml(aid.replace(/[^0-9a-fA-F]/g, '').toUpperCase())}" />`).join('\n')}
  </aid-group>`
    )
    .join('\n');

  return `<?xml version="1.0" encoding="utf-8"?>
<host-apdu-service xmlns:android="http://schemas.android.com/apk/res/android"
  android:description="@string/nfcx_hce_service_description"
  android:requireDeviceUnlock="false">
${groups}
</host-apdu-service>
`;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export const withNfcX: ConfigPlugin<NfcXPluginOptions | void> = (config, options) => {
  const resolvedOptions: NfcXPluginOptions = options ? options : {};
  config = withNfcXIos(config, resolvedOptions);
  config = withNfcXHceAidGroups(config, resolvedOptions);
  return config;
};

export default withNfcX;
