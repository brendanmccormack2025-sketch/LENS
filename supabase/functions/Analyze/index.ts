// LENS analyze endpoint (Supabase Edge Function, Deno).
// Flow: auth → daily quota → deterministic link checks → one Claude call → merge → respond.
// Privacy: request content is never written to the database or logs.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { checkLink, extractUrls, isSevere, type LinkCheck } from '../_shared/url-checks.ts';
import { REPORT_TOOL, SYSTEM_PROMPT } from '../_shared/prompt.ts';

const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY')!;
const MODEL = Deno.env.get('ANTHROPIC_MODEL') ?? 'claude-haiku-5-5';
const WEB_RISK_KEY = Deno.env.get('WEB_RISK_API_KEY'); // optional
const FREE_DAILY = Number(Deno.env.get('FREE_DAILY_SCANS') ?? 5);
const PREMIUM_DAILY = Number(Deno.env.get('PREMIUM_DAILY_SCANS') ?? 60);
const MAX_IMAGE_B64 = 4_000_000; // ~3 MB image

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

type Req =
  | { kind: 'image'; imageBase64: string; mediaType: 'image/jpeg' | 'image/png' }
  | { kind: 'url'; url: string; source: 'qr' | 'paste' | 'share' }
  | { kind: 'text'; text: string };

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json({ error: 'POST only' }, 405);

  // 1. Who is this? (anonymous users count — every install gets one)
  const jwt = request.headers.get('authorization')?.replace(/^Bearer /i, '');
  const { data: userData } = await admin.auth.getUser(jwt);
  const user = userData?.user;
  if (!user) return json({ error: 'Please restart the app and try again.' }, 401);

  // 2. Validate input
  let body: Req;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Bad request' }, 400);
  }
  if (body.kind === 'image' && (!body.imageBase64 || body.imageBase64.length > MAX_IMAGE_B64))
    return json({ error: 'That image is too large. Try a screenshot instead of a full photo.' }, 413);
  if (body.kind === 'text' && !body.text?.trim()) return json({ error: 'Nothing to check' }, 400);
  if (body.kind === 'url' && !body.url?.trim()) return json({ error: 'Nothing to check' }, 400);
  if (!['image', 'text', 'url'].includes(body.kind)) return json({ error: 'Bad request' }, 400);

  // 3. Quota (atomic, server-side; the client can't change its own limit)
  const { data: remaining, error: quotaErr } = await admin.rpc('consume_scan', {
    p_user: user.id,
    p_free_limit: FREE_DAILY,
    p_premium_limit: PREMIUM_DAILY,
  });
  if (quotaErr) return json({ error: 'Something went wrong. Please try again.' }, 500);
  if (remaining < 0)
    return json({ error: `Free accounts can check ${FREE_DAILY} things a day. Your scans reset tomorrow.` }, 429);

  // 4. Deterministic link checks for anything we can see up front
  const fetchImpl = (u: string, init: RequestInit) => fetch(u, init);
  const upfrontUrls = body.kind === 'url' ? [body.url] : body.kind === 'text' ? extractUrls(body.text) : [];
  const linkChecks = (await Promise.all(upfrontUrls.map((u) => checkLink(u, { webRiskKey: WEB_RISK_KEY, fetchImpl }))))
    .filter((c): c is LinkCheck => c !== null);

  // 5. Ask the model
  let report: Record<string, unknown>;
  try {
    report = await callClaude(body, linkChecks);
  } catch (e) {
    console.error('model_error', (e as Error).message); // message only, never content
    await admin.rpc('refund_scan', { p_user: user.id });
    return json({ error: 'LENS couldn’t finish checking this. Your scan wasn’t counted — please try again.' }, 502);
  }

  // 6. For screenshots, check the links the model read off the image
  if (body.kind === 'image') {
    const seen = (report.urls_seen as string[] | undefined)?.slice(0, 3) ?? [];
    const more = await Promise.all(seen.map((u) => checkLink(u, { webRiskKey: WEB_RISK_KEY, fetchImpl })));
    linkChecks.push(...more.filter((c): c is LinkCheck => c !== null));
  }

  return json({ analysis: finalize(report, linkChecks), scansRemainingToday: remaining });
});

async function callClaude(req: Req, linkChecks: LinkCheck[]) {
  const content: unknown[] = [];
  if (req.kind === 'image') {
    content.push({ type: 'image', source: { type: 'base64', media_type: req.mediaType, data: req.imageBase64 } });
    content.push({ type: 'text', text: 'The user shared this image and wants to understand it. Analyze it.' });
  } else {
    const from = { qr: 'a QR code', paste: 'something they pasted', share: 'another app (shared to LENS)' };
    const label = req.kind === 'url' ? `A web address the user got from ${from[req.source] ?? 'somewhere'}` : 'A message the user received';
    content.push({
      type: 'text',
      text: `${label}:\n<user_content>\n${req.kind === 'url' ? req.url : req.text}\n</user_content>`,
    });
  }
  if (linkChecks.length) {
    content.push({ type: 'text', text: `LINK_CHECKS (automated, trustworthy):\n${JSON.stringify(linkChecks, null, 1)}` });
  }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1200,
      system: SYSTEM_PROMPT,
      tools: [REPORT_TOOL],
      tool_choice: { type: 'tool', name: REPORT_TOOL.name },
      messages: [{ role: 'user', content }],
    }),
    signal: AbortSignal.timeout(45_000),
  });
  if (!res.ok) throw new Error(`anthropic ${res.status}`);
  const data = await res.json();
  const block = data.content?.find((b: { type: string }) => b.type === 'tool_use');
  if (!block?.input) throw new Error('no tool output');
  return block.input as Record<string, unknown>;
}

const OVERCLAIM = /known threat|no threats|checked against|safe ?browsing|web risk|not (on|in) (any|a|google)/i;

const str = (v: unknown, fallback = '') => (typeof v === 'string' ? v.slice(0, 600) : fallback);
const strArr = (v: unknown, n: number) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string').slice(0, n).map((x) => x.slice(0, 300)) : []);

/** Sanitize model output and let hard evidence override the model where needed. */
function finalize(r: Record<string, unknown>, linkChecks: LinkCheck[]) {
  const verdicts = ['likely_safe', 'be_careful', 'likely_scam', 'unclear'];
  let verdict = verdicts.includes(r.verdict as string) ? (r.verdict as string) : 'unclear';
  let confidence = ['low', 'medium', 'high'].includes(r.confidence as string) ? (r.confidence as string) : 'low';
  const red_flags = (Array.isArray(r.red_flags) ? r.red_flags : [])
    .filter((f): f is { signal: string; why: string } => typeof f?.signal === 'string' && typeof f?.why === 'string')
    .slice(0, 5)
    .map((f) => ({ signal: f.signal.slice(0, 80), why: f.why.slice(0, 300) }));

  const threat = linkChecks.find((c) => c.knownThreat?.length);
  // Never let the model claim a reputation check that didn't happen.
  const reputationChecked = linkChecks.length > 0 && linkChecks.every((c) => c.reputationChecked);
  if (threat) {
    verdict = 'likely_scam';
    confidence = 'high';
    red_flags.unshift({
      signal: 'Known dangerous website',
      why: `${threat.hostname} is on Google’s list of unsafe websites (phishing or malware). Don’t open it.`,
    });
  } else if (verdict === 'likely_safe' && linkChecks.some((c) => c.flags.some(isSevere))) {
    verdict = 'be_careful';
    confidence = 'medium';
  }

  return {
    verdict,
    confidence,
    headline: str(r.headline, 'Here’s what LENS found'),
    what_it_is: str(r.what_it_is),
    red_flags: red_flags.slice(0, 5),
    reassuring_signs: threat ? [] : strArr(r.reassuring_signs, 4).filter((x) => reputationChecked || !OVERCLAIM.test(x)),
    next_steps: strArr(r.next_steps, 4),
    cannot_verify: str(r.cannot_verify, 'LENS can only judge what is shown here.'),
    link_checks: linkChecks,
  };
}
