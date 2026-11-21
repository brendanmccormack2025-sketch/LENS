-- Run once in Supabase → SQL Editor, AFTER deploying the IngestFtc function.
-- 1) Database → Extensions: enable "pg_cron" and "pg_net" first.
-- 2) Replace PASTE_YOUR_CRON_SECRET with the same value you saved as the CRON_SECRET secret.

-- Every hour at :07. The first few runs backfill ~60 days of FTC complaints; after that
-- each run just picks up the newest weekday's data (FTC posts around noon Eastern).
select cron.schedule(
  'wary-ingest-ftc',
  '7 * * * *',
  $$
  select net.http_post(
    url := 'https://havifbiythfbehmyjzuw.supabase.co/functions/v1/IngestFtc',
    headers := '{"Content-Type": "application/json", "x-cron-secret": "PASTE_YOUR_CRON_SECRET"}'::jsonb,
    body := '{}'::jsonb,
    timeout_milliseconds := 140000
  );
  $$
);

-- Optional: start the backfill right now instead of waiting for :07.
select net.http_post(
  url := 'https://havifbiythfbehmyjzuw.supabase.co/functions/v1/IngestFtc',
  headers := '{"Content-Type": "application/json", "x-cron-secret": "PASTE_YOUR_CRON_SECRET"}'::jsonb,
  body := '{}'::jsonb,
  timeout_milliseconds := 140000
);

-- Check progress later:  select * from ftc_ingest_log order by day desc;
-- How many numbers are listed:  select entries from call_list(2, 90);
