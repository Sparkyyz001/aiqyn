-- Инициативы жителей: не только «что сломалось», но и «что сделать лучше».
-- Житель предлагает улучшение района, соседи голосуют; набрав порог, идея уходит акимату,
-- акимат публично отвечает: рассматривается → в плане (с бюджетом) → сделано / отклонено с причиной.
create table public.initiatives (
  id              bigserial primary key,
  author_id       uuid references auth.users(id) on delete set null,
  district_id     integer references public.districts(id),
  kind            text not null default 'improvement' check (kind in ('yard', 'lighting', 'transport', 'green', 'sport', 'accessibility', 'beach', 'safety', 'improvement')),
  title           text not null,
  title_kz        text,
  description     text,
  description_kz  text,
  status          text not null default 'voting' check (status in ('voting', 'review', 'planned', 'done', 'declined')),
  votes_count     integer not null default 0,
  budget_kzt      bigint,
  akimat_reply    text,
  akimat_reply_kz text,
  demo            boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index initiatives_status_votes on public.initiatives (status, votes_count desc);
create index initiatives_district on public.initiatives (district_id);
create index initiatives_author on public.initiatives (author_id);

create table public.initiative_votes (
  initiative_id bigint not null references public.initiatives(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  created_at    timestamptz not null default now(),
  primary key (initiative_id, user_id)
);
create index initiative_votes_user on public.initiative_votes (user_id);

alter table public.initiatives enable row level security;
alter table public.initiative_votes enable row level security;
-- читать инициативы может любой; пишет только сервер (service role)
create policy initiatives_read on public.initiatives for select to anon, authenticated using (true);
create policy initiative_votes_read_own on public.initiative_votes for select to authenticated using (user_id = (select auth.uid()));

alter publication supabase_realtime add table public.initiatives;
