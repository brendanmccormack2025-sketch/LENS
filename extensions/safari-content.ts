// Wary Safari content script. Bundled into targets/safari/assets/content.js by `npm run build:safari`.
// Runs on every page the user allows, entirely on-device: nothing about the page leaves Safari.
//
// It only warns when there's strong evidence, because a false alarm on a real bank
// teaches people to ignore Wary. Signals:
//   1. Severe address tricks (look-alike characters, raw IP, fake brand domain, "@")
//   2. The page presents itself as a big brand AND asks for a password/card,
//      but isn't on that brand's real website.
import { BRANDS, isSevere, registrableDomain, staticFlags } from '../supabase/functions/_shared/url-checks.ts';

// Phrases a fake page uses to pose as each brand. Matched case-sensitively as whole words,
// and deliberately specific ("Apple ID", not "Apple") to avoid flagging recipe blogs and sign-ups.
const PHRASES: Record<string, string[]> = {
  usps: ['USPS', 'U.S. Postal Service'], ups: ['UPS My Choice'], fedex: ['FedEx'], dhl: ['DHL Express'],
  amazon: ['Amazon'], apple: ['Apple ID', 'Apple Account'], icloud: ['iCloud'], paypal: ['PayPal'],
  venmo: ['Venmo'], zelle: ['Zelle'], cashapp: ['Cash App'], netflix: ['Netflix'],
  microsoft: ['Microsoft account', 'Outlook', 'Office 365'], chase: ['Chase Online', 'Chase Bank', 'JPMorgan Chase'],
  wellsfargo: ['Wells Fargo'], bankofamerica: ['Bank of America'], coinbase: ['Coinbase'],
  irs: ['IRS', 'Internal Revenue Service'], ezpass: ['E-ZPass', 'EZPass'], google: ['Google Account', 'Gmail'],
  facebook: ['Facebook'], instagram: ['Instagram'], meta: ['Meta Business'],
};

const DISMISS_KEY = 'lens-dismissed';

function pageText(): string {
  const og = document.querySelector('meta[property="og:site_name"]')?.getAttribute('content') ?? '';
  const h1 = document.querySelector('h1')?.textContent ?? '';
  const logoAlt = Array.from(document.querySelectorAll('img[alt]')).slice(0, 5).map((i) => i.getAttribute('alt')).join(' ');
  return `${document.title} ${og} ${h1} ${logoAlt}`;
}

function asksForSecrets(): boolean {
  return !!document.querySelector(
    'input[type="password"], input[autocomplete^="cc-"], input[name*="card" i], input[id*="card" i], input[name*="cvv" i], input[name*="ssn" i]'
  );
}

function impersonatedBrand(host: string): string | null {
  const reg = registrableDomain(host);
  const text = pageText();
  if (Object.values(BRANDS).some((official) => official.includes(reg))) return null; // on a real brand site
  for (const phrases of Object.values(PHRASES)) {
    for (const phrase of phrases) {
      const re = new RegExp(`(^|[^A-Za-z])${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^A-Za-z]|$)`);
      if (re.test(text)) return phrases[0] === 'Apple ID' ? 'Apple' : phrases[0];
    }
  }
  return null;
}

function reasonsFor(url: URL): string[] {
  const reasons = staticFlags(url).filter(isSevere);
  if (asksForSecrets()) {
    const brand = impersonatedBrand(url.hostname);
    if (brand) reasons.push(`This page looks like ${brand} and asks for your details, but it isn’t ${brand}’s real website.`);
  }
  return reasons;
}

let shown = false;

function showBanner(reasons: string[]) {
  shown = true;
  const host = document.createElement('div');
  host.style.cssText = 'all:initial;position:fixed;inset:0 0 auto 0;z-index:2147483647;';
  const root = host.attachShadow({ mode: 'closed' });
  root.innerHTML = `
    <style>
      .b{font:16px/1.4 -apple-system,system-ui,sans-serif;background:#1a0707;color:#fff;border-bottom:3px solid #FF5A5F;
         padding:16px 18px calc(16px + env(safe-area-inset-top));box-shadow:0 8px 30px #000a}
      .t{font-weight:800;font-size:19px;color:#FF5A5F;margin:0 0 6px}
      ul{margin:6px 0 12px;padding-left:20px} li{margin:4px 0}
      .row{display:flex;gap:10px} button{flex:1;font:600 16px -apple-system,system-ui;border:0;border-radius:12px;padding:12px}
      .leave{background:#2BF5A4;color:#04140C} .stay{background:#2a2e2a;color:#ddd}
      .s{opacity:.75;font-size:13px;margin-top:8px}
    </style>
    <div class="b" role="alert">
      <p class="t">⚠︎ Wary: this may be a scam website</p>
      <ul>${reasons.map((r) => `<li>${r.replace(/[<>&]/g, '')}</li>`).join('')}</ul>
      <div class="row"><button class="leave">Get me out of here</button><button class="stay">I trust this site</button></div>
      <div class="s">Don’t enter passwords, card numbers or codes here. If you need the real company, type its address yourself.</div>
    </div>`;
  root.querySelector('.leave')!.addEventListener('click', () => {
    if (history.length > 1) history.back();
    else location.href = 'about:blank';
  });
  root.querySelector('.stay')!.addEventListener('click', () => {
    try {
      sessionStorage.setItem(DISMISS_KEY, '1');
    } catch {}
    host.remove();
  });
  document.documentElement.appendChild(host);
}

function run() {
  try {
    if (sessionStorage.getItem(DISMISS_KEY)) return;
  } catch {}
  let url: URL;
  try {
    url = new URL(location.href);
  } catch {
    return;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
  const reasons = reasonsFor(url);
  if (reasons.length) showBanner(reasons);
}

// Tell the Wary app the extension is switched on (lets its setup screen tick this off
// automatically). Sends nothing about the page — just "I'm running".
try {
  if (!sessionStorage.getItem('wary-ping')) {
    sessionStorage.setItem('wary-ping', '1');
    const rt = ((globalThis as any).browser ?? (globalThis as any).chrome)?.runtime;
    rt?.sendMessage({ type: 'wary-ping' })?.catch?.(() => {});
  }
} catch {}

run();
// Phishing kits often render the login form after load — check once more shortly after.
setTimeout(() => {
  if (!shown) run();
}, 2500);
