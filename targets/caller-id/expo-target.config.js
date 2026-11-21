/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = () => ({
  type: 'call-directory',
  name: 'WaryCallerID',
  displayName: 'Wary',
  bundleIdentifier: '.callerid',
  deploymentTarget: '16.4',
  entitlements: { 'com.apple.security.application-groups': ['group.com.brendanmccormack.lens'] },
});
