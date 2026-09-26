-- Все изменения обращений идут через серверные действия (проверка роли, переходов статуса,
-- качества текста, лимитов). Прямая запись из браузера с публичным ключом обходила бы эти
-- проверки: например, подтверждение с произвольным весом голоса или фото «после» с отметкой
-- «проверено по GPS». Оставляем браузеру только то, что он действительно пишет сам:
-- отметку «прочитано» в своих уведомлениях, свой микрорайон в профиле и загрузку фото в свою папку.

drop policy if exists "create own report"      on public.reports;
drop policy if exists "staff update report"    on public.reports;
drop policy if exists "confirm as self"        on public.report_confirmations;
drop policy if exists "add own event"          on public.report_events;
drop policy if exists "add own photo"          on public.report_photos;
drop policy if exists "verify if involved"     on public.report_verifications;
drop policy if exists "escalation create"      on public.escalations;
drop policy if exists "escalation update own"  on public.escalations;
drop policy if exists "staff create incident"  on public.incidents;
drop policy if exists "staff update incident"  on public.incidents;
drop policy if exists "service reply"          on public.service_replies;

-- уведомления: браузер меняет только время прочтения
revoke update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;

-- фото: только в папку со своим uid (так их и кладёт форма: <uid>/<uuid>.jpg)
drop policy if exists "photos upload by authenticated" on storage.objects;
create policy "photos upload to own folder" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'report-photos'
    and owner = (select auth.uid())
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
