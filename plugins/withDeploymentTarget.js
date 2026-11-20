// expo-share-extension hard-codes IPHONEOS_DEPLOYMENT_TARGET = 15.1 for the share
// extension target, but Expo SDK 58 modules require iOS 16.4+. This raises every
// build configuration in the Xcode project (app + extension) to the same minimum.
const { withXcodeProject } = require('expo/config-plugins');

module.exports = function withDeploymentTarget(config, { target = '16.4' } = {}) {
  return withXcodeProject(config, (cfg) => {
    const configs = cfg.modResults.pbxXCBuildConfigurationSection();
    for (const key of Object.keys(configs)) {
      const settings = configs[key] && configs[key].buildSettings;
      if (settings && settings.IPHONEOS_DEPLOYMENT_TARGET) {
        settings.IPHONEOS_DEPLOYMENT_TARGET = target;
      }
    }
    return cfg;
  });
};
