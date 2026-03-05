Pod::Spec.new do |s|
  s.name           = 'NfcX'
  s.version        = '1.0.0'
  s.summary        = 'NFC reader/writer wrapping Core NFC, with tag formatting and HCE (Android)'
  s.description    = 'NFC reader/writer wrapping Core NFC (iOS) and the Android NFC APIs, including tag formatting and host card emulation (HCE, Android-only).'
  s.author         = ''
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.platforms      = {
    :ios => '16.4',
    :tvos => '16.4'
  }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  # Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
