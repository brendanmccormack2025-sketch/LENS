// Deterministic link checks. These run before/after the AI call and are the
// part of LENS that doesn't depend on a model's judgement. Pure TS: runs in
// Deno (edge function) and in Node (tests) without changes.

export interface LinkCheck {
  input: string;
  finalUrl: string;
  hostname: string;
  redirects: number;
  flags: string[];
  knownThreat: string[] | null;
  /** True only if a reputation database (Google Web Risk) was actually consulted. */
  reputationChecked: boolean;
}

const SHORTENERS = new Set([
  'bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'ow.ly', 'is.gd', 'buff.ly', 'rebrand.ly',
  'cutt.ly', 'shorturl.at', 'rb.gy', 'tiny.cc', 'lnkd.in', 's.id', 'v.gd', 'qrco.de',
]);

// TLDs heavily over-represented in smishing/phishing. A signal, not a verdict.
const RISKY_TLDS = new Set([
  'top', 'xyz', 'icu', 'click', 'cfd', 'sbs', 'buzz', 'rest', 'zip', 'mov', 'cyou',
  'shop', 'online', 'site', 'live', 'vip', 'win', 'bond', 'info', 'today', 'lol',
]);

// Brands scammers impersonate most, mapped to domains they actually use.
export const BRANDS: Record<string, string[]> = {
  usps: ['usps.com'], ups: ['ups.com'], fedex: ['fedex.com'], dhl: ['dhl.com'],
  amazon: ['amazon.com', 'amazon.co.uk', 'amazon.ca', 'amzn.to', 'a.co', 'amzn.com'], apple: ['apple.com', 'apple.co'], icloud: ['icloud.com', 'apple.com'],
  paypal: ['paypal.com'], venmo: ['venmo.com'], zelle: ['zellepay.com'], cashapp: ['cash.app'],
  netflix: ['netflix.com'], microsoft: ['microsoft.com', 'live.com', 'office.com'],
  chase: ['chase.com'], wellsfargo: ['wellsfargo.com'], bankofamerica: ['bankofamerica.com'],
  coinbase: ['coinbase.com'], irs: ['irs.gov'], ezpass: ['e-zpassny.com', 'ezpassnj.com', 'e-zpassiag.com'],
  google: ['google.com', 'googleusercontent.com', 'googleapis.com'], facebook: ['facebook.com'], instagram: ['instagram.com'], meta: ['meta.com'],
};

const OFFICIAL = new Set(Object.values(BRANDS).flat());

const TWO_PART_SUFFIXES = new Set(['co.uk', 'com.au', 'co.nz', 'co.jp', 'com.br', 'co.in', 'org.uk']);

export function registrableDomain(host: string): string {
  const parts = host.toLowerCase().split('.');
  const lastTwo = parts.slice(-2).join('.');
  return TWO_PART_SUFFIXES.has(lastTwo) ? parts.slice(-3).join('.') : lastTwo;
}

export function normalizeUrl(input: string): URL | null {
  let s = input.trim();
  if (!/^[a-z][a-z0-9+.-]*:/i.test(s)) s = `https://${s}`;
  try {
    const u = new URL(s);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    if (!u.hostname.includes('.') && !isIp(u.hostname)) return null;
    return u;
  } catch {
    return null;
  }
}

/** Catches unknown shorteners: a tiny domain + one random-looking path token (e.g. n0w.us/-9NBVC). */
export function looksShortened(u: URL): boolean {
  const name = registrableDomain(u.hostname).split('.')[0];
  const segs = u.pathname.split('/').filter(Boolean);
  if (OFFICIAL.has(registrableDomain(u.hostname))) return false; // ups.com/Track etc.
  const t = segs[0] ?? '';
  const randomLooking = /\d/.test(t) || (/[A-Z]/.test(t.slice(1)) && /[a-z]/.test(t)) || /^[-_]/.test(t);
  return name.length <= 4 && segs.length === 1 && /^[A-Za-z0-9_-]{4,12}$/.test(t) && randomLooking && !u.search;
}

const isIp = (h: string) => /^\d{1,3}(\.\d{1,3}){3}$/.test(h) || h.startsWith('[');

/** Blocks SSRF: never let the server fetch internal or local addresses. */
export function isPrivateHost(h: string): boolean {
  const host = h.toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal') || host.endsWith('.local')) return true;
  if (host.startsWith('[')) return true; // no IPv6 literals at all
  const m = host.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
}

export function staticFlags(u: URL): string[] {
  const flags: string[] = [];
  const host = u.hostname.toLowerCase();
  const reg = registrableDomain(host);
  const tld = host.split('.').pop() ?? '';

  if (u.protocol === 'http:') flags.push('Not encrypted (http, not https)');
  if (isIp(host)) flags.push('Uses a raw IP address instead of a website name');
  if (host.includes('xn--')) flags.push('Uses look-alike international characters in the address');
  if (SHORTENERS.has(host) || looksShortened(u)) flags.push('Shortened link hides the real destination');
  if (RISKY_TLDS.has(tld)) flags.push(`Ends in “.${tld}”, an ending often used by scam sites`);
  if (u.username || u.href.includes('@')) flags.push('Contains “@”, which can disguise the real destination');
  if (host.split('.').length > 4) flags.push('Unusually long chain of subdomains');
  if ((host.match(/-/g) ?? []).length >= 3) flags.push('Many hyphens in the website name');

  // Short brand names (ups, irs, dhl, meta, chase…) must be a whole label/word,
  // otherwise "groups.io" or "purchase.com" would trip it. Longer names can match
  // inside a word, which catches "paypal-secure" and "amazonsupport".
  const tokens = host.split(/[.-]/);
  for (const [brand, official] of Object.entries(BRANDS)) {
    const mentions = tokens.some((t) => t === brand || (brand.length >= 6 && t.includes(brand)));
    if (mentions && !official.includes(reg)) {
      flags.push(`Mentions “${brand}” but isn’t ${brand}’s official website (${official[0]})`);
      break;
    }
  }
  return flags;
}

export function extractUrls(text: string, max = 3): string[] {
  const re = /\b((?:https?:\/\/)?(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s<>"')\]]*)?)/gi;
  const out = new Set<string>();
  for (const m of text.matchAll(re)) {
    const candidate = m[1].replace(/[.,;:!?]+$/, '');
    if (/^\d+(\.\d+)+$/.test(candidate)) continue; // version numbers, prices
    out.add(candidate);
    if (out.size >= max) break;
  }
  return [...out];
}

type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

/** Follows Location headers only. Never downloads or renders the page body. */
export async function followRedirects(start: URL, fetchImpl: FetchLike, maxHops = 5): Promise<{ final: URL; hops: number }> {
  let current = start;
  for (let hops = 0; hops < maxHops; hops++) {
    if (isPrivateHost(current.hostname)) return { final: current, hops };
    let res: Response;
    try {
      res = await fetchImpl(current.href, {
        method: 'GET',
        redirect: 'manual',
        signal: AbortSignal.timeout(4000),
        headers: { 'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) LENS-LinkCheck' },
      });
    } catch {
      return { final: current, hops };
    }
    await res.body?.cancel().catch(() => {});
    const loc = res.headers.get('location');
    if (res.status < 300 || res.status >= 400 || !loc) return { final: current, hops };
    try {
      current = new URL(loc, current);
    } catch {
      return { final: current, hops };
    }
    if (current.protocol !== 'http:' && current.protocol !== 'https:') return { final: current, hops: hops + 1 };
  }
  return { final: current, hops: maxHops };
}

/** Google Web Risk Lookup API (commercial-use successor to Safe Browsing). */
export async function webRiskLookup(url: string, apiKey: string | undefined, fetchImpl: FetchLike): Promise<string[] | null> {
  if (!apiKey) return null;
  const qs = new URLSearchParams({ uri: url, key: apiKey });
  for (const t of ['MALWARE', 'SOCIAL_ENGINEERING', 'UNWANTED_SOFTWARE']) qs.append('threatTypes', t);
  try {
    const res = await fetchImpl(`https://webrisk.googleapis.com/v1/uris:search?${qs}`, { method: 'GET', signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    const body = await res.json();
    return body?.threat?.threatTypes ?? null;
  } catch {
    return null;
  }
}

export async function checkLink(input: string, opts: { webRiskKey?: string; fetchImpl: FetchLike }): Promise<LinkCheck | null> {
  const start = normalizeUrl(input);
  if (!start) return null;
  const { final, hops } = await followRedirects(start, opts.fetchImpl);
  const flags = staticFlags(start);
  if (final.hostname !== start.hostname) {
    for (const f of staticFlags(final)) if (!flags.includes(f)) flags.push(f);
    if (registrableDomain(final.hostname) !== registrableDomain(start.hostname))
      flags.push(`Sends you to a different website (${final.hostname})`);
  }
  if (hops >= 3) flags.push(`Redirects ${hops} times before landing`);

  const [threatStart, threatFinal] = await Promise.all([
    webRiskLookup(start.href, opts.webRiskKey, opts.fetchImpl),
    final.href !== start.href ? webRiskLookup(final.href, opts.webRiskKey, opts.fetchImpl) : Promise.resolve(null),
  ]);
  const knownThreat = threatStart ?? threatFinal;

  return {
    input, finalUrl: final.href, hostname: start.hostname, redirects: hops, flags, knownThreat,
    reputationChecked: Boolean(opts.webRiskKey),
  };
}

/** Flags that should stop a "looks OK" verdict on their own. */
export const SEVERE = [/look-alike/, /raw IP/, /isn’t .* official website/, /“@”/];
export const isSevere = (flag: string) => SEVERE.some((re) => re.test(flag));
