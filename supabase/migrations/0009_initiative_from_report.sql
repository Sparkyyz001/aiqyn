-- Обращение, застрявшее без решения, можно превратить в инициативу для бюджета
-- (Бюджет народного участия / бюджет следующего года). Храним номер обращения:
-- у модельных обращений нет строки в reports, поэтому ссылка — по публичному номеру.
alter table public.initiatives add column report_no text;
create unique index initiatives_report_no on public.initiatives (report_no) where report_no is not null;
