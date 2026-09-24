-- Отзывы о состоянии участков дорог: жители и акимат подтверждают или опровергают прогноз на месте
create table public.road_feedback (
  id          bigserial primary key,
  osm_id      text not null,
  user_id     uuid not null references auth.users(id) on delete cascade,
  verdict     text not null check (verdict in ('potholes', 'cracks', 'ok', 'repaired')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index road_feedback_once on public.road_feedback (osm_id, user_id);
create index road_feedback_user on public.road_feedback (user_id);
alter table public.road_feedback enable row level security;
create policy road_feedback_read on public.road_feedback for select to anon, authenticated using (true);
