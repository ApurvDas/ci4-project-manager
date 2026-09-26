-- Site admins: owner-level access to every project, member or not.
-- The flag is set only from the database (SQL editor / Studio): profiles has no
-- update policy, so nobody can grant it to themselves through the API.

alter table public.profiles add column is_admin boolean not null default false;

-- A member's own role wins; otherwise a site admin acts as owner. Every policy
-- and RPC goes through this, so admins need no special cases elsewhere.
create or replace function private.project_role(pid bigint) returns text
language sql stable security definer set search_path = '' as $$
    select coalesce(
        (select role from public.project_members where project_id = pid and user_id = auth.uid()),
        (select 'owner' from public.profiles where id = auth.uid() and is_admin and exists (select 1 from public.projects where id = pid))
    )
$$;

-- The caller's effective role, for the UI to decide which controls to show.
create function public.my_project_role(p_project bigint) returns text
language sql stable set search_path = '' as $$
    select private.project_role(p_project)
$$;
revoke execute on function public.my_project_role(bigint) from public, anon;
grant execute on function public.my_project_role(bigint) to authenticated;

-- Dashboard and project list: the caller's own projects, plus (for a site
-- admin) the other projects going on, kept separate.
-- p_today / p_now are the viewer's local date and time, so "overdue" and
-- "due today" follow their clock rather than the server's UTC one.
drop function public.dashboard();
create function public.dashboard(p_today date default current_date, p_now time default localtime) returns jsonb
language sql stable set search_path = '' as $$
    with mine as (
        select p.*, private.project_role(p.id) as role,
               exists (select 1 from public.project_members m where m.project_id = p.id and m.user_id = auth.uid()) as is_member,
               (select case when count(*) = 0 then 0
                            else round(count(*) filter (where t.status = 'completed') * 100.0 / count(*)) end
                from public.tasks t where t.project_id = p.id) as progress
        from public.projects p
    ), assigned as (
        select t.*, p.name as project_name
        from public.tasks t
        join public.task_assignees a on a.task_id = t.id and a.user_id = auth.uid()
        join public.projects p on p.id = t.project_id
    )
    select jsonb_build_object(
        -- Counts cover only the caller's own projects, not ones seen as a site admin.
        'projectCounts', (select coalesce(jsonb_object_agg(status, n), '{}') from (select status, count(*) n from mine where is_member group by status) s),
        'taskCounts', (select jsonb_build_object(
            'assigned',  count(*),
            'overdue',   count(*) filter (where status <> 'completed'
                                          and (due_date < p_today or (due_date = p_today and due_time < p_now))),
            'due_today', count(*) filter (where status <> 'completed'
                                          and due_date = p_today and (due_time is null or due_time >= p_now)),
            'completed', count(*) filter (where status = 'completed')) from assigned),
        'myProjects', (select coalesce(jsonb_agg(to_jsonb(m) order by m.due_date nulls last, m.id desc), '[]') from mine m where is_member),
        'otherProjects', (select coalesce(jsonb_agg(to_jsonb(m) order by m.due_date nulls last, m.id desc), '[]') from mine m where not is_member),
        'myTasks', (select coalesce(jsonb_agg(to_jsonb(a) order by a.due_date nulls last, a.due_time nulls last, a.id), '[]')
                    from (select * from assigned where status <> 'completed' order by due_date nulls last, due_time nulls last, id limit 8) a),
        'notifications', (select coalesce(jsonb_agg(to_jsonb(n) order by n.created_at desc), '[]')
                          from (select * from public.notifications where user_id = auth.uid() order by created_at desc limit 5) n),
        'unread', (select count(*) from public.notifications where user_id = auth.uid() and read_at is null)
    )
$$;

revoke execute on function public.dashboard(date, time) from public, anon;
grant execute on function public.dashboard(date, time) to authenticated;
