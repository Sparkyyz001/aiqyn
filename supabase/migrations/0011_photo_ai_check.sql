-- ИИ-сверка фото «после» с фото жителя (verdict, confidence, пояснение на двух языках)
alter table public.report_photos add column ai_check jsonb;
comment on column public.report_photos.ai_check is 'ИИ-сверка фото «после» с фото жителя: verdict, confidence, explanation_ru/kz';
