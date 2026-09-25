-- Причина задержки: служба публично объясняет, почему обращение стоит.
-- «Нет финансирования» и «ждём закупку» — сигнал для бюджета (страница «Народный заказ»).
alter table public.reports add column delay_reason text check (delay_reason in ('no_funding','procurement','materials','contractor','weather','other_org','other'));
alter table public.reports add column delay_note text;
alter table public.reports add column delay_at timestamptz;
create index reports_delay_reason on public.reports (delay_reason) where delay_reason is not null;
