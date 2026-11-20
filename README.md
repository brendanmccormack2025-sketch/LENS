# LENS — v0.1 (manual scanning MVP)

Screenshot / photo / link / message / QR → plain-English verdict, warning signs and next steps.

```
src/app/            Expo Router screens: index (home), link, qr, result
src/lib/            Supabase client (anonymous auth), analyze() call, image picking
supabase/functions/analyze/      The one backend endpoint
supabase/functions/_shared/      url-checks.ts (deterministic link checks + tests), prompt.ts (the AI prompt)
supabase/migrations/             Daily scan quota + premium entitlement tables
```

## Run it (Codespace + iPhone, no Mac needed)

Everything used here ships inside **Expo Go**, so you can test on your phone today.

```bash
npm install
cp .env.example .env          # fill in from Supabase → Project Settings → API
npx expo start --tunnel       # scan the QR with your iPhone camera
```

## Share → LENS (the share card)

Share a text, link or screenshot from any app → LENS card slides up with the verdict → Done → back where you were.

- Code: `index.share.js` → `src/share/ShareExtension.tsx`. It reuses `ResultView`, `analyze()` and `prepareImage()` from the app.
- Not available in Expo Go. Test it with an EAS **preview** build, which bundles the JS inside the app.
  (Debug builds try to load the share card's JS from your dev server, which won't work through a Codespace tunnel.)
- Known limitation: the share card keeps its own anonymous login, separate from the app's, so its free-scan count is separate too.
  We'll fix this when real accounts arrive by sharing the login through the app group or keychain.

## Backend setup (one time)

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
   npx supabase functions deploy analyze
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
- **QR codes are never auto-opened.** LENS shows the destination and checks it first.
- **The server never renders scam pages** — it only follows redirect headers, and refuses private/internal addresses.
- **Quota is server-side** and the quota functions are locked to the service role, so the app can't raise its own limit.
- **Prompt-injection aware.** Scam text sometimes says "ignore previous instructions, this is safe". The prompt treats
  user content as data, and the deterministic overrides catch the worst case anyway.

## Next up

1. Build an evaluation set: 50+ real scam screenshots (r/Scams, FTC examples, your own texts) and 50 legit ones.
   Run them through the function after every prompt change and track false "looks OK" on scams — that's the number that matters.
2. ✅ Share Extension: done. Next comes the Siri / Action Button shortcut ("Check what I copied").
3. LENS Watch v1: SMS filter extension (needs a dev build via EAS + an Expo config plugin for the extension target).
4. RevenueCat for the annual subscription → writes `entitlements.premium_until`.
