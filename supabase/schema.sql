-- =====================================================================
-- Smart Vocabulary Learning System: database schema (Supabase / PostgreSQL)
-- How to run: Supabase dashboard -> SQL Editor -> New query -> paste -> Run
-- =====================================================================

-- ---------- 1. Tables ----------

-- One profile per registered user (created automatically by a trigger)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  plan text not null default 'free' check (plan in ('free', 'premium')),
  role text not null default 'user' check (role in ('user', 'admin')),
  is_blocked boolean not null default false,
  created_at timestamptz not null default now()
);

-- Daily upload limit and maximum file size for each plan
create table public.plan_limits (
  plan text primary key,
  daily_uploads int not null,
  max_file_mb int not null
);
insert into public.plan_limits (plan, daily_uploads, max_file_mb)
values ('free', 10, 4), ('premium', 1000000, 4);

-- Uploaded documents (history)
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  file_name text not null,
  file_type text not null,
  extracted_text text,
  created_at timestamptz not null default now()
);

-- Shared dictionary: every word is analysed by AI only once
create table public.words (
  id uuid primary key default gen_random_uuid(),
  word text not null unique,
  bangla_meaning text,
  definition text,
  part_of_speech text,
  synonyms text[] not null default '{}',
  antonyms text[] not null default '{}',
  created_at timestamptz not null default now()
);

-- Learning history: which user knows which word
create table public.user_words (
  user_id uuid not null references auth.users(id) on delete cascade,
  word_id uuid not null references public.words(id) on delete cascade,
  status text not null default 'new' check (status in ('new', 'learned', 'learn_later')),
  updated_at timestamptz not null default now(),
  primary key (user_id, word_id)
);
create index user_words_user_status_idx on public.user_words (user_id, status);

-- Which words came from which document
create table public.document_words (
  document_id uuid not null references public.documents(id) on delete cascade,
  word_id uuid not null references public.words(id) on delete cascade,
  primary key (document_id, word_id)
);

-- Daily usage of registered users
create table public.daily_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null default current_date,
  upload_count int not null default 0,
  primary key (user_id, usage_date)
);

-- Daily usage of guests (keyed by an anonymized IP hash, server-only)
create table public.guest_usage (
  ip_hash text not null,
  usage_date date not null default current_date,
  upload_count int not null default 0,
  primary key (ip_hash, usage_date)
);

-- ---------- 2. Create a profile automatically for every new user ----------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- 3. Row Level Security ----------

alter table public.profiles       enable row level security;
alter table public.plan_limits    enable row level security;
alter table public.documents      enable row level security;
alter table public.words          enable row level security;
alter table public.user_words     enable row level security;
alter table public.document_words enable row level security;
alter table public.daily_usage    enable row level security;
alter table public.guest_usage    enable row level security;

-- ---------- 4. Policies ----------
-- Users can only read their own profile. Nobody can change plan or role from the
-- browser (there is no update policy); the server uses the service role instead.
create policy "own profile read" on public.profiles
  for select to authenticated using (auth.uid() = id);

create policy "limits readable" on public.plan_limits
  for select to anon, authenticated using (true);

create policy "own documents read" on public.documents
  for select to authenticated using (auth.uid() = user_id);
create policy "own documents insert" on public.documents
  for insert to authenticated with check (auth.uid() = user_id);
create policy "own documents delete" on public.documents
  for delete to authenticated using (auth.uid() = user_id);

-- The shared dictionary is readable by everyone; only the server writes to it
create policy "words readable" on public.words
  for select to anon, authenticated using (true);

create policy "own user_words all" on public.user_words
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "own document_words read" on public.document_words
  for select to authenticated
  using (exists (
    select 1 from public.documents d
    where d.id = document_id and d.user_id = auth.uid()
  ));

create policy "own usage read" on public.daily_usage
  for select to authenticated using (auth.uid() = user_id);

-- guest_usage has no policy on purpose: only the server (service role) can access it.

-- ---------- 5. Make yourself the first admin (replace the email, run once) ----------
-- update public.profiles set role = 'admin' where email = 'your-email@example.com';
