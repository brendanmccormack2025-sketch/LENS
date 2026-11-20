// expo-share-extension labels the extension "$(PRODUCT_NAME) Share Extension",
// which shows up in the iOS share sheet as e.g. "WaryShareExtension Share Extension".
// Rewrite CFBundleDisplayName in the generated Info.plist to the app's name.
// Listed early in app.json plugins so this mod runs after expo-share-extension writes the file.
const { withInfoPlist } = require('expo/config-plugins');
const { IOSConfig } = require('expo/config-plugins');
const plist = require('@expo/plist').default;
const fs = require('fs');
const path = require('path');

module.exports = function withShareExtensionName(config, { displayName } = {}) {
  return withInfoPlist(config, (cfg) => {
    const target = `${IOSConfig.XcodeUtils.sanitizedName(cfg.name)}ShareExtension`;
    const file = path.join(cfg.modRequest.platformProjectRoot, target, 'Info.plist');
    if (fs.existsSync(file)) {
      const info = plist.parse(fs.readFileSync(file, 'utf8'));
      info.CFBundleDisplayName = displayName || cfg.name;
      fs.writeFileSync(file, plist.build(info));
    }
    return cfg;
  });
};
