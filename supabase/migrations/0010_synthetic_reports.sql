-- Модельный поток обращений (ТЗ, раздел 11) хранится в базе рядом с реальными, с явной пометкой.
-- is_synthetic = true: смоделированы на реальных микрорайонах, службах и категориях, чтобы показать
-- работу системы на объёме. Номера AQ-2026-9xxxx. Реальные обращения — is_synthetic = false.
alter table public.reports add column is_synthetic boolean not null default false;
alter table public.reports add column title_kz text;
-- служебные поля модели, которые у реальных обращений считаются из фото «после» и ответов служб
alter table public.reports add column synthetic jsonb;
create index reports_is_synthetic on public.reports (is_synthetic);
comment on column public.reports.is_synthetic is 'Модельное обращение (номер AQ-2026-9xxxx), не подано жителем';
