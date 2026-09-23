-- AIQYN: RLS, триггеры, Realtime, Storage (ТЗ, раздел 5 «RLS»)
--
-- Принцип: всё публичное читают все (прозрачность — суть продукта).
-- Пишет клиент только то, что относится к нему самому. Производные поля
-- (приоритет, кластеры, SLA, итог голосования) пересчитывает сервер (server actions)
-- после проверки сессии пользователя.

-- ХЕЛПЕРЫ -------------------------------------------------------------------

create or replace function public.my_role() returns text
language sql stable security definer set search_path = '' as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.my_service_id() returns integer
language sql stable security definer set search_path = '' as $$
  select service_id from public.profiles where id = auth.uid()
$$;

-- Профиль создаётся автоматически при регистрации, всегда с ролью citizen
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (new.id, new.raw_user_meta_data ->> 'full_name', new.phone);
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Счётчик «подтвердили N человек» держит база, а не клиент
create or replace function public.sync_confirmations_count() returns trigger
language plpgsql security definer set search_path = '' as $$
declare rid bigint := coalesce(new.report_id, old.report_id);
begin
  update public.reports
     set confirmations_count = (select count(*) from public.report_confirmations where report_id = rid)
   where id = rid;
  return null;
end $$;

create trigger report_confirmations_count
  after insert or delete on public.report_confirmations
  for each row execute function public.sync_confirmations_count();

-- Вес голоса и подтверждения = репутация жителя (защита от накрутки, фишка 1)
create or replace function public.set_vote_weight() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.weight := coalesce((select reputation from public.profiles where id = new.user_id), 1);
  return new;
end $$;

create trigger report_confirmations_weight
  before insert on public.report_confirmations
  for each row execute function public.set_vote_weight();

create trigger report_verifications_weight
  before insert on public.report_verifications
  for each row execute function public.set_vote_weight();

-- ВКЛЮЧАЕМ RLS ВЕЗДЕ --------------------------------------------------------

alter table public.districts            enable row level security;
alter table public.services             enable row level security;
alter table public.categories           enable row level security;
alter table public.profiles             enable row level security;
alter table public.clusters             enable row level security;
alter table public.incidents            enable row level security;
alter table public.reports              enable row level security;
alter table public.report_photos        enable row level security;
alter table public.report_events        enable row level security;
alter table public.report_confirmations enable row level security;
alter table public.report_verifications enable row level security;
alter table public.service_replies      enable row level security;
alter table public.escalations          enable row level security;
alter table public.procurements         enable row level security;
alter table public.weather_obs          enable row level security;
alter table public.road_segments        enable row level security;
alter table public.lighting_points      enable row level security;

-- ПУБЛИЧНОЕ ЧТЕНИЕ ----------------------------------------------------------

create policy "public read" on public.districts            for select using (true);
create policy "public read" on public.services             for select using (true);
create policy "public read" on public.categories           for select using (true);
create policy "public read" on public.clusters             for select using (true);
create policy "public read" on public.incidents            for select using (true);
create policy "public read" on public.reports              for select using (true);
create policy "public read" on public.report_photos        for select using (true);
create policy "public read" on public.report_events        for select using (true);
create policy "public read" on public.report_confirmations for select using (true);
create policy "public read" on public.report_verifications for select using (true);
create policy "public read" on public.service_replies      for select using (true);
create policy "public read" on public.procurements         for select using (true);
create policy "public read" on public.weather_obs          for select using (true);
create policy "public read" on public.road_segments        for select using (true);
create policy "public read" on public.lighting_points      for select using (true);

-- ПРОФИЛИ: читает владелец (и акимат/оператор); роль клиент менять не может ---

create policy "own profile read" on public.profiles for select
  using (id = auth.uid() or public.my_role() in ('akimat', 'operator'));

create policy "own profile update" on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

-- На уровне колонок: role, service_id, reputation клиенту недоступны вовсе
revoke update on public.profiles from anon, authenticated;
grant update (full_name, phone, district_id, lang) on public.profiles to authenticated;

-- ОБРАЩЕНИЯ ------------------------------------------------------------------

-- Создаёт авторизованный пользователь, только от своего имени
create policy "create own report" on public.reports for insert to authenticated
  with check (author_id = auth.uid());

-- Менять — служба, к которой маршрутизировано, либо акимат/оператор
create policy "staff update report" on public.reports for update to authenticated
  using (
    public.my_role() in ('akimat', 'operator')
    or (public.my_role() = 'service' and service_id = public.my_service_id())
  );

create policy "add own photo" on public.report_photos for insert to authenticated
  with check (uploaded_by = auth.uid());

create policy "add own event" on public.report_events for insert to authenticated
  with check (actor_id = auth.uid());

create policy "confirm as self" on public.report_confirmations for insert to authenticated
  with check (user_id = auth.uid());

-- Голосовать «сделано / не сделано» — только автор обращения или подтверждавшие его
create policy "verify if involved" on public.report_verifications for insert to authenticated
  with check (
    user_id = auth.uid()
    and (
      exists (select 1 from public.reports r where r.id = report_id and r.author_id = auth.uid())
      or exists (select 1 from public.report_confirmations c where c.report_id = report_verifications.report_id and c.user_id = auth.uid())
    )
  );

-- Ответ жителю — сотрудник своей службы, либо акимат/оператор
create policy "service reply" on public.service_replies for insert to authenticated
  with check (
    author_id = auth.uid()
    and (
      public.my_role() in ('akimat', 'operator')
      or (public.my_role() = 'service' and service_id = public.my_service_id())
    )
  );

-- Аварии заводят оператор, акимат и службы
create policy "staff create incident" on public.incidents for insert to authenticated
  with check (public.my_role() in ('akimat', 'operator', 'service'));
create policy "staff update incident" on public.incidents for update to authenticated
  using (public.my_role() in ('akimat', 'operator', 'service'));

-- Эскалация содержит ФИО заявителя — видит только создатель и акимат/оператор
create policy "escalation read" on public.escalations for select to authenticated
  using (created_by = auth.uid() or public.my_role() in ('akimat', 'operator'));
create policy "escalation create" on public.escalations for insert to authenticated
  with check (created_by = auth.uid());
create policy "escalation update own" on public.escalations for update to authenticated
  using (created_by = auth.uid());

-- REALTIME -------------------------------------------------------------------

alter publication supabase_realtime add table public.reports, public.report_events, public.incidents;

-- STORAGE: фото обращений -----------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('report-photos', 'report-photos', true, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do nothing;

-- Бакет публичный: файлы отдаются по публичному URL без select-политики
-- (select-политика на storage.objects разрешила бы листинг всех файлов).
create policy "photos upload by authenticated" on storage.objects for insert to authenticated
  with check (bucket_id = 'report-photos' and owner = auth.uid());
