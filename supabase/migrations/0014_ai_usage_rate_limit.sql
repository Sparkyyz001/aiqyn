-- Ограничение частоты обращений к ИИ (голос, разбор фото): бережём бесплатную квоту Gemini.
-- Политик нет: таблицу читает и пишет только сервер (service role).
create table public.ai_usage (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  created_at timestamptz not null default now()
);
create index ai_usage_user_kind_time on public.ai_usage (user_id, kind, created_at desc);
alter table public.ai_usage enable row level security;
comment on table public.ai_usage is 'Учёт обращений к ИИ для ограничения частоты (пишет и читает только сервер)';
