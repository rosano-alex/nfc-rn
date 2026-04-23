import { ConfigPlugin, withEntitlementsPlist, withInfoPlist } from '@expo/config-plugins';

export interface NfcXPluginOptions {
  ios?: {
    /** Required by Core NFC — shown in the permission prompt the first time the app scans a tag. */
    nfcReaderUsageDescription?: string;
    /** For background/passive tag matching against specific smart-card AIDs. Most NDEF-only apps can skip this. */
    select7816Identifiers?: string[];
  };
}

const DEFAULT_READER_USAGE_DESCRIPTION =
  'This app uses NFC to read and write tags near your device.';

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

export const withNfcX: ConfigPlugin<NfcXPluginOptions | void> = (config, options) => {
  const resolvedOptions: NfcXPluginOptions = options ? options : {};
  config = withNfcXIos(config, resolvedOptions);
  return config;
};

export default withNfcX;
