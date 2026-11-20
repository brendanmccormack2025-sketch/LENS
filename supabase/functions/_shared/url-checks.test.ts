// Run: npm run test:url   (Node 22+, no deps)
import assert from 'node:assert/strict';
import { checkLink, extractUrls, isPrivateHost, isSevere, normalizeUrl, staticFlags } from './url-checks.ts';

const flags = (s: string) => staticFlags(normalizeUrl(s)!);

// Scam-shaped links
assert.ok(flags('usps-redelivery-fee.top/pay').some((f) => f.includes('usps')));
assert.ok(flags('usps-redelivery-fee.top/pay').some((f) => f.includes('.top')));
assert.ok(flags('paypal-secure-login.com').some(isSevere));
assert.ok(flags('http://192.168.4.20/login').some(isSevere));
assert.ok(flags('xn--pypal-4ve.com').some(isSevere));
assert.ok(flags('bit.ly/3aF6xxL').some((f) => f.includes('Shortened')));

// Legit links should stay clean
assert.deepEqual(flags('https://www.usps.com/manage/'), []);
assert.deepEqual(flags('https://groups.google.com'), []);
assert.deepEqual(flags('https://www.purchase.edu'), []);
assert.deepEqual(flags('https://smile.amazon.co.uk'), []);

// Parsing
assert.equal(normalizeUrl('javascript:alert(1)'), null);
assert.equal(normalizeUrl('hello'), null);
assert.deepEqual(extractUrls('Your package is held. Pay $1.99 at usps-help.xyz/track now. v2.3.1'), ['usps-help.xyz/track']);

// SSRF guard
for (const h of ['localhost', '127.0.0.1', '10.0.0.5', '172.20.1.1', '192.168.1.1', '169.254.169.254', '[::1]'])
  assert.ok(isPrivateHost(h), h);
assert.ok(!isPrivateHost('example.com'));

// Redirect following with a fake network
const fakeFetch = async (url: string) => {
  const map: Record<string, string> = {
    'https://bit.ly/abc': 'https://step.example.net/r',
    'https://step.example.net/r': 'https://amazon-refund-center.click/login',
  };
  const loc = map[url];
  return new Response(null, { status: loc ? 301 : 200, headers: loc ? { location: loc } : {} });
};
const c = (await checkLink('bit.ly/abc', { fetchImpl: fakeFetch }))!;
assert.ok(c);
assert.equal(c.redirects, 2);
assert.equal(new URL(c.finalUrl).hostname, 'amazon-refund-center.click');
assert.ok(c.flags.some((f) => f.includes('amazon')));
assert.ok(c.flags.some((f) => f.includes('different website')));

// Redirect into internal network is not followed further
const evil = async () => new Response(null, { status: 302, headers: { location: 'http://169.254.169.254/latest/meta-data' } });
const e = await checkLink('https://evil.example.com', { fetchImpl: evil });
assert.equal(new URL(e!.finalUrl).hostname, '169.254.169.254');

console.log('url-checks: all tests passed');
