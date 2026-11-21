// Wary: the scam-caller list the app hands to iOS Caller ID.
// Returns { blob: base64 of 9-byte records, entries, version }. See call_list() in the migration.
// Requires a signed-in (anonymous is fine) Wary user. Self-contained: paste as-is into the dashboard.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

// The list only changes when new FTC data arrives, so cache it in memory per instance.
let cache: { at: number; body: unknown } | null = null;
const CACHE_MS = 30 * 60 * 1000;

Deno.serve(async (req) => {
  const jwt = req.headers.get('authorization')?.replace(/^Bearer /i, '');
  const { data } = await admin.auth.getUser(jwt);
  if (!data?.user) return json({ error: 'Please restart the app and try again.' }, 401);

  if (cache && Date.now() - cache.at < CACHE_MS) return json(cache.body);

  const { data: rows, error } = await admin.rpc('call_list', { p_min_reports: 2, p_days: 90 });
  if (error) return json({ error: 'Could not load the caller list.' }, 500);
  const row = Array.isArray(rows) ? rows[0] : rows;
  const { data: last } = await admin.from('ftc_ingest_log').select('day').order('day', { ascending: false }).limit(1);

  const body = {
    blob: (row?.blob ?? '').replace(/\s/g, ''),
    entries: row?.entries ?? 0,
    version: last?.[0]?.day ?? null,
  };
  cache = { at: Date.now(), body };
  return json(body);
});
