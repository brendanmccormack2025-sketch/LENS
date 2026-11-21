// Relays the content script's "I'm running" ping to the Wary app via the native handler.
const api = globalThis.browser ?? globalThis.chrome;
api.runtime.onMessage.addListener((msg) => {
  if (msg && msg.type === 'wary-ping') {
    // Safari ignores the application id argument and routes to our own app extension handler.
    api.runtime.sendNativeMessage('application.id', { type: 'wary-ping' }).catch(() => {});
  }
});
