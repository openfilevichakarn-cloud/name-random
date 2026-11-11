-- =============================================================================
-- Class Ranking: per-student totals of one classroom.
--
-- The ranking needs every result of a classroom in a time window. Summing in the database keeps
-- the response to one row per student instead of every result row.
-- =============================================================================

-- The ranking filters one classroom by time. A composite index serves that filter and still
-- covers the classroom_id foreign key (leftmost column), so the single-column index can go.
create index random_results_classroom_created_idx on public.random_results (classroom_id, created_at desc);
drop index public.random_results_classroom_id_idx;

-- Stars (points) and picks per student of a classroom.
--   * stars count every draw type, team splits included (Team Battle wins are written there);
--   * picks count single and multiple draws only: a team split puts everyone in a team;
--   * only the caller's own draws are counted, like the History page.
-- SECURITY INVOKER: the caller's RLS policies apply on top of the filter.
create function public.classroom_student_stats(
  target_classroom uuid,
  from_ts timestamptz default null,
  to_ts timestamptz default null
)
returns table (student_id uuid, stars bigint, picks bigint, last_picked_at timestamptz)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    r.student_id,
    coalesce(sum(r.points), 0) as stars,
    count(*) filter (where r.draw_type <> 'team') as picks,
    max(r.created_at) filter (where r.draw_type <> 'team') as last_picked_at
  from public.random_results r
  where r.classroom_id = target_classroom
    and r.user_id = (select auth.uid())
    and r.student_id is not null
    and (from_ts is null or r.created_at >= from_ts)
    and (to_ts is null or r.created_at < to_ts)
  group by r.student_id;
$$;

revoke all on function public.classroom_student_stats(uuid, timestamptz, timestamptz) from public, anon;
grant execute on function public.classroom_student_stats(uuid, timestamptz, timestamptz) to authenticated;
