-- =============================================================================
-- Row Level Security and API surface tests for the initial schema.
-- Run with supabase/tests/run.sh (applies the shim, the migrations, then this file).
-- Every check prints "ok - …"; the first failure aborts with a non-zero exit code.
-- =============================================================================

\set ON_ERROR_STOP on
set client_min_messages = notice;

-- -----------------------------------------------------------------------------
-- Test helpers
-- -----------------------------------------------------------------------------

create schema tests;
grant usage on schema tests to anon, authenticated, service_role;

-- Act as a signed-in user, exactly like the Data API does for a request with that user's JWT.
create function tests.login(uid uuid) returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;

create function tests.login_anon() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  execute 'set local role anon';
end $$;

-- Back to the migration owner (bypasses RLS) for setup and verification.
create function tests.as_admin() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
end $$;

create function tests.ok(condition boolean, description text) returns void language plpgsql as $$
begin
  if condition is distinct from true then
    raise exception 'not ok - %', description;
  end if;
  raise notice 'ok - %', description;
end $$;

create function tests.eq(actual text, expected text, description text) returns void language plpgsql as $$
begin
  if actual is distinct from expected then
    raise exception 'not ok - % (expected %, got %)', description, coalesce(expected, 'NULL'), coalesce(actual, 'NULL');
  end if;
  raise notice 'ok - %', description;
end $$;

-- Number of rows a query returns for the current role.
create function tests.rows(query text) returns bigint language plpgsql as $$
declare n bigint;
begin
  execute format('select count(*) from (%s) as q', query) into n;
  return n;
end $$;

-- Number of rows a write statement touched for the current role.
create function tests.affected(statement text) returns bigint language plpgsql as $$
declare n bigint;
begin
  execute statement;
  get diagnostics n = row_count;
  return n;
end $$;

-- The statement must fail with this SQLSTATE (and message fragment, when given).
create function tests.fails(statement text, expected_state text, description text, expected_message text default null)
returns void language plpgsql as $$
begin
  begin
    execute statement;
  exception when others then
    if sqlstate = expected_state and (expected_message is null or sqlerrm like '%' || expected_message || '%') then
      raise notice 'ok - % [% %]', description, sqlstate, sqlerrm;
      return;
    end if;
    raise exception 'not ok - %: expected % %, got % %', description, expected_state, coalesce(expected_message, ''), sqlstate, sqlerrm;
  end;
  raise exception 'not ok - %: statement succeeded but should have failed', description;
end $$;

begin;

-- -----------------------------------------------------------------------------
-- Static checks
-- -----------------------------------------------------------------------------

select tests.eq((
  select count(*)::text from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
), '0', 'every table in public has RLS enabled');

select tests.eq((
  select count(*)::text from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
    and (has_table_privilege('anon', c.oid, 'select') or has_table_privilege('anon', c.oid, 'insert')
      or has_table_privilege('anon', c.oid, 'update') or has_table_privilege('anon', c.oid, 'delete'))
), '0', 'anon has no privilege on any table');

select tests.eq((
  select string_agg(p.proname, ', ') from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('public', 'private') and has_function_privilege('anon', p.oid, 'execute')
    and p.prorettype <> 'trigger'::regtype
), null, 'anon cannot execute any app function');

select tests.eq((
  select string_agg(p.proname, ', ' order by p.proname) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prosecdef
), 'create_school, get_join_code, join_school, regenerate_join_code, set_member_role',
  'only the intended functions in public are SECURITY DEFINER');

select tests.eq((
  select count(*)::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('public', 'private') and p.prosecdef
    and not coalesce(p.proconfig @> array['search_path=""'], false)
), '0', 'every SECURITY DEFINER function pins an empty search_path');

-- -----------------------------------------------------------------------------
-- Accounts (fixed ids). The sign-up trigger creates the profiles.
-- -----------------------------------------------------------------------------

\set alice '''a0000000-0000-4000-8000-000000000001'''
\set bob   '''a0000000-0000-4000-8000-000000000002'''
\set frank '''a0000000-0000-4000-8000-000000000003'''
\set carol '''a0000000-0000-4000-8000-000000000004'''
\set dave  '''a0000000-0000-4000-8000-000000000005'''

insert into auth.users (id, email, raw_user_meta_data) values
  (:alice, 'alice@school-a.test', '{"display_name": "ครูอลิส"}'),
  (:bob, 'bob@school-a.test', '{"display_name": "ครูบ๊อบ"}'),
  (:frank, 'frank@school-a.test', '{}'),
  (:carol, 'carol@school-b.test', '{"display_name": "ครูแคโรล"}'),
  (:dave, 'dave@nowhere.test', '{"display_name": "   "}');

select tests.eq((select count(*)::text from public.users), '5', 'sign-up trigger creates a profile per account');
select tests.eq((select display_name from public.users where id = :alice), 'ครูอลิส', 'display name comes from sign-up metadata');
select tests.eq((select display_name from public.users where id = :dave), 'dave', 'blank display name falls back to the e-mail name');
select tests.eq((select role || ':' || coalesce(school_id::text, 'none') from public.users where id = :bob), 'teacher:none',
  'new accounts are teachers without a school');

-- -----------------------------------------------------------------------------
-- Anonymous visitors
-- -----------------------------------------------------------------------------

select tests.login_anon();
select tests.fails('select * from public.classrooms', '42501', 'anon cannot read classrooms');
select tests.fails('select * from public.users', '42501', 'anon cannot read users');
select tests.fails('select id from public.schools', '42501', 'anon cannot read schools');
select tests.fails($$select * from public.create_school('x')$$, '42501', 'anon cannot create a school');
select tests.fails($$select * from public.join_school('ABCDEFGH')$$, '42501', 'anon cannot try join codes');

-- -----------------------------------------------------------------------------
-- Schools: create, join, invite code
-- -----------------------------------------------------------------------------

select tests.login(:alice);
select school_id as school_a, join_code as code_a from public.create_school('โรงเรียนเอ', 'ครูอลิส') \gset
select tests.ok(:'code_a' ~ '^[A-HJ-KMNP-Z2-9]{8}$', 'join code is 8 characters without look-alikes');
select tests.eq((select role from public.users where id = :alice), 'owner', 'the creator owns the school');
select tests.eq(public.get_join_code(), :'code_a', 'the owner can read the join code');
select tests.fails($$select * from public.create_school('อีกโรงเรียน')$$, 'P0001', 'one school per account', 'already_in_school');

select tests.login(:bob);
select tests.fails($$select * from public.join_school('WRONG123')$$, 'P0001', 'a wrong join code is refused', 'join_code_invalid');
select tests.eq((select school_id::text from public.join_school(lower(:'code_a') || ' ', 'ครูบ๊อบ')), :'school_a',
  'joining is case- and whitespace-insensitive');
select tests.eq((select role from public.users where id = :bob), 'teacher', 'members join as teachers');
select tests.fails(format('select * from public.join_school(%L)', :'code_a'), 'P0001', 'cannot join twice', 'already_in_school');
select tests.fails('select public.get_join_code()', '42501', 'teachers cannot read the join code', 'not_admin');
select tests.fails('select join_code from public.schools', '42501', 'the join_code column is not readable');
select tests.eq(tests.rows('select id, name from public.schools')::text, '1', 'members see their own school only');

select tests.login(:frank);
select tests.ok((select count(*) from public.join_school(:'code_a')) = 1, 'a second teacher joins school A');

select tests.login(:carol);
select school_id as school_b from public.create_school('โรงเรียนบี') \gset

select tests.login(:dave);
select tests.eq(tests.rows('select * from public.users')::text, '1', 'without a school you only see yourself');
select tests.eq(tests.rows('select id from public.schools')::text, '0', 'without a school you see no school');
select tests.fails('select private.generate_join_code()', '42501', 'internal helpers are not callable');

-- -----------------------------------------------------------------------------
-- Classrooms
-- -----------------------------------------------------------------------------

select tests.login(:bob);
insert into public.classrooms (school_id, owner_id, name) values (:'school_a', :bob, 'ป.5/1') returning id as room_bob \gset
select tests.fails(format($$insert into public.classrooms (school_id, owner_id, name) values (%L, %L, 'x')$$, :'school_a', :alice),
  '42501', 'cannot create a classroom for someone else');
select tests.fails(format($$insert into public.classrooms (school_id, owner_id, name) values (%L, %L, 'x')$$, :'school_b', :bob),
  '42501', 'cannot create a classroom in another school');
select tests.fails(format($$update public.classrooms set owner_id = %L where id = %L$$, :frank, :'room_bob'),
  '42501', 'classroom ownership cannot be reassigned', 'cannot be changed');
select tests.eq(tests.affected(format($$update public.classrooms set name = 'ป.5/1 ห้องเรียนสีฟ้า' where id = %L$$, :'room_bob'))::text,
  '1', 'the owner renames their classroom');

select tests.login(:alice);
insert into public.classrooms (school_id, owner_id, name) values (:'school_a', :alice, 'ป.6/1') returning id as room_alice \gset

select tests.login(:frank);
select tests.eq(tests.rows('select * from public.classrooms')::text, '0', 'a teacher does not see colleagues'' classrooms');
select tests.eq(tests.affected(format($$update public.classrooms set name = 'x' where id = %L$$, :'room_bob'))::text, '0',
  'a teacher cannot rename a colleague''s classroom');
select tests.eq(tests.affected(format('delete from public.classrooms where id = %L', :'room_bob'))::text, '0',
  'a teacher cannot delete a colleague''s classroom');

select tests.login(:alice);
select tests.eq(tests.rows('select * from public.classrooms')::text, '2', 'the school owner sees every classroom of the school');

select tests.login(:carol);
select tests.eq(tests.rows('select * from public.classrooms')::text, '0', 'another school sees none of school A''s classrooms');
select tests.eq(tests.affected(format('delete from public.classrooms where id = %L', :'room_bob'))::text, '0',
  'another school cannot delete school A''s classrooms, even knowing the id');
select tests.eq(tests.rows('select * from public.users')::text, '1', 'another school sees none of school A''s members');

-- -----------------------------------------------------------------------------
-- Students
-- -----------------------------------------------------------------------------

select tests.login(:bob);
insert into public.students (school_id, classroom_id, number, first_name, last_name, nickname, student_code, avatar)
values
  (:'school_a', :'room_bob', 1, 'มานี', 'มีตา', 'นี', 'A001', 'emoji:🦊'),
  (:'school_a', :'room_bob', 2, 'ปิติ', 'พอใจ', '', 'A002', 'bot:1234abcd'),
  (:'school_a', :'room_bob', 3, 'ชูใจ', 'เลิศล้ำ', '', '', '');
select id as student_manee from public.students where number = 1 and classroom_id = :'room_bob' \gset

select tests.fails(format($$insert into public.students (school_id, classroom_id, number, first_name) values (%L, %L, 1, 'ซ้ำ')$$,
  :'school_a', :'room_bob'), '23505', 'roll numbers are unique within a classroom');
select tests.fails(format($$insert into public.students (school_id, classroom_id, number, first_name, student_code) values (%L, %L, 9, 'ซ้ำ', 'a001')$$,
  :'school_a', :'room_bob'), '23505', 'student codes are unique within a classroom, ignoring case');
select tests.fails(format($$insert into public.students (school_id, classroom_id, number, first_name) values (%L, %L, 9, 'x')$$,
  :'school_b', :'room_bob'), '42501', 'a student cannot carry another school''s id');
select tests.fails(format($$insert into public.students (school_id, classroom_id, number, first_name, avatar) values (%L, %L, 9, 'x', 'https://evil.test/x.png')$$,
  :'school_a', :'room_bob'), '23514', 'avatars cannot be URLs');
select tests.fails(format($$update public.students set classroom_id = %L where id = %L$$, :'room_alice', :'student_manee'),
  '42501', 'students cannot be moved to a classroom you do not manage');

select tests.login(:frank);
select tests.eq(tests.rows('select * from public.students')::text, '0', 'a teacher does not see colleagues'' students');
select tests.fails(format($$insert into public.students (school_id, classroom_id, number, first_name) values (%L, %L, 9, 'x')$$,
  :'school_a', :'room_bob'), '42501', 'a teacher cannot add students to a colleague''s classroom');
select tests.fails(format($$select * from public.replace_classroom_students(%L, '[]')$$, :'room_bob'),
  'P0001', 'a teacher cannot replace a colleague''s roster', 'classroom_not_found');

select tests.login(:carol);
select tests.eq(tests.rows('select * from public.students')::text, '0', 'another school sees no students of school A');
select tests.eq(tests.affected(format($$update public.students set first_name = 'x' where id = %L$$, :'student_manee'))::text, '0',
  'another school cannot edit a student, even knowing the id');

select tests.login(:alice);
select tests.eq(tests.rows('select * from public.students')::text, '3', 'the school owner sees students of every classroom');

-- Replacing a roster is atomic: a failing batch leaves the old roster untouched.
select tests.login(:bob);
select tests.eq((select count(*)::text from public.replace_classroom_students(:'room_bob',
  '[{"number": 1, "first_name": "ใหม่หนึ่ง"}, {"number": 2, "first_name": "ใหม่สอง", "student_code": "A001"}]')), '2',
  'a roster can be replaced with overlapping numbers and codes');
select tests.fails(format($$select * from public.replace_classroom_students(%L, '[{"number": 5, "first_name": "ก"}, {"number": 5, "first_name": "ข"}]')$$,
  :'room_bob'), '23505', 'a replacement with duplicate numbers is rejected');
select tests.eq((select string_agg(first_name, ',' order by number) from public.students where classroom_id = :'room_bob'),
  'ใหม่หนึ่ง,ใหม่สอง', 'a rejected replacement leaves the previous roster intact');
select id as student_new from public.students where number = 1 and classroom_id = :'room_bob' \gset

-- -----------------------------------------------------------------------------
-- Random sessions and results
-- -----------------------------------------------------------------------------

select tests.login(:alice);
insert into public.random_sessions (school_id, user_id, classroom_id, classroom_name, source)
values (:'school_a', :alice, :'room_alice', 'ป.6/1', 'students') returning id as session_alice \gset

select tests.login(:bob);
insert into public.random_sessions (school_id, user_id, classroom_id, classroom_name, source, rules)
values (:'school_a', :bob, :'room_bob', 'ป.5/1', 'students', '{"repeatPolicy": "no-repeat"}') returning id as session_bob \gset
insert into public.random_results (school_id, user_id, session_id, classroom_id, student_id, display_name, student_number, mode, draw_type, draw_index, pick_index)
values (:'school_a', :bob, :'session_bob', :'room_bob', :'student_new', 'ใหม่หนึ่ง', 1, 'wheel', 'single', 1, 1)
returning id as result_bob \gset

select tests.fails(format($$insert into public.random_sessions (school_id, user_id, source) values (%L, %L, 'numbers')$$, :'school_a', :alice),
  '42501', 'cannot start a session in someone else''s name');
select tests.fails(format($$insert into public.random_sessions (school_id, user_id, classroom_id, source) values (%L, %L, %L, 'students')$$,
  :'school_a', :bob, :'room_alice'), '42501', 'cannot start a session on a classroom you do not manage');
select tests.fails(format($$insert into public.random_results (school_id, user_id, session_id, display_name, mode, draw_type, draw_index, pick_index) values (%L, %L, %L, 'x', 'wheel', 'single', 1, 1)$$,
  :'school_a', :bob, :'session_alice'), '42501', 'cannot add results to someone else''s session');
select tests.fails(format($$insert into public.random_results (school_id, user_id, session_id, display_name, mode, draw_type, draw_index, pick_index) values (%L, %L, %L, 'x', 'lottery', 'single', 1, 1)$$,
  :'school_a', :bob, :'session_bob'), '23514', 'unknown modes are rejected');
select tests.eq(tests.affected(format('update public.random_results set points = 3 where id = %L', :'result_bob'))::text, '1',
  'a teacher awards stars on their own results');
select tests.fails(format('update public.random_results set session_id = %L where id = %L', :'session_alice', :'result_bob'),
  '42501', 'results cannot be moved between sessions', 'cannot be changed');
select tests.eq(tests.affected(format('update public.random_sessions set ended_at = now() where id = %L', :'session_bob'))::text, '1',
  'a teacher ends their own round');

select tests.login(:frank);
select tests.eq(tests.rows('select * from public.random_results')::text, '0', 'a teacher does not see colleagues'' results');
select tests.eq(tests.rows('select * from public.random_sessions')::text, '0', 'a teacher does not see colleagues'' rounds');

select tests.login(:carol);
select tests.eq(tests.rows('select * from public.random_results')::text, '0', 'another school sees no results of school A');

select tests.login(:alice);
select tests.eq(tests.rows('select * from public.random_results')::text, '1', 'the school owner sees every result of the school');
select tests.eq(tests.affected(format('delete from public.random_results where id = %L', :'result_bob'))::text, '0',
  'the school owner cannot delete a teacher''s results');

-- -----------------------------------------------------------------------------
-- Settings
-- -----------------------------------------------------------------------------

select tests.login(:bob);
insert into public.random_settings (user_id, appearance) values (:bob, '{"accent": "pink"}')
on conflict (user_id) do update set appearance = excluded.appearance;
insert into public.random_settings (user_id, appearance) values (:bob, '{"accent": "cyan"}')
on conflict (user_id) do update set appearance = excluded.appearance;
insert into public.sound_settings (user_id, master_volume, theme) values (:bob, 0.35, 'arcade')
on conflict (user_id) do update set master_volume = excluded.master_volume, theme = excluded.theme;
select tests.eq((select appearance ->> 'accent' from public.random_settings), 'cyan', 'settings upsert keeps one row per user');
select tests.fails(format($$insert into public.sound_settings (user_id) values (%L)$$, :alice), '42501',
  'cannot write someone else''s settings');
select tests.fails($$insert into public.sound_settings (user_id, master_volume) values (auth.uid(), 2) on conflict (user_id) do update set master_volume = excluded.master_volume$$,
  '23514', 'volumes stay within 0–1');

select tests.login(:alice);
select tests.eq(tests.rows('select * from public.random_settings')::text, '0', 'settings are private, even to the school owner');
select tests.eq(tests.rows('select * from public.sound_settings')::text, '0', 'sound settings are private, even to the school owner');

-- -----------------------------------------------------------------------------
-- Profiles and school settings
-- -----------------------------------------------------------------------------

select tests.login(:bob);
select tests.eq(tests.affected($$update public.users set display_name = 'ครูบ๊อบบี้' where id = auth.uid()$$)::text, '1',
  'users edit their own display name');
select tests.fails($$update public.users set role = 'owner' where id = auth.uid()$$, '42501', 'users cannot promote themselves');
select tests.fails(format($$update public.users set school_id = %L where id = auth.uid()$$, :'school_b'), '42501',
  'users cannot move themselves to another school');
select tests.eq(tests.affected(format($$update public.users set display_name = 'x' where id = %L$$, :alice))::text, '0',
  'users cannot edit someone else''s profile');
select tests.eq(tests.rows('select * from public.users')::text, '3', 'members see the people of their own school');
select tests.eq(tests.affected($$update public.schools set name = 'ชื่อใหม่'$$)::text, '0', 'teachers cannot rename the school');

select tests.login(:alice);
select tests.eq(tests.affected($$update public.schools set name = 'โรงเรียนเอ (ใหม่)'$$)::text, '1', 'the owner renames the school');
select tests.fails($$update public.schools set join_code = 'AAAAAAAA'$$, '42501', 'the join code cannot be set directly');

-- -----------------------------------------------------------------------------
-- Roles
-- -----------------------------------------------------------------------------

select tests.login(:bob);
select tests.fails(format($$select public.set_member_role(%L, 'admin')$$, :frank), '42501', 'only the owner changes roles', 'not_owner');

select tests.login(:alice);
select tests.fails(format($$select public.set_member_role(%L, 'owner')$$, :frank), 'P0001', 'ownership cannot be handed out', 'role_invalid');
select tests.fails(format($$select public.set_member_role(%L, 'teacher')$$, :alice), 'P0001', 'the owner cannot demote themselves', 'cannot_change_own_role');
select tests.fails(format($$select public.set_member_role(%L, 'admin')$$, :carol), 'P0001', 'members of other schools cannot be changed', 'member_not_found');
select public.set_member_role(:frank, 'admin');

select tests.login(:frank);
select tests.eq(tests.rows('select * from public.classrooms')::text, '2', 'an admin sees every classroom of the school');
select tests.eq(tests.rows('select * from public.random_results')::text, '1', 'an admin sees every result of the school');
select tests.ok(public.get_join_code() = :'code_a', 'an admin can read the join code');
select regenerate_join_code as code_a2 from public.regenerate_join_code() \gset
select tests.ok(:'code_a2' <> :'code_a', 'an admin can replace the join code');

select tests.login(:dave);
select tests.fails(format('select * from public.join_school(%L)', :'code_a'), 'P0001', 'the old join code stops working', 'join_code_invalid');
select tests.eq((select school_id::text from public.join_school(:'code_a2')), :'school_a', 'the new join code works');

-- -----------------------------------------------------------------------------
-- Deletion
-- -----------------------------------------------------------------------------

select tests.login(:bob);
select tests.eq(tests.affected(format('delete from public.classrooms where id = %L', :'room_bob'))::text, '1',
  'the owner deletes their classroom');

select tests.as_admin();
select tests.eq((select count(*)::text from public.students where classroom_id = :'room_bob'), '0',
  'deleting a classroom deletes its students');
select tests.eq((select coalesce(classroom_id::text, 'null') || ':' || display_name from public.random_results where id = :'result_bob'),
  'null:ใหม่หนึ่ง', 'history keeps its snapshot when the classroom is deleted');

delete from auth.users where id = :bob;
select tests.eq((select count(*)::text from public.users where id = :bob), '0', 'deleting an account deletes the profile');
select tests.eq((select count(*)::text from public.random_results where user_id = :bob), '0', 'and that account''s history');
select tests.eq((select count(*)::text from public.random_settings where user_id = :bob), '0', 'and that account''s settings');

rollback;

\echo 'All RLS tests passed.'
