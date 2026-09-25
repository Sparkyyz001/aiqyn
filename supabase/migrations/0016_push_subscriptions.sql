-- Web Push: подписки браузеров/телефонов на уведомления. Пишет и читает только сервер.
create table public.push_subscriptions (
  id         bigserial primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  user_agent text,
  created_at timestamptz not null default now()
);
create index push_subscriptions_user on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;
comment on table public.push_subscriptions is 'Подписки Web Push (пишет и читает только сервер)';
