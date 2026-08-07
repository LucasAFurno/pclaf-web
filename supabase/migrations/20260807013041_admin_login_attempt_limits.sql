-- Login attempt counters are only accessed by the privileged Edge Function.
-- The IP value is salted and hashed before it reaches this table.
create table if not exists public.admin_login_attempts (
  ip_hash text primary key,
  failed_attempts integer not null default 0 check (failed_attempts >= 0),
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.admin_login_attempts enable row level security;
revoke all on table public.admin_login_attempts from anon, authenticated;
