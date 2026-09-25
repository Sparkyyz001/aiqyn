-- Производительность RLS: auth.uid() вычисляется один раз на запрос, а не для каждой строки
-- (рекомендация Supabase advisor «auth_rls_initplan»). Логика политик не меняется.
alter policy "escalation create" on public.escalations with check (created_by = (select auth.uid()));
alter policy "escalation read" on public.escalations using ((created_by = (select auth.uid())) or (private.my_role() = any (array['akimat', 'operator'])));
alter policy "escalation update own" on public.escalations using (created_by = (select auth.uid()));
alter policy "own profile read" on public.profiles using ((id = (select auth.uid())) or (private.my_role() = any (array['akimat', 'operator'])));
alter policy "own profile update" on public.profiles using (id = (select auth.uid())) with check (id = (select auth.uid()));
alter policy "confirm as self" on public.report_confirmations with check (user_id = (select auth.uid()));
alter policy "add own event" on public.report_events with check (actor_id = (select auth.uid()));
alter policy "add own photo" on public.report_photos with check (uploaded_by = (select auth.uid()));
alter policy "verify if involved" on public.report_verifications with check (
  (user_id = (select auth.uid())) and (
    exists (select 1 from public.reports r where r.id = report_verifications.report_id and r.author_id = (select auth.uid()))
    or exists (select 1 from public.report_confirmations c where c.report_id = report_verifications.report_id and c.user_id = (select auth.uid()))
  )
);
alter policy "create own report" on public.reports with check (author_id = (select auth.uid()));
alter policy "service reply" on public.service_replies with check (
  (author_id = (select auth.uid())) and (
    (private.my_role() = any (array['akimat', 'operator']))
    or ((private.my_role() = 'service') and (service_id = private.my_service_id()))
  )
);

-- Индексы на внешние ключи (advisor «unindexed_foreign_keys»): быстрее выборки и каскадные удаления
create index if not exists categories_default_service_idx on public.categories (default_service);
create index if not exists clusters_category_idx on public.clusters (category_id);
create index if not exists clusters_district_idx on public.clusters (district_id);
create index if not exists escalations_created_by_idx on public.escalations (created_by);
create index if not exists escalations_report_idx on public.escalations (report_id);
create index if not exists incidents_created_by_idx on public.incidents (created_by);
create index if not exists incidents_service_idx on public.incidents (service_id);
create index if not exists lighting_points_district_idx on public.lighting_points (district_id);
create index if not exists procurements_district_idx on public.procurements (district_id);
create index if not exists profiles_district_idx on public.profiles (district_id);
create index if not exists profiles_service_idx on public.profiles (service_id);
create index if not exists report_confirmations_user_idx on public.report_confirmations (user_id);
create index if not exists report_events_actor_idx on public.report_events (actor_id);
create index if not exists report_photos_uploaded_by_idx on public.report_photos (uploaded_by);
create index if not exists report_verifications_user_idx on public.report_verifications (user_id);
create index if not exists reports_author_idx on public.reports (author_id);
create index if not exists reports_cluster_idx on public.reports (cluster_id);
create index if not exists reports_incident_idx on public.reports (incident_id);
create index if not exists road_segments_district_idx on public.road_segments (district_id);
create index if not exists service_replies_author_idx on public.service_replies (author_id);
create index if not exists service_replies_report_idx on public.service_replies (report_id);
