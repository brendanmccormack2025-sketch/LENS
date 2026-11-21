// Wary: imports the FTC's daily Do Not Call / robocall complaint data.
// Run hourly by Supabase Cron. Each run fills in up to MAX_DAYS_PER_RUN missing days
// (newest first) within the last LOOKBACK_DAYS, so the first runs backfill and later
// runs just pick up each new weekday's data. Self-contained: paste as-is into the dashboard.
//
// Secrets: FTC_API_KEY (free from api.data.gov/signup), CRON_SECRET (any long random string).
// Function setting: turn OFF "Verify JWT" — this function checks CRON_SECRET instead.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const FTC = 'https://api.ftc.gov/v0/dnc-complaints';
const API_KEY = Deno.env.get('FTC_API_KEY') ?? 'DEMO_KEY';
const LOOKBACK_DAYS = 60;
const MAX_DAYS_PER_RUN = 6; // ~110 requests/day of data; api.data.gov allows 1,000/hour
const PAGE = 50; // FTC maximum

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

type Agg = { c: number; r: number; s: number; i: number };

const isoDay = (d: Date) => d.toISOString().slice(0, 10);

function toE164(raw: unknown): number | null {
  const digits = String(raw ?? '').replace(/\D/g, '');
  const ten = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  if (ten.length !== 10 || ten[0] === '0' || ten[0] === '1') return null;
  return Number('1' + ten);
}

async function fetchPage(day: string, offset: number): Promise<{ rows: any[]; total: number }> {
  const qs = new URLSearchParams({
    api_key: API_KEY,
    created_date: `"${day}"`,
    items_per_page: String(PAGE),
    offset: String(offset),
    sort_order: 'ASC',
  });
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(`${FTC}?${qs}`, { signal: AbortSignal.timeout(20_000) });
    if (res.status === 429) throw new Error('rate limited');
    if (res.ok) {
      const body = await res.json();
      return { rows: body?.data ?? [], total: Number(body?.meta?.['record-total'] ?? 0) };
    }
    await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
  }
  throw new Error(`FTC request failed for ${day} offset ${offset}`);
}

async function ingestDay(day: string): Promise<number> {
  const first = await fetchPage(day, 0);
  const total = first.total;
  const all = [...first.rows];
  const offsets: number[] = [];
  for (let o = PAGE; o < total; o += PAGE) offsets.push(o);

  // A few pages at a time to stay polite to the FTC API.
  for (let i = 0; i < offsets.length; i += 5) {
    const pages = await Promise.all(offsets.slice(i, i + 5).map((o) => fetchPage(day, o)));
    for (const p of pages) all.push(...p.rows);
  }

  const agg = new Map<number, Agg>();
  for (const rec of all) {
    const a = rec?.attributes ?? {};
    const n = toE164(a['company-phone-number']);
    if (!n) continue;
    const subject = String(a['subject'] ?? '').toLowerCase();
    const cur = agg.get(n) ?? { c: 0, r: 0, s: 0, i: 0 };
    cur.c += 1;
    if (String(a['recorded-message-or-robocall'] ?? '').toUpperCase().startsWith('Y')) cur.r += 1;
    if (subject.includes('dropped call') || subject.includes('no message')) cur.s += 1;
    if (/impost|government|bank|social security|irs|police/.test(subject)) cur.i += 1;
    agg.set(n, cur);
  }

  // FTC posts each weekday around noon Eastern (Monday includes the weekend). An empty
  // recent day usually means "not published yet", so leave it unmarked and retry later.
  const recent = day >= isoDay(new Date(Date.now() - 4 * 864e5));
  if (all.length === 0 && recent) return 0;

  // One call per day: the upsert and the "day done" mark commit together, so a failed
  // run can be retried without double-counting.
  const rows = [...agg.entries()].map(([n, v]) => ({ n, ...v }));
  const { error } = await admin.rpc('ingest_reports', { rows, p_day: day, p_records: all.length });
  if (error) throw new Error(error.message);
  return all.length;
}

Deno.serve(async (req) => {
  // Read per request (not at boot) so a changed secret takes effect immediately,
  // and say which check failed — "forbidden" alone is impossible to debug.
  const expected = (Deno.env.get('CRON_SECRET') ?? '').trim();
  const got = (req.headers.get('x-cron-secret') ?? '').trim();
  if (!expected) return new Response('CRON_SECRET is not set in Edge Function secrets', { status: 403 });
  if (!got) return new Response('missing x-cron-secret header', { status: 403 });
  if (got !== expected) {
    const hint = (v: string) => `${v.length} chars, starts ${v.slice(0, 4)}, ends ${v.slice(-4)}`;
    return new Response(`secret mismatch — sent (${hint(got)}) vs saved (${hint(expected)})`, { status: 403 });
  }

  const { data: done } = await admin
    .from('ftc_ingest_log')
    .select('day, records')
    .gte('day', isoDay(new Date(Date.now() - LOOKBACK_DAYS * 864e5)));
  const finished = new Set((done ?? []).map((d) => d.day));

  // FTC publishes each weekday around noon Eastern; skip today, check the last N days.
  const todo: string[] = [];
  for (let k = 1; k <= LOOKBACK_DAYS && todo.length < MAX_DAYS_PER_RUN; k++) {
    const day = isoDay(new Date(Date.now() - k * 864e5));
    if (!finished.has(day)) todo.push(day);
  }

  const results: Record<string, number | string> = {};
  for (const day of todo) {
    try {
      results[day] = await ingestDay(day);
    } catch (e) {
      results[day] = (e as Error).message;
      if ((e as Error).message === 'rate limited') break;
    }
  }
  return new Response(JSON.stringify({ ingested: results }), { headers: { 'content-type': 'application/json' } });
});
