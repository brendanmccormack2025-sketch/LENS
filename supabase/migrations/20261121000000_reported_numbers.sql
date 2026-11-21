-- Phone numbers people reported to the FTC (Do Not Call / robocall complaints).
-- Public-domain data, aggregated per number. Only the service role touches these tables.

create table if not exists public.reported_numbers (
  e164 bigint primary key,                 -- e.g. 18005551234
  reports int not null default 0,
  robocall_reports int not null default 0,
  silent_reports int not null default 0,   -- subject "Dropped call or no message"
  impostor_reports int not null default 0, -- subject mentions impostor / government / bank
  first_reported date,
  last_reported date
);
create index if not exists reported_numbers_recent on public.reported_numbers (last_reported);

create table if not exists public.ftc_ingest_log (
  day date primary key,
  records int not null,
  ingested_at timestamptz not null default now()
);

alter table public.reported_numbers enable row level security;
alter table public.ftc_ingest_log enable row level security;

-- Adds one day's aggregated complaints. rows: [{n, c, r, s, i, d}]
create or replace function public.ingest_reports(rows jsonb, p_day date, p_records int)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into reported_numbers as t (e164, reports, robocall_reports, silent_reports, impostor_reports, first_reported, last_reported)
  select (x->>'n')::bigint, (x->>'c')::int, (x->>'r')::int, (x->>'s')::int, (x->>'i')::int, p_day, p_day
  from jsonb_array_elements(rows) x
  on conflict (e164) do update set
    reports = t.reports + excluded.reports,
    robocall_reports = t.robocall_reports + excluded.robocall_reports,
    silent_reports = t.silent_reports + excluded.silent_reports,
    impostor_reports = t.impostor_reports + excluded.impostor_reports,
    first_reported = least(t.first_reported, excluded.first_reported),
    last_reported = greatest(t.last_reported, excluded.last_reported);

  insert into ftc_ingest_log (day, records) values (p_day, p_records)
  on conflict (day) do update set records = excluded.records, ingested_at = now();
end;
$$;

-- The list the Call Directory extension loads, as base64 of fixed 9-byte records:
-- [8-byte big-endian E.164][1-byte label index], ascending by number.
-- Label index (must match CallDirectoryHandler.swift):
--   0 = reported spam caller, 1 = robocall / silent call, 2 = impostor scam
-- A number needs at least p_min_reports reports within p_days to be listed —
-- single complaints are too noisy to put a warning on someone's phone screen.
create or replace function public.call_list(p_min_reports int default 2, p_days int default 90)
returns table (blob text, entries int)
language sql
security definer
set search_path = public
stable
as $$
  with picked as (
    select e164,
      case
        when impostor_reports * 2 >= reports then 2
        when silent_reports + robocall_reports >= reports then 1
        else 0
      end as label
    from reported_numbers
    where last_reported >= current_date - p_days
      and reports >= p_min_reports
      and e164 between 12000000000 and 19999999999   -- valid North American numbers only
    order by e164
  )
  select
    coalesce(encode(string_agg(int8send(e164) || decode(lpad(to_hex(label), 2, '0'), 'hex'), ''::bytea order by e164), 'base64'), ''),
    count(*)::int
  from picked;
$$;

-- Lookup used by the "Is this number real?" check (next feature) and the app.
create or replace function public.number_reports(p_e164 bigint)
returns setof reported_numbers
language sql
security definer
set search_path = public
stable
as $$ select * from reported_numbers where e164 = p_e164; $$;

revoke all on function public.ingest_reports(jsonb, date, int) from public, anon, authenticated;
revoke all on function public.call_list(int, int) from public, anon, authenticated;
revoke all on function public.number_reports(bigint) from public, anon, authenticated;
grant execute on function public.ingest_reports(jsonb, date, int) to service_role;
grant execute on function public.call_list(int, int) to service_role;
grant execute on function public.number_reports(bigint) to service_role;
