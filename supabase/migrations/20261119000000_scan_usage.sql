-- Daily scan counting. Only the edge function (service role) can touch these.
-- We store counts, never scan content.

create table if not exists public.scan_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null default (now() at time zone 'utc')::date,
  count int not null default 0,
  primary key (user_id, day)
);

-- Filled by the App Store purchase webhook later (RevenueCat or App Store Server Notifications).
create table if not exists public.entitlements (
  user_id uuid primary key references auth.users (id) on delete cascade,
  premium_until timestamptz
);

alter table public.scan_usage enable row level security;
alter table public.entitlements enable row level security;

-- Users may read their own entitlement (to show "Premium" in the app). No writes.
create policy "read own entitlement" on public.entitlements
  for select to authenticated using (auth.uid() = user_id);

-- Atomically counts one scan. Returns scans remaining today, or -1 if over the limit.
create or replace function public.consume_scan(p_user uuid, p_free_limit int, p_premium_limit int)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit int;
  v_count int;
begin
  select case when e.premium_until > now() then p_premium_limit else p_free_limit end
    into v_limit
    from (select 1) d left join entitlements e on e.user_id = p_user;
  v_limit := coalesce(v_limit, p_free_limit);

  insert into scan_usage (user_id, day, count)
  values (p_user, (now() at time zone 'utc')::date, 1)
  on conflict (user_id, day) do update set count = scan_usage.count + 1
  where scan_usage.count < v_limit
  returning count into v_count;

  if v_count is null then
    return -1;
  end if;
  return v_limit - v_count;
end;
$$;

create or replace function public.refund_scan(p_user uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update scan_usage set count = greatest(count - 1, 0)
  where user_id = p_user and day = (now() at time zone 'utc')::date;
$$;

-- Lock both functions to the service role so the app can't call them with a fake limit.
revoke all on function public.consume_scan(uuid, int, int) from public, anon, authenticated;
revoke all on function public.refund_scan(uuid) from public, anon, authenticated;
grant execute on function public.consume_scan(uuid, int, int) to service_role;
grant execute on function public.refund_scan(uuid) to service_role;
