import {
  ConfigPlugin,
  withDangerousMod,
  withEntitlementsPlist,
  withInfoPlist,
} from '@expo/config-plugins';
import fs from 'fs';
import path from 'path';

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
    config.modResults['com.apple.developer.nfc.readersession.formats'] = ['TAG', 'NDEF'];
    return config;
  });

  return config;
};

/**
 * Writes the AID groups from `android.hce.aidGroups` into
 * `android/app/src/main/res/xml/nfcx_apduservice.xml` in the generated
 * project. Android's resource merger lets an app module's resource
 * override a library's same-named one, so this replaces the empty
 * placeholder `nfcx_apduservice.xml` this package's Android module ships
 * with — the `<service>` declaration (which lives in the library's
 * manifest) keeps pointing at `@xml/nfcx_apduservice` either way.
 */
const withNfcXHceAidGroups: ConfigPlugin<NfcXPluginOptions> = (config, options) => {
  const aidGroups = options.android?.hce?.aidGroups;
  if (!aidGroups || aidGroups.length === 0) {
    return config;
  }

  return withDangerousMod(config, [
    'android',
    async (config) => {
      const xmlDir = path.join(
        config.modRequest.platformProjectRoot,
        'app',
        'src',
        'main',
        'res',
        'xml'
      );
      fs.mkdirSync(xmlDir, { recursive: true });
      const filePath = path.join(xmlDir, `${APDU_SERVICE_RESOURCE_NAME}.xml`);
      fs.writeFileSync(filePath, renderApduServiceXml(aidGroups), 'utf8');
      return config;
    },
  ]);
};

function renderApduServiceXml(aidGroups: HceAidGroupConfig[]): string {
  const groups = aidGroups
    .map(
      (group) => `  <aid-group android:description="${escapeXml(group.description)}" android:category="${group.category}">
${group.aids.map((aid) => `    <aid-filter android:name="${escapeXml(aid.replace(/[^0-9a-fA-F]/g, '').toUpperCase())}" />`).join('\n')}
  </aid-group>`
    )
    .join('\n');

  return `<?xml version="1.0" encoding="utf-8"?>
<host-apdu-service xmlns:android="http://schemas.android.com/apk/res/android"
  android:description="@string/app_name"
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
  const resolvedOptions = options ?? {};
  config = withNfcXIos(config, resolvedOptions);
  config = withNfcXHceAidGroups(config, resolvedOptions);
  return config;
};

export default withNfcX;
