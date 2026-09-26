-- Project progress now moves with checklists: each task counts 100% when
-- completed, otherwise the share of its checklist that is ticked (0% with no
-- checklist); a project is the average of its tasks. Defined once here and
-- used by both the dashboard and the project page.

create function private.task_progress(p_task bigint, p_status text) returns numeric
language sql stable security definer set search_path = '' as $$
    select case when p_status = 'completed' then 100
                else coalesce((select 100.0 * count(*) filter (where i.is_completed) / nullif(count(*), 0)
                               from public.task_checklist_items i
                               join public.task_checklists c on c.id = i.checklist_id
                               where c.task_id = p_task), 0) end
$$;
grant execute on function private.task_progress(bigint, text) to authenticated;

-- Security invoker: RLS on tasks means callers only average what they can see.
create function public.project_progress(p_project bigint) returns int
language sql stable set search_path = '' as $$
    select coalesce(round(avg(private.task_progress(t.id, t.status)))::int, 0)
    from public.tasks t where t.project_id = p_project
$$;
revoke execute on function public.project_progress(bigint) from public, anon;
grant execute on function public.project_progress(bigint) to authenticated;

create or replace function public.dashboard(p_today date default current_date, p_now time default localtime) returns jsonb
language sql stable set search_path = '' as $$
    with mine as (
        select p.*, private.project_role(p.id) as role,
               exists (select 1 from public.project_members m where m.project_id = p.id and m.user_id = auth.uid()) as is_member,
               public.project_progress(p.id) as progress
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

