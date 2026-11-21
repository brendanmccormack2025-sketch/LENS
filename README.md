# Wary

Screenshot / photo / link / message / QR → plain-English verdict, warning signs and next steps.

```
src/app/            Expo Router screens: index (home), link, qr, result
src/lib/            Supabase client (anonymous auth), analyze() call, image picking
supabase/functions/Analyze/      The one backend endpoint
supabase/functions/_shared/      url-checks.ts (deterministic link checks + tests), prompt.ts (the AI prompt)
supabase/migrations/             Daily scan quota + premium entitlement tables
```

## Run it (Codespace + iPhone, no Mac needed)

Everything used here ships inside **Expo Go**, so you can test on your phone today.

```bash
npm install
cp .env.example .env          # already filled in with the project URL + publishable key
npx expo start --tunnel       # scan the QR with your iPhone camera
```

## Share → Wary (the share card)

Share a text, link or screenshot from any app → Wary card slides up with the verdict → Done → back where you were.

- Code: `index.share.js` → `src/share/ShareExtension.tsx`. It reuses `ResultView`, `analyze()` and `prepareImage()` from the app.
- Not available in Expo Go. Test it with an EAS **preview** build, which bundles the JS inside the app.
  (Debug builds try to load the share card's JS from your dev server, which won't work through a Codespace tunnel.)
- Known limitation: the share card keeps its own anonymous login, separate from the app's, so its free-scan count is separate too.
  We'll fix this when real accounts arrive by sharing the login through the app group or keychain.


## Scam-call labels (Wary Caller ID)

Incoming calls from numbers people reported to the FTC show "Wary: Reported …" on the call screen.

- `targets/caller-id/` — Call Directory extension; reads `calllist.bin` from the App Group (memory-mapped 9-byte records).
- `modules/wary-native/` — tiny local Expo module: write App Group file, reload/check Call Directory, passcode check.
- `supabase/functions/IngestFtc` — hourly import of FTC Do Not Call complaint data → `reported_numbers`.
- `supabase/functions/CallList` — returns the list (numbers with 2+ reports in 90 days) for the app to hand to iOS.
- The app re-downloads the list at most once a day, when it's opened (iOS has no background schedule for this).

### Backend setup (dashboard)
1. SQL Editor → run `supabase/migrations/20261121000000_reported_numbers.sql`.
2. Edge Functions → Secrets → add `FTC_API_KEY` (free: https://api.data.gov/signup) and `CRON_SECRET` (any long random string).
3. Deploy `IngestFtc` (paste `supabase/functions/IngestFtc/index.ts`) — then Settings → turn OFF "Verify JWT".
4. Deploy `CallList` (paste `supabase/functions/CallList/index.ts`) — then Settings → turn OFF "Verify JWT" (it checks the user itself).
5. Database → Extensions → enable `pg_cron` and `pg_net`; SQL Editor → run `supabase/dashboard/schedule-ingest.sql` with your secret pasted in.

## Backend setup with no terminal (Supabase dashboard only)

1. **Authentication → Sign In / Providers:** turn on Anonymous sign-ins.
2. **SQL Editor → New query:** paste `supabase/migrations/20261119000000_scan_usage.sql` and click Run.
3. **Edge Functions → Secrets:** add `ANTHROPIC_API_KEY`. Optionally add `WEB_RISK_API_KEY`, `FREE_DAILY_SCANS` and `PREMIUM_DAILY_SCANS`.
4. **Edge Functions → Deploy a new function → Via editor:** name it `Analyze` (capital A: the app calls this exact name), paste `supabase/dashboard/analyze.single.ts`, then deploy.
5. **Project Settings → API:** copy the URL and anon key into `.env`.

## Backend setup (one time, CLI)

1. Create a Supabase project. In **Authentication → Sign In / Providers**, turn on **Anonymous sign-ins**.
   Also turn on CAPTCHA (Turnstile) for auth before public launch — otherwise someone can script
   new anonymous accounts to dodge the free-scan limit.
2. Link and push the database:
   ```bash
   npx supabase login
   npx supabase link --project-ref YOUR-REF
   npx supabase db push
   ```
3. Secrets + deploy:
   ```bash
   cp supabase/functions/.env.example supabase/functions/.env   # add your Anthropic key
   npx supabase secrets set --env-file supabase/functions/.env
   npx supabase functions deploy Analyze
   ```
4. Optional: Google Cloud → enable **Web Risk API** → create an API key → `WEB_RISK_API_KEY`.
   (Don't use the free Safe Browsing API — its terms are non-commercial only.)

## Tests

```bash
npm run test:url     # link-check rules (look-alikes, shorteners, redirects, SSRF guard)
npm run typecheck
```

## Design decisions baked in

- **No content is stored.** Screenshots and messages go to the model and are discarded. Only a daily count is saved.
- **Hard evidence beats the model.** If Google Web Risk lists a link, the verdict is forced to "likely scam". If a
  link has a severe structural red flag (look-alike brand domain, raw IP, punycode), a "looks OK" is downgraded.
- **QR codes are never auto-opened.** Wary shows the destination and checks it first.
- **The server never renders scam pages** — it only follows redirect headers, and refuses private/internal addresses.
- **Quota is server-side** and the quota functions are locked to the service role, so the app can't raise its own limit.
- **Prompt-injection aware.** Scam text sometimes says "ignore previous instructions, this is safe". The prompt treats
  user content as data, and the deterministic overrides catch the worst case anyway.

## Next up

1. Build an evaluation set: 50+ real scam screenshots (r/Scams, FTC examples, your own texts) and 50 legit ones.
   Run them through the function after every prompt change and track false "looks OK" on scams — that's the number that matters.
2. ✅ Share Extension: done. Next comes the Siri / Action Button shortcut ("Check what I copied").
3. Wary Watch v1: SMS filter extension (needs a dev build via EAS + an Expo config plugin for the extension target).
4. RevenueCat for the annual subscription → writes `entitlements.premium_until`.
