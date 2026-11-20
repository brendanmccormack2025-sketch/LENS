/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = () => ({
  type: 'message-filter',
  name: 'LENSTextFilter',
  displayName: 'LENS',
  bundleIdentifier: '.textfilter',
  deploymentTarget: '16.4',
});
