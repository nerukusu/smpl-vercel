create table if not exists public.smpl_kv (
  key text primary key,
  value jsonb not null,
  expires_at timestamptz null
);

create index if not exists smpl_kv_expires_at_idx
  on public.smpl_kv (expires_at)
  where expires_at is not null;

create table if not exists public.smpl_jobs (
  id text primary key,
  device_id text not null,
  request jsonb not null,
  response jsonb null,
  status text not null default 'pending' check (status in ('pending', 'running', 'done')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists smpl_jobs_poll_idx
  on public.smpl_jobs (device_id, status, created_at);

create index if not exists smpl_jobs_expires_at_idx
  on public.smpl_jobs (expires_at);

alter table public.smpl_kv enable row level security;
alter table public.smpl_jobs enable row level security;

revoke all on table public.smpl_kv from anon, authenticated;
revoke all on table public.smpl_jobs from anon, authenticated;
