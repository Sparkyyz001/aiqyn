-- AIQYN: базовая схема (ТЗ, раздел 5)

-- СПРАВОЧНИКИ ---------------------------------------------------------------

create table public.districts (
  id            serial primary key,
  code          text unique not null,
  name_ru       text not null,
  name_kz       text not null,
  kind          text not null,              -- mkr | village | zone
  center_lat    double precision not null,
  center_lng    double precision not null,
  polygon       jsonb,                      -- GeoJSON из OSM
  population    integer,
  osm_id        text
);

create table public.services (
  id            serial primary key,
  code          text unique not null,
  short_name    text not null,
  name_ru       text not null,
  name_kz       text not null,
  description   text,
  address       text,
  contact_phone text,
  contact_email text,
  verified      boolean not null default false,  -- false = по открытым источникам, требует уточнения
  source_url    text
);

create table public.categories (
  id              serial primary key,
  code            text unique not null,
  name_ru         text not null,
  name_kz         text not null,
  icon            text,
  default_service integer references public.services(id),
  sla_days        integer not null default 15,  -- рабочих дней, АППК РК ст.76
  severity_base   integer not null default 50   -- 0..100
);

-- ПРОФИЛИ -------------------------------------------------------------------

create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  role        text not null default 'citizen'
              check (role in ('citizen', 'service', 'akimat', 'operator')),
  service_id  integer references public.services(id),
  full_name   text,
  phone       text,
  district_id integer references public.districts(id),
  reputation  double precision not null default 1,
  lang        text not null default 'ru' check (lang in ('ru', 'kz')),
  created_at  timestamptz not null default now()
);

-- АГРЕГАТЫ ------------------------------------------------------------------

create table public.clusters (
  id            bigserial primary key,
  category_id   integer references public.categories(id),
  district_id   integer references public.districts(id),
  center_lat    double precision not null,
  center_lng    double precision not null,
  radius_m      integer not null default 80,
  reports_count integer not null default 0,
  reopen_total  integer not null default 0,
  first_seen    timestamptz,
  last_seen     timestamptz,
  chronic_score double precision not null default 0,
  label         text
);

create table public.incidents (
  id          bigserial primary key,
  type        text not null check (type in ('water', 'power', 'heat', 'road_closure')),
  title       text not null,
  description text,
  service_id  integer references public.services(id),
  polygon     jsonb not null,
  started_at  timestamptz not null default now(),
  eta_at      timestamptz,
  resolved_at timestamptz,
  status      text not null default 'active' check (status in ('active', 'resolved')),
  created_by  uuid references auth.users(id),
  created_at  timestamptz not null default now()
);

-- ОБРАЩЕНИЯ -----------------------------------------------------------------

create type public.report_status as enum (
  'new', 'routed', 'accepted', 'in_progress',
  'awaiting_confirmation', 'resolved', 'rejected', 'reopened'
);

create type public.report_source as enum ('app', 'operator', 'call109', 'instagram');

create sequence public.report_no_seq;

create table public.reports (
  id                  bigserial primary key,
  public_no           text unique not null
                      default ('AQ-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.report_no_seq')::text, 5, '0')),
  author_id           uuid references auth.users(id),
  category_id         integer not null references public.categories(id),
  service_id          integer references public.services(id),
  district_id         integer references public.districts(id),
  cluster_id          bigint references public.clusters(id) on delete set null,
  incident_id         bigint references public.incidents(id) on delete set null,

  title               text not null,
  description         text,
  lat                 double precision not null,
  lng                 double precision not null,
  address_text        text,

  status              public.report_status not null default 'new',
  severity            integer not null default 50,
  priority_score      double precision not null default 0,
  confirmations_count integer not null default 0,
  reopen_count        integer not null default 0,

  sla_due_at          timestamptz,
  sla_breached_at     timestamptz,
  verification_due_at timestamptz,                   -- окно голосования жителей, 72 ч

  source              public.report_source not null default 'app',
  source_url          text,

  created_at          timestamptz not null default now(),
  accepted_at         timestamptz,
  resolved_at         timestamptz,
  closed_at           timestamptz
);
create index on public.reports (status);
create index on public.reports (category_id);
create index on public.reports (district_id);
create index on public.reports (service_id);
create index on public.reports (lat, lng);
create index on public.reports (created_at desc);

create table public.report_photos (
  id           bigserial primary key,
  report_id    bigint not null references public.reports(id) on delete cascade,
  url          text not null,
  kind         text not null check (kind in ('before', 'after')),
  lat          double precision,
  lng          double precision,
  taken_at     timestamptz,
  geo_verified boolean not null default false,
  uploaded_by  uuid references auth.users(id),
  created_at   timestamptz not null default now()
);
create index on public.report_photos (report_id);

create table public.report_events (
  id          bigserial primary key,
  report_id   bigint not null references public.reports(id) on delete cascade,
  actor_id    uuid references auth.users(id),
  type        text not null,  -- created | routed | accepted | status_change | reply | confirmed |
                              -- verification | reopened | escalated | photo
  from_status public.report_status,
  to_status   public.report_status,
  comment     text,
  meta        jsonb,
  created_at  timestamptz not null default now()
);
create index on public.report_events (report_id, created_at);

create table public.report_confirmations (
  id         bigserial primary key,
  report_id  bigint not null references public.reports(id) on delete cascade,
  user_id    uuid not null references auth.users(id),
  weight     double precision not null default 1,
  created_at timestamptz not null default now(),
  unique (report_id, user_id)
);

create table public.report_verifications (
  id         bigserial primary key,
  report_id  bigint not null references public.reports(id) on delete cascade,
  user_id    uuid not null references auth.users(id),
  verdict    text not null check (verdict in ('fixed', 'not_fixed')),
  weight     double precision not null default 1,
  round      integer not null default 0,              -- = reopen_count на момент голосования
  comment    text,
  created_at timestamptz not null default now(),
  unique (report_id, user_id, round)
);

create table public.service_replies (
  id                bigserial primary key,
  report_id         bigint not null references public.reports(id) on delete cascade,
  service_id        integer not null references public.services(id),
  author_id         uuid references auth.users(id),
  text              text not null,
  boilerplate_score double precision,
  created_at        timestamptz not null default now()
);
create index on public.service_replies (service_id);

create table public.escalations (
  id           bigserial primary key,
  report_id    bigint not null references public.reports(id) on delete cascade,
  created_by   uuid references auth.users(id),
  payload      jsonb not null,
  pdf_path     text,
  created_at   timestamptz not null default now(),
  submitted_at timestamptz,
  eotinish_ref text
);

-- ВНЕШНИЕ ДАННЫЕ ------------------------------------------------------------

create table public.procurements (
  id            bigserial primary key,
  contract_no   text,
  title         text not null,
  supplier      text,
  customer      text,
  amount_kzt    numeric(16,2),
  signed_at     date,
  district_id   integer references public.districts(id),
  lat           double precision,
  lng           double precision,
  category_hint text,
  source_url    text not null,
  raw           jsonb
);

create table public.weather_obs (
  id          bigserial primary key,
  observed_at timestamptz not null unique,
  wind_deg    double precision,
  wind_speed  double precision,
  temp        double precision,
  source      text not null default 'open-meteo'
);

create table public.road_segments (
  id             bigserial primary key,
  osm_id         text unique,
  name           text,
  district_id    integer references public.districts(id),
  geometry       jsonb not null,
  highway_class  text,
  last_repair_at date,
  reports_count  integer default 0,
  risk_score     double precision,
  predicted_at   timestamptz
);

create table public.lighting_points (
  id          bigserial primary key,
  osm_id      text,
  lat         double precision not null,
  lng         double precision not null,
  district_id integer references public.districts(id),
  status      text not null default 'ok' check (status in ('ok', 'dark')),
  dark_since  timestamptz,
  risk_score  double precision
);
