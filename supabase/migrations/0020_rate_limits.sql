-- Per-visitor rate limits for public forms (partner application, signup,
-- login, password reset, order tracking, checkout). Keys are
-- "<form>:<hash of the visitor's IP>", hashed in the app with a server
-- secret, so raw IP addresses are never stored.

create table if not exists rate_limit_hits (
  id         bigint generated always as identity primary key,
  key        text not null,
  created_at timestamptz not null default now()
);

create index if not exists rate_limit_hits_key_time_idx
  on rate_limit_hits (key, created_at desc);

-- No policies: only the service role (server code) touches this table.
alter table rate_limit_hits enable row level security;

-- Records a hit and returns true if the key is still within its limit.
-- Old rows for the key are cleaned up as it goes, so the table stays small.
create or replace function check_rate_limit(p_key text, p_limit int, p_window_seconds int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  recent int;
begin
  delete from rate_limit_hits
  where key = p_key and created_at < now() - make_interval(secs => p_window_seconds);

  select count(*) into recent from rate_limit_hits where key = p_key;
  if recent >= p_limit then
    return false;
  end if;

  insert into rate_limit_hits (key) values (p_key);
  return true;
end;
$$;

revoke all on function check_rate_limit(text, int, int) from public, anon, authenticated;
grant execute on function check_rate_limit(text, int, int) to service_role;
