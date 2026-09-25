-- Репутация жителей (ADDON_3): журнал начислений. Житель видит только свою историю.
create table public.reputation_events (
  id         bigserial primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  report_id  bigint references public.reports(id) on delete set null,
  delta      double precision not null,
  reason     text not null,
  meta       jsonb,
  created_at timestamptz not null default now()
);
create index reputation_events_user on public.reputation_events (user_id, created_at desc);
create index reputation_events_report on public.reputation_events (report_id);
alter table public.reputation_events enable row level security;
create policy reputation_events_read_own on public.reputation_events for select to authenticated using (user_id = (select auth.uid()));
