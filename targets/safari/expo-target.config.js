/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = () => ({
  type: 'safari',
  name: 'LENSSafari',
  displayName: 'Wary',
  bundleIdentifier: '.safari',
  deploymentTarget: '16.4',
  entitlements: { 'com.apple.security.application-groups': ['group.com.brendanmccormack.lens'] },
});
