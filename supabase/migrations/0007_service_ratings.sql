-- Оценки служб жителями (1–5 звёзд): одна оценка на человека, можно изменить.
-- demo = true — модельная база оценок, чтобы карточки служб не были пустыми до реальных оценок.
create table public.service_ratings (
  id          bigserial primary key,
  service_id  integer not null references public.services(id) on delete cascade,
  user_id     uuid references auth.users(id) on delete cascade,
  stars       smallint not null check (stars between 1 and 5),
  demo        boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index service_ratings_user_once on public.service_ratings (service_id, user_id) where user_id is not null;
create index service_ratings_service on public.service_ratings (service_id);
create index service_ratings_user on public.service_ratings (user_id);
alter table public.service_ratings enable row level security;
create policy service_ratings_read on public.service_ratings for select to anon, authenticated using (true);

-- модельная база оценок: у каждой службы свой средний уровень и разброс
insert into public.service_ratings (service_id, stars, demo, created_at)
select s.id,
       greatest(1, least(5, round(base + (random() - 0.5) * 2.6)))::smallint,
       true,
       now() - (random() * interval '80 days')
from public.services s
join (values ('kzhsa', 3.1, 140), ('aues', 3.6, 90), ('mrek', 3.4, 40), ('maek', 3.3, 35), ('sanitary', 3.9, 110), ('roads', 2.9, 120), ('housing', 3.5, 70), ('eco', 3.2, 45), ('akimat', 3.7, 80)) as v(code, base, n) on v.code = s.code
cross join lateral generate_series(1, v.n) g;
