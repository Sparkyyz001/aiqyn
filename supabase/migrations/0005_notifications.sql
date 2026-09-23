-- Уведомления: житель получает ответ по своему обращению (принято, прогноз срока, ответ службы,
-- фото «после», переоткрытие), диспетчер/акимат/служба — о новых обращениях и рисках срыва.
-- Пишет только сервер (service role); пользователь видит и отмечает прочитанными только свои.
create table public.notifications (
  id          bigserial primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  report_id   bigint references public.reports(id) on delete cascade,
  kind        text not null,
  title       text not null,
  title_kz    text,
  body        text,
  body_kz     text,
  link        text,
  tone        text not null default 'info' check (tone in ('info', 'ok', 'warn', 'danger')),
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index notifications_user_created on public.notifications (user_id, created_at desc);
create index notifications_user_unread on public.notifications (user_id) where read_at is null;

alter table public.notifications enable row level security;
create policy notifications_select_own on public.notifications for select to authenticated using (user_id = (select auth.uid()));
create policy notifications_update_own on public.notifications for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

alter publication supabase_realtime add table public.notifications;
