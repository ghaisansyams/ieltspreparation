-- Lexiband · Vocabulary Hub — cloud sync schema
--
-- The app is local-first (IndexedDB). These tables mirror the TypeScript
-- model in src/lib/types.ts so a signed-in learner's library, progress and
-- history follow them across devices. Every row belongs to one auth user and
-- Row Level Security restricts access to that user only.
--
-- Run in the Supabase SQL editor, or `supabase db push` with the CLI.

-- ── Vocabulary ──────────────────────────────────────────────────────────────
create table if not exists public.vocabulary (
  user_id              uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  id                   text        not null,
  source_number        integer,
  word                 text        not null check (char_length(word) between 1 and 120),
  pronunciation        text        not null default '',
  part_of_speech       text        not null default '',

  meaning1             text        not null default '',
  meaning2             text        not null default '',
  meaning3             text        not null default '',

  synonym1             text        not null default '',
  synonym2             text        not null default '',
  synonym3             text        not null default '',

  example1             text        not null default '',
  example1_translation text        not null default '',
  example2             text        not null default '',
  example2_translation text        not null default '',
  example3             text        not null default '',
  example3_translation text        not null default '',

  cefr                 text        check (cefr in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
  cefr_source          text        not null default 'estimated' check (cefr_source in ('source', 'estimated', 'manual')),

  definition           text        not null default '',
  difficulty           smallint    check (difficulty between 1 and 5),
  frequency            text        check (frequency in ('very common', 'common', 'less common', 'rare')),
  tags                 text[]      not null default '{}',

  word_family          text[]      not null default '{}',
  collocations         text[]      not null default '{}',
  common_mistakes      text[]      not null default '{}',
  ielts_relevance      jsonb,

  origin               text        not null default 'manual' check (origin in ('source-pdf', 'import', 'manual', 'ai-generated')),
  -- Fields whose value was produced by AI and not yet verified by the learner.
  ai_fields            text[]      not null default '{}',
  needs_review         boolean     not null default false,
  review_notes         jsonb       not null default '[]'::jsonb,
  -- Cached "Use This Word" contexts.
  contexts             jsonb,

  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  primary key (user_id, id)
);

create index if not exists vocabulary_user_word_idx on public.vocabulary (user_id, lower(word));
create index if not exists vocabulary_user_cefr_idx on public.vocabulary (user_id, cefr);

-- ── Learning progress (one row per word) ────────────────────────────────────
create table if not exists public.learning_progress (
  user_id            uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  vocabulary_id      text        not null,
  id                 text        not null,
  status             text        not null default 'new' check (status in ('new', 'learning', 'review', 'mastered')),
  mastery            smallint    not null default 0 check (mastery between 0 and 100),
  review_count       integer     not null default 0,
  correct_count      integer     not null default 0,
  incorrect_count    integer     not null default 0,
  streak             integer     not null default 0,
  confidence         real        not null default 0 check (confidence between 0 and 1),
  ease_factor        real        not null default 2.5,
  interval_days      integer     not null default 0,
  lapses             integer     not null default 0,
  last_reviewed_at   timestamptz,
  next_review_at     timestamptz,
  last_exercise_type text,
  updated_at         timestamptz not null default now(),
  primary key (user_id, vocabulary_id),
  unique (user_id, id),
  foreign key (user_id, vocabulary_id) references public.vocabulary (user_id, id) on delete cascade
);

create index if not exists learning_progress_due_idx on public.learning_progress (user_id, next_review_at);

-- ── Quiz attempts (append-only history) ─────────────────────────────────────
create table if not exists public.quiz_attempts (
  user_id       uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  id            text        not null,
  vocabulary_id text        not null,
  quiz_type     text        not null,
  is_correct    boolean     not null,
  response_time integer     not null default 0 check (response_time >= 0),
  created_at    timestamptz not null default now(),
  primary key (user_id, id),
  foreign key (user_id, vocabulary_id) references public.vocabulary (user_id, id) on delete cascade
);

create index if not exists quiz_attempts_user_created_idx on public.quiz_attempts (user_id, created_at desc);
create index if not exists quiz_attempts_user_vocab_idx on public.quiz_attempts (user_id, vocabulary_id);

-- ── Profile: XP, achievements, daily activity, settings ────────────────────
create table if not exists public.profiles (
  user_id          uuid        primary key default auth.uid() references auth.users (id) on delete cascade,
  display_name     text        not null default '',
  xp               integer     not null default 0 check (xp >= 0),
  achievements     jsonb       not null default '{}'::jsonb,
  daily_challenges jsonb       not null default '{}'::jsonb,
  activity         jsonb       not null default '{}'::jsonb,
  settings         jsonb       not null default '{}'::jsonb,
  updated_at       timestamptz not null default now()
);

-- ── Row Level Security: each learner sees only their own rows ──────────────
alter table public.vocabulary        enable row level security;
alter table public.learning_progress enable row level security;
alter table public.quiz_attempts     enable row level security;
alter table public.profiles          enable row level security;

do $$
declare t text;
begin
  foreach t in array array['vocabulary', 'learning_progress', 'quiz_attempts', 'profiles'] loop
    execute format('drop policy if exists "own rows: select" on public.%I', t);
    execute format('drop policy if exists "own rows: insert" on public.%I', t);
    execute format('drop policy if exists "own rows: update" on public.%I', t);
    execute format('drop policy if exists "own rows: delete" on public.%I', t);
    execute format('create policy "own rows: select" on public.%I for select to authenticated using (user_id = (select auth.uid()))', t);
    execute format('create policy "own rows: insert" on public.%I for insert to authenticated with check (user_id = (select auth.uid()))', t);
    execute format('create policy "own rows: update" on public.%I for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
    execute format('create policy "own rows: delete" on public.%I for delete to authenticated using (user_id = (select auth.uid()))', t);
  end loop;
end $$;
