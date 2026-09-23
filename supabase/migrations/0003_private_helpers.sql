-- Хелперы RLS — в схему private (не публикуется через REST API),
-- триггерные функции — без права EXECUTE у клиентов (advisor 0028/0029).

create schema if not exists private;
grant usage on schema private to authenticated;

create or replace function private.my_role() returns text
language sql stable security definer set search_path = '' as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function private.my_service_id() returns integer
language sql stable security definer set search_path = '' as $$
  select service_id from public.profiles where id = auth.uid()
$$;

revoke all on function private.my_role(), private.my_service_id() from public, anon;
grant execute on function private.my_role(), private.my_service_id() to authenticated;

-- Пересоздаём политики, ссылавшиеся на public.my_role / public.my_service_id
drop policy "own profile read" on public.profiles;
create policy "own profile read" on public.profiles for select
  using (id = auth.uid() or private.my_role() in ('akimat', 'operator'));

drop policy "staff update report" on public.reports;
create policy "staff update report" on public.reports for update to authenticated
  using (
    private.my_role() in ('akimat', 'operator')
    or (private.my_role() = 'service' and service_id = private.my_service_id())
  );

drop policy "service reply" on public.service_replies;
create policy "service reply" on public.service_replies for insert to authenticated
  with check (
    author_id = auth.uid()
    and (
      private.my_role() in ('akimat', 'operator')
      or (private.my_role() = 'service' and service_id = private.my_service_id())
    )
  );

drop policy "staff create incident" on public.incidents;
create policy "staff create incident" on public.incidents for insert to authenticated
  with check (private.my_role() in ('akimat', 'operator', 'service'));

drop policy "staff update incident" on public.incidents;
create policy "staff update incident" on public.incidents for update to authenticated
  using (private.my_role() in ('akimat', 'operator', 'service'));

drop policy "escalation read" on public.escalations;
create policy "escalation read" on public.escalations for select to authenticated
  using (created_by = auth.uid() or private.my_role() in ('akimat', 'operator'));

drop function public.my_role();
drop function public.my_service_id();

-- Триггерные функции: вызываются только триггерами
revoke execute on function public.handle_new_user(), public.sync_confirmations_count(), public.set_vote_weight()
  from public, anon, authenticated;
