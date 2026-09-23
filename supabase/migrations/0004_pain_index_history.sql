-- ДОПОЛНЕНИЕ 2: ежедневные снимки «индекса боли» микрорайонов для графика динамики
create table public.pain_index_history (
  id          bigserial primary key,
  district_id integer not null references public.districts(id),
  value       double precision,            -- null = недостаточно данных
  breakdown   jsonb,
  computed_at date not null,
  unique (district_id, computed_at)
);
create index on public.pain_index_history (computed_at);

alter table public.pain_index_history enable row level security;
create policy "public read" on public.pain_index_history for select using (true);
-- Пишет только сервер (service role) — ежедневный cron /api/cron/pain-snapshot
