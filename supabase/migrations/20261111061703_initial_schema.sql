-- =============================================================================
-- NEXT-GEN STUDENT RANDOMIZER — initial schema
--
-- Multi-school data model. Every table lives in `public` (exposed through the
-- Data API) and has Row Level Security enabled. Helper functions used by the
-- policies live in the unexposed `private` schema.
--
-- Access model (see docs/ARCHITECTURE.md §5.1):
--   schools                     members of the school read; owner/admin rename
--   users                       self + members of the same school read; self edits display_name
--   classrooms, students        classroom owner + school owner/admin
--   random_sessions/_results    the teacher who drew + school owner/admin (read)
--   random_settings, sound_*    the user only
-- Nobody can read or write across schools, even knowing a row's UUID.
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;
revoke all on schema private from public;
-- Policies call the helpers below as the requesting user, so `authenticated` needs USAGE.
-- `private` is not listed in the Data API's exposed schemas, so this does not make it reachable over HTTP.
grant usage on schema private to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Tables
-- -----------------------------------------------------------------------------

create table public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 100),
  -- Invite code teachers use to join. Readable only through public.get_join_code() (owner/admin).
  join_code text not null unique check (join_code ~ '^[A-Z0-9]{6,12}$'),
  created_at timestamptz not null default now()
);

-- One row per auth user (created by a trigger on auth.users).
create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  school_id uuid references public.schools (id) on delete set null,
  display_name text not null default '' check (char_length(display_name) <= 120),
  role text not null default 'teacher' check (role in ('owner', 'admin', 'teacher')),
  created_at timestamptz not null default now()
);

create table public.classrooms (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  owner_id uuid references public.users (id) on delete set null,
  -- Length limits are in code points and deliberately looser than the app's grapheme limits:
  -- one Thai character (consonant + vowel + tone mark) can take three code points.
  name text not null check (char_length(btrim(name)) between 1 and 160),
  grade_level text not null default '' check (char_length(grade_level) <= 160),
  academic_year text not null default '' check (academic_year = '' or academic_year ~ '^[0-9]{4}$'),
  color text not null default 'violet' check (color in ('violet', 'cyan', 'pink', 'lime', 'gold')),
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Target of the composite foreign key on students: a student always belongs to its classroom's school.
  unique (id, school_id)
);

create table public.students (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  classroom_id uuid not null,
  student_code text not null default ''
    check (student_code = '' or (char_length(student_code) <= 20 and student_code ~ '^[0-9A-Za-z][0-9A-Za-z._/-]*$')),
  number integer not null check (number between 1 and 999),
  first_name text not null check (char_length(btrim(first_name)) between 1 and 240),
  last_name text not null default '' check (char_length(last_name) <= 240),
  nickname text not null default '' check (char_length(nickname) <= 120),
  -- Generated avatars only (`bot:<seed>` / `emoji:<emoji>`); never an uploaded photo or a URL.
  avatar text not null default '' check (avatar = '' or avatar ~ '^(bot|emoji):.{1,40}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (classroom_id, school_id) references public.classrooms (id, school_id) on delete cascade,
  unique (classroom_id, number)
);

-- A round of draws on one pool (classroom roster or number range).
create table public.random_sessions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  classroom_id uuid references public.classrooms (id) on delete set null,
  -- Snapshot, so history survives a renamed or deleted classroom.
  classroom_name text not null default '' check (char_length(classroom_name) <= 400),
  source text not null check (source in ('students', 'numbers')),
  rules jsonb not null default '{}'::jsonb check (jsonb_typeof(rules) = 'object'),
  started_at timestamptz not null default now(),
  ended_at timestamptz
);

create table public.random_results (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  session_id uuid not null references public.random_sessions (id) on delete cascade,
  classroom_id uuid references public.classrooms (id) on delete set null,
  student_id uuid references public.students (id) on delete set null,
  -- Snapshots taken at draw time.
  display_name text not null check (char_length(display_name) between 1 and 500),
  student_number integer check (student_number between 0 and 9999),
  avatar text check (avatar is null or avatar ~ '^(bot|emoji):.{1,40}$'),
  mode text not null check (mode in ('wheel', 'slot', 'card', 'countdown', 'gacha', 'team')),
  draw_type text not null check (draw_type in ('single', 'multiple', 'team')),
  draw_index integer not null check (draw_index >= 1),
  pick_index integer not null check (pick_index >= 1),
  team_index integer check (team_index >= 0),
  points integer not null default 0 check (points between 0 and 9999),
  meta jsonb check (meta is null or jsonb_typeof(meta) = 'object'),
  created_at timestamptz not null default now()
);

-- Per-user preferences, one row each. Sections mirror the app's AppSettings and are validated client-side.
create table public.random_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users (id) on delete cascade,
  general jsonb not null default '{}'::jsonb check (jsonb_typeof(general) = 'object'),
  appearance jsonb not null default '{}'::jsonb check (jsonb_typeof(appearance) = 'object'),
  animation jsonb not null default '{}'::jsonb check (jsonb_typeof(animation) = 'object'),
  rules jsonb not null default '{}'::jsonb check (jsonb_typeof(rules) = 'object'),
  display jsonb not null default '{}'::jsonb check (jsonb_typeof(display) = 'object'),
  features jsonb not null default '{}'::jsonb check (jsonb_typeof(features) = 'object'),
  updated_at timestamptz not null default now()
);

create table public.sound_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users (id) on delete cascade,
  enabled boolean not null default true,
  master_volume numeric(3, 2) not null default 0.80 check (master_volume between 0 and 1),
  music_volume numeric(3, 2) not null default 0.50 check (music_volume between 0 and 1),
  sfx_volume numeric(3, 2) not null default 0.90 check (sfx_volume between 0 and 1),
  theme text not null default 'neon' check (theme in ('neon', 'arcade', 'soft')),
  music_mode text not null default 'draw' check (music_mode in ('off', 'draw', 'always')),
  hover boolean not null default true,
  updated_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Indexes (foreign keys and the columns policies and the app filter on)
-- -----------------------------------------------------------------------------

create index users_school_id_idx on public.users (school_id);
create index classrooms_school_id_idx on public.classrooms (school_id);
create index classrooms_owner_id_idx on public.classrooms (owner_id);
create unique index students_classroom_code_key on public.students (classroom_id, lower(student_code))
  where student_code <> '';
create index random_sessions_user_id_idx on public.random_sessions (user_id, started_at desc);
create index random_sessions_school_id_idx on public.random_sessions (school_id);
create index random_sessions_classroom_id_idx on public.random_sessions (classroom_id);
create index random_results_user_created_idx on public.random_results (user_id, created_at desc);
create index random_results_school_created_idx on public.random_results (school_id, created_at desc);
create index random_results_session_id_idx on public.random_results (session_id);
create index random_results_classroom_id_idx on public.random_results (classroom_id);
create index random_results_student_id_idx on public.random_results (student_id);

-- -----------------------------------------------------------------------------
-- Helper functions for policies
--
-- SECURITY DEFINER so they can read public.users without recursing into its own
-- policies. Each one only ever answers questions about the calling user (auth.uid()).
-- -----------------------------------------------------------------------------

create function private.current_school_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select u.school_id from public.users u where u.id = (select auth.uid())
$$;

create function private.is_school_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select u.role in ('owner', 'admin') and u.school_id is not null from public.users u where u.id = (select auth.uid())),
    false
  )
$$;

-- Classrooms the caller may manage: their own, or every classroom of their school when they are owner/admin.
create function private.manageable_classroom_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select c.id
  from public.classrooms c
  join public.users u on u.id = (select auth.uid())
  where c.school_id = u.school_id
    and (c.owner_id = u.id or u.role in ('owner', 'admin'))
$$;

revoke all on function private.current_school_id() from public;
revoke all on function private.is_school_admin() from public;
revoke all on function private.manageable_classroom_ids() from public;
grant execute on function private.current_school_id() to authenticated, service_role;
grant execute on function private.is_school_admin() to authenticated, service_role;
grant execute on function private.manageable_classroom_ids() to authenticated, service_role;

-- Invite code: 8 characters from an alphabet without look-alikes (no 0/O, 1/I/L).
create function private.generate_join_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  code text := '';
  byte integer;
begin
  while char_length(code) < 8 loop
    byte := get_byte(extensions.gen_random_bytes(1), 0);
    -- Rejection sampling: 248 = 8 × 31, so every character is equally likely.
    if byte < 248 then
      code := code || substr(alphabet, (byte % 31) + 1, 1);
    end if;
  end loop;
  return code;
end;
$$;

revoke all on function private.generate_join_code() from public;

-- -----------------------------------------------------------------------------
-- Triggers
-- -----------------------------------------------------------------------------

create function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Ownership columns never change through the API. A trigger (instead of column privileges) keeps
-- upserts working, because PostgREST upserts list every column in their SET clause.
create function private.forbid_column_changes()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  col text;
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  foreach col in array tg_argv loop
    if (to_jsonb(new) -> col) is distinct from (to_jsonb(old) -> col) then
      raise exception 'column "%" of "%" cannot be changed', col, tg_table_name
        using errcode = '42501';
    end if;
  end loop;
  return new;
end;
$$;

create trigger classrooms_touch before update on public.classrooms
  for each row execute function private.touch_updated_at();
create trigger students_touch before update on public.students
  for each row execute function private.touch_updated_at();
create trigger random_settings_touch before update on public.random_settings
  for each row execute function private.touch_updated_at();
create trigger sound_settings_touch before update on public.sound_settings
  for each row execute function private.touch_updated_at();

create trigger classrooms_immutable before update on public.classrooms
  for each row execute function private.forbid_column_changes('id', 'school_id', 'owner_id');
create trigger students_immutable before update on public.students
  for each row execute function private.forbid_column_changes('id', 'school_id', 'classroom_id');
create trigger random_sessions_immutable before update on public.random_sessions
  for each row execute function private.forbid_column_changes('id', 'school_id', 'user_id', 'classroom_id');
create trigger random_results_immutable before update on public.random_results
  for each row execute function private.forbid_column_changes('id', 'school_id', 'user_id', 'session_id');
create trigger random_settings_immutable before update on public.random_settings
  for each row execute function private.forbid_column_changes('id', 'user_id');
create trigger sound_settings_immutable before update on public.sound_settings
  for each row execute function private.forbid_column_changes('id', 'user_id');

-- Profile row for every new account. The display name comes from sign-up metadata, which the
-- user controls; it is only ever used for display, never for authorization.
create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.users (id, display_name)
  values (
    new.id,
    left(
      coalesce(
        nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''),
        split_part(coalesce(new.email, ''), '@', 1)
      ),
      120
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function private.handle_new_user() from public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- Accounts that existed before this migration.
insert into public.users (id)
select id from auth.users
on conflict (id) do nothing;

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------

alter table public.schools enable row level security;
alter table public.users enable row level security;
alter table public.classrooms enable row level security;
alter table public.students enable row level security;
alter table public.random_sessions enable row level security;
alter table public.random_results enable row level security;
alter table public.random_settings enable row level security;
alter table public.sound_settings enable row level security;

-- schools ----------------------------------------------------------------------
create policy "members read their school" on public.schools
  for select to authenticated
  using (id = (select private.current_school_id()));

create policy "owner and admins rename the school" on public.schools
  for update to authenticated
  using (id = (select private.current_school_id()) and (select private.is_school_admin()))
  with check (id = (select private.current_school_id()));

-- users ------------------------------------------------------------------------
create policy "read self and school members" on public.users
  for select to authenticated
  using (id = (select auth.uid()) or school_id = (select private.current_school_id()));

create policy "update own profile" on public.users
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- classrooms -------------------------------------------------------------------
create policy "read own or as school admin" on public.classrooms
  for select to authenticated
  using (
    school_id = (select private.current_school_id())
    and (owner_id = (select auth.uid()) or (select private.is_school_admin()))
  );

create policy "create own in own school" on public.classrooms
  for insert to authenticated
  with check (school_id = (select private.current_school_id()) and owner_id = (select auth.uid()));

create policy "update own or as school admin" on public.classrooms
  for update to authenticated
  using (
    school_id = (select private.current_school_id())
    and (owner_id = (select auth.uid()) or (select private.is_school_admin()))
  )
  with check (school_id = (select private.current_school_id()));

create policy "delete own or as school admin" on public.classrooms
  for delete to authenticated
  using (
    school_id = (select private.current_school_id())
    and (owner_id = (select auth.uid()) or (select private.is_school_admin()))
  );

-- students -----------------------------------------------------------------------
create policy "read in manageable classrooms" on public.students
  for select to authenticated
  using (classroom_id in (select private.manageable_classroom_ids()));

create policy "add to manageable classrooms" on public.students
  for insert to authenticated
  with check (
    classroom_id in (select private.manageable_classroom_ids())
    and school_id = (select private.current_school_id())
  );

create policy "update in manageable classrooms" on public.students
  for update to authenticated
  using (classroom_id in (select private.manageable_classroom_ids()))
  with check (classroom_id in (select private.manageable_classroom_ids()));

create policy "delete in manageable classrooms" on public.students
  for delete to authenticated
  using (classroom_id in (select private.manageable_classroom_ids()));

-- random_sessions ----------------------------------------------------------------
create policy "read own or as school admin" on public.random_sessions
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or (school_id = (select private.current_school_id()) and (select private.is_school_admin()))
  );

create policy "start own sessions" on public.random_sessions
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and school_id = (select private.current_school_id())
    and (classroom_id is null or classroom_id in (select private.manageable_classroom_ids()))
  );

create policy "update own sessions" on public.random_sessions
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "delete own sessions" on public.random_sessions
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- random_results -----------------------------------------------------------------
create policy "read own or as school admin" on public.random_results
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or (school_id = (select private.current_school_id()) and (select private.is_school_admin()))
  );

create policy "record own results" on public.random_results
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and school_id = (select private.current_school_id())
    and session_id in (select s.id from public.random_sessions s where s.user_id = (select auth.uid()))
    and (classroom_id is null or classroom_id in (select private.manageable_classroom_ids()))
    and (student_id is null or student_id in (select st.id from public.students st))
  );

create policy "update own results" on public.random_results
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "delete own results" on public.random_results
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- settings -------------------------------------------------------------------------
create policy "own random settings" on public.random_settings
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "own sound settings" on public.sound_settings
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- Grants. Explicit and least-privilege: `anon` gets nothing, whatever the
-- project's default privileges are.
-- -----------------------------------------------------------------------------

revoke all on table
  public.schools, public.users, public.classrooms, public.students,
  public.random_sessions, public.random_results, public.random_settings, public.sound_settings
  from public, anon, authenticated;

-- The join code is deliberately not readable: column privileges hide it, get_join_code() reveals it to admins.
grant select (id, name, created_at), update (name) on public.schools to authenticated;
-- Role and school only change through the functions below.
grant select, update (display_name) on public.users to authenticated;
grant select, insert, update, delete on
  public.classrooms, public.students, public.random_sessions, public.random_results,
  public.random_settings, public.sound_settings
  to authenticated;

grant all on table
  public.schools, public.users, public.classrooms, public.students,
  public.random_sessions, public.random_results, public.random_settings, public.sound_settings
  to service_role;

-- -----------------------------------------------------------------------------
-- RPC functions (called through supabase.rpc)
--
-- Errors carry a stable machine-readable message (e.g. 'join_code_invalid') that the
-- app translates; SQLSTATE P0001 is returned as HTTP 400 by the Data API.
-- -----------------------------------------------------------------------------

-- Create a school and become its owner.
create function public.create_school(school_name text, display_name text default null)
returns table (school_id uuid, school_name_out text, join_code text, member_role text)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  uid uuid := (select auth.uid());
  clean_name text := btrim(coalesce(school_name, ''));
  clean_display text := left(btrim(coalesce(display_name, '')), 120);
  new_id uuid;
  new_code text;
  attempt integer := 0;
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if char_length(clean_name) not between 1 and 100 then
    raise exception 'school_name_invalid';
  end if;
  if exists (select 1 from public.users u where u.id = uid and u.school_id is not null) then
    raise exception 'already_in_school';
  end if;

  loop
    begin
      new_code := private.generate_join_code();
      insert into public.schools (name, join_code) values (clean_name, new_code) returning id into new_id;
      exit;
    exception when unique_violation then
      attempt := attempt + 1;
      if attempt >= 5 then
        raise;
      end if;
    end;
  end loop;

  insert into public.users as u (id, school_id, role, display_name)
  values (uid, new_id, 'owner', clean_display)
  on conflict (id) do update
    set school_id = excluded.school_id,
        role = 'owner',
        display_name = case when excluded.display_name <> '' then excluded.display_name else u.display_name end;

  return query select new_id, clean_name, new_code, 'owner'::text;
end;
$$;

-- Join a school with its invite code, as a teacher.
create function public.join_school(join_code text, display_name text default null)
returns table (school_id uuid, school_name_out text, member_role text)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  uid uuid := (select auth.uid());
  clean_code text := upper(regexp_replace(coalesce(join_code, ''), '[^A-Za-z0-9]', '', 'g'));
  clean_display text := left(btrim(coalesce(display_name, '')), 120);
  target public.schools;
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if exists (select 1 from public.users u where u.id = uid and u.school_id is not null) then
    raise exception 'already_in_school';
  end if;
  select * into target from public.schools s where s.join_code = clean_code;
  if not found then
    raise exception 'join_code_invalid';
  end if;

  insert into public.users as u (id, school_id, role, display_name)
  values (uid, target.id, 'teacher', clean_display)
  on conflict (id) do update
    set school_id = excluded.school_id,
        role = 'teacher',
        display_name = case when excluded.display_name <> '' then excluded.display_name else u.display_name end;

  return query select target.id, target.name, 'teacher'::text;
end;
$$;

-- The invite code of the caller's school (owner/admin only).
create function public.get_join_code()
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  code text;
begin
  if not private.is_school_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  select s.join_code into code from public.schools s where s.id = private.current_school_id();
  return code;
end;
$$;

-- Replace the invite code; the old one stops working (owner/admin only).
create function public.regenerate_join_code()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  code text;
  attempt integer := 0;
begin
  if not private.is_school_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  loop
    begin
      code := private.generate_join_code();
      update public.schools s set join_code = code where s.id = private.current_school_id();
      return code;
    exception when unique_violation then
      attempt := attempt + 1;
      if attempt >= 5 then
        raise;
      end if;
    end;
  end loop;
end;
$$;

-- Promote a member to admin or back to teacher (school owner only).
create function public.set_member_role(member_id uuid, new_role text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  caller public.users;
begin
  select * into caller from public.users u where u.id = uid;
  if caller.id is null or caller.role <> 'owner' or caller.school_id is null then
    raise exception 'not_owner' using errcode = '42501';
  end if;
  if new_role not in ('admin', 'teacher') then
    raise exception 'role_invalid';
  end if;
  if member_id = uid then
    raise exception 'cannot_change_own_role';
  end if;
  update public.users u set role = new_role where u.id = member_id and u.school_id = caller.school_id;
  if not found then
    raise exception 'member_not_found';
  end if;
end;
$$;

-- Replace a classroom's whole roster in one transaction (import → "replace all").
-- SECURITY INVOKER: runs with the caller's rights, so every row still goes through RLS.
create function public.replace_classroom_students(target_classroom uuid, new_students jsonb)
returns setof public.students
language plpgsql
security invoker
set search_path = ''
as $$
declare
  classroom_school uuid;
begin
  if jsonb_typeof(new_students) is distinct from 'array' then
    raise exception 'students_invalid';
  end if;
  select c.school_id into classroom_school from public.classrooms c where c.id = target_classroom;
  if classroom_school is null then
    raise exception 'classroom_not_found';
  end if;

  delete from public.students s where s.classroom_id = target_classroom;

  return query
  insert into public.students (id, school_id, classroom_id, student_code, number, first_name, last_name, nickname, avatar)
  select
    coalesce((item ->> 'id')::uuid, gen_random_uuid()),
    classroom_school,
    target_classroom,
    coalesce(item ->> 'student_code', ''),
    (item ->> 'number')::integer,
    item ->> 'first_name',
    coalesce(item ->> 'last_name', ''),
    coalesce(item ->> 'nickname', ''),
    coalesce(item ->> 'avatar', '')
  from jsonb_array_elements(new_students) as item
  returning *;
end;
$$;

revoke all on function public.create_school(text, text) from public, anon;
revoke all on function public.join_school(text, text) from public, anon;
revoke all on function public.get_join_code() from public, anon;
revoke all on function public.regenerate_join_code() from public, anon;
revoke all on function public.set_member_role(uuid, text) from public, anon;
revoke all on function public.replace_classroom_students(uuid, jsonb) from public, anon;

grant execute on function public.create_school(text, text) to authenticated;
grant execute on function public.join_school(text, text) to authenticated;
grant execute on function public.get_join_code() to authenticated;
grant execute on function public.regenerate_join_code() to authenticated;
grant execute on function public.set_member_role(uuid, text) to authenticated;
grant execute on function public.replace_classroom_students(uuid, jsonb) to authenticated;
