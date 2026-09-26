-- Business logic, ported from app/Libraries/{ProjectService,TaskService,NotificationService}.php.
-- Each RPC is security definer and does its own role check, so the rules live
-- here and the browser is never trusted. Errors: P0002 = not found (also what a
-- non-member gets), 42501 = forbidden, 22023 = invalid input.

-- ---------------------------------------------------------------- helpers

-- The caller's role; raises "not found" for a non-member, "forbidden" below min_role.
create function private.require_role(pid bigint, min_role text) returns text
language plpgsql stable security definer set search_path = '' as $$
declare
    r text := private.project_role(pid);
begin
    if auth.uid() is null or r is null then
        raise exception 'Not found' using errcode = 'P0002';
    end if;
    if private.role_rank(r) < private.role_rank(min_role) then
        raise exception 'You do not have permission to do that.' using errcode = '42501';
    end if;
    return r;
end $$;

create function private.username(uid uuid) returns text
language sql stable security definer set search_path = '' as $$
    select username from public.profiles where id = uid
$$;

create function private.log(p_project bigint, p_entity text, p_entity_id bigint, p_action text,
                            p_description text, p_old jsonb default null, p_new jsonb default null) returns void
language sql security definer set search_path = '' as $$
    insert into public.activity_logs (user_id, project_id, entity_type, entity_id, action, description, old_values, new_values)
    values (auth.uid(), p_project, p_entity, p_entity_id, p_action, left(p_description, 255),
            nullif(p_old, '{}'::jsonb), nullif(p_new, '{}'::jsonb))
$$;

-- Only the keys of p_after whose value differs from p_before (ActivityLogModel::diff).
create function private.diff(p_before jsonb, p_after jsonb, out old_values jsonb, out new_values jsonb)
language sql immutable as $$
    select coalesce(jsonb_object_agg(k, p_before -> k), '{}'), coalesce(jsonb_object_agg(k, p_after -> k), '{}')
    from jsonb_object_keys(p_after) k
    where (p_before ->> k) is distinct from (p_after ->> k)
$$;

-- The actor is never notified of their own action (NotificationModel::notifyMany).
create function private.notify(p_users uuid[], p_type text, p_title text, p_message text,
                               p_related_type text, p_related_id bigint, p_project bigint) returns void
language sql security definer set search_path = '' as $$
    insert into public.notifications (user_id, type, title, message, related_type, related_id, project_id)
    select distinct u, p_type, p_title, left(p_message, 255), p_related_type, p_related_id, p_project
    from unnest(p_users) u
    where u is not null and u is distinct from auth.uid()
$$;

-- Assignees plus creator (NotificationService::interestedIn).
create function private.interested_in(p_task bigint) returns uuid[]
language sql stable security definer set search_path = '' as $$
    select array_agg(user_id) from (
        select user_id from public.task_assignees where task_id = p_task
        union select created_by from public.tasks where id = p_task
    ) s
$$;

-- Rewrite a column's positions as 0..n, splicing p_task in at p_index (TaskService::resequence).
create function private.resequence(p_project bigint, p_status text, p_task bigint, p_index int) returns void
language plpgsql security definer set search_path = '' as $$
declare
    ids bigint[];
    i int;
begin
    select coalesce(array_agg(id order by position, id), '{}') into ids
    from public.tasks where project_id = p_project and status = p_status and id is distinct from p_task;

    if p_task is not null then
        p_index := greatest(0, least(p_index, coalesce(array_length(ids, 1), 0)));
        ids := ids[1:p_index] || p_task || ids[p_index + 1:];
    end if;

    for i in 1 .. coalesce(array_length(ids, 1), 0) loop
        update public.tasks set position = i - 1 where id = ids[i] and position is distinct from i - 1;
    end loop;
end $$;

-- ---------------------------------------------------------------- projects

create function public.create_project(p jsonb) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
    pid bigint;
begin
    if auth.uid() is null then
        raise exception 'Sign in first.' using errcode = '42501';
    end if;

    insert into public.projects (owner_id, name, description, status, priority, start_date, due_date, due_time)
    values (auth.uid(), btrim(p ->> 'name'), nullif(btrim(p ->> 'description'), ''),
            coalesce(nullif(p ->> 'status', ''), 'planning'), coalesce(nullif(p ->> 'priority', ''), 'medium'),
            nullif(p ->> 'start_date', '')::date, nullif(p ->> 'due_date', '')::date, (case when nullif(p ->> 'due_date', '') is not null then (nullif(p ->> 'due_time', '')::time)::text end)::time)
    returning id into pid;

    insert into public.project_members (project_id, user_id, role) values (pid, auth.uid(), 'owner');

    perform private.log(pid, 'project', pid, 'create', 'created the project ' || btrim(p ->> 'name'), null,
                        jsonb_build_object('name', btrim(p ->> 'name'), 'status', coalesce(nullif(p ->> 'status', ''), 'planning')));
    return pid;
end $$;

create function public.update_project(p_project bigint, p jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
    role text := private.require_role(p_project, 'manager');
    prev public.projects;
    after jsonb;
    d record;
begin
    select * into prev from public.projects where id = p_project;

    after := jsonb_build_object(
        'name', btrim(p ->> 'name'), 'description', nullif(btrim(p ->> 'description'), ''),
        'status', p ->> 'status', 'priority', p ->> 'priority',
        'start_date', nullif(p ->> 'start_date', ''), 'due_date', nullif(p ->> 'due_date', ''),
        -- HH:MM:SS, so the diff doesn't see "17:30" and "17:30:00" as a change.
        'due_time', case when nullif(p ->> 'due_date', '') is not null then (nullif(p ->> 'due_time', '')::time)::text end);

    -- Archiving is owner-only, including through this form (closes the old edit-form gap).
    if role <> 'owner' and (after ->> 'status' = 'archived') <> (prev.status = 'archived') then
        raise exception 'Only the owner can archive or reopen a project.' using errcode = '42501';
    end if;

    update public.projects set
        name = after ->> 'name', description = after ->> 'description', status = after ->> 'status',
        priority = after ->> 'priority', start_date = (after ->> 'start_date')::date, due_date = (after ->> 'due_date')::date,
        due_time = (after ->> 'due_time')::time
    where id = p_project;

    select * into d from private.diff(to_jsonb(prev), after);
    if d.new_values <> '{}' then
        perform private.log(p_project, 'project', p_project, 'update', 'updated the project settings', d.old_values, d.new_values);
    end if;
end $$;

-- p_status: 'archived' (archive) or 'active' (reopen). Owner only.
create function public.set_project_status(p_project bigint, p_status text) returns void
language plpgsql security definer set search_path = '' as $$
declare
    old text;
begin
    perform private.require_role(p_project, 'owner');
    if p_status not in ('archived', 'active') then
        raise exception 'Invalid status.' using errcode = '22023';
    end if;
    select status into old from public.projects where id = p_project;
    update public.projects set status = p_status where id = p_project;
    perform private.log(p_project, 'project', p_project, 'update',
                        case p_status when 'archived' then 'archived the project' else 'reopened the project' end,
                        jsonb_build_object('status', old), jsonb_build_object('status', p_status));
end $$;

create function public.delete_project(p_project bigint) returns void
language plpgsql security definer set search_path = '' as $$
begin
    perform private.require_role(p_project, 'owner');
    delete from public.projects where id = p_project;
end $$;

-- ---------------------------------------------------------------- members

-- canAddMemberAs: an owner adds manager/member/viewer; a manager adds member/viewer.
create function public.add_member(p_project bigint, p_user uuid, p_role text) returns void
language plpgsql security definer set search_path = '' as $$
declare
    role text := private.require_role(p_project, 'manager');
    pname text;
begin
    if p_role not in ('manager', 'member', 'viewer') or (role = 'manager' and p_role = 'manager') then
        raise exception 'You cannot add someone with that role.' using errcode = '42501';
    end if;
    if not exists (select 1 from public.profiles where id = p_user) then
        raise exception 'That user does not exist.' using errcode = 'P0002';
    end if;
    if exists (select 1 from public.project_members where project_id = p_project and user_id = p_user) then
        raise exception 'That user is already a member.' using errcode = '22023';
    end if;

    insert into public.project_members (project_id, user_id, role) values (p_project, p_user, p_role);
    select name into pname from public.projects where id = p_project;

    perform private.log(p_project, 'member', null, 'add', 'added ' || private.username(p_user) || ' to the project',
                        null, jsonb_build_object('role', p_role));
    perform private.notify(array[p_user], 'project_invitation', 'You were added to a project', pname,
                           'project', p_project, p_project);
end $$;

-- canChangeRole: owner only; the owner row is immutable and nobody becomes owner.
create function public.change_role(p_project bigint, p_user uuid, p_role text) returns void
language plpgsql security definer set search_path = '' as $$
declare
    current_role_ text;
begin
    perform private.require_role(p_project, 'owner');
    select role into current_role_ from public.project_members where project_id = p_project and user_id = p_user;

    if current_role_ is null then
        raise exception 'That user is not a member.' using errcode = 'P0002';
    end if;
    if current_role_ = 'owner' or p_role not in ('manager', 'member', 'viewer') then
        raise exception 'You cannot change that role.' using errcode = '42501';
    end if;
    if current_role_ = p_role then
        raise exception 'That member already has that role.' using errcode = '22023';
    end if;

    update public.project_members set role = p_role where project_id = p_project and user_id = p_user;
    perform private.log(p_project, 'member', null, 'update', 'changed ' || private.username(p_user) || '''s role to ' || p_role,
                        jsonb_build_object('role', current_role_), jsonb_build_object('role', p_role));
end $$;

-- canRemoveMember: never the owner; an owner removes anyone else; a manager
-- removes anyone except another manager.
create function public.remove_member(p_project bigint, p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
    role text := private.require_role(p_project, 'manager');
    target text;
begin
    select m.role into target from public.project_members m where project_id = p_project and user_id = p_user;

    if target is null then
        raise exception 'That user is not a member.' using errcode = 'P0002';
    end if;
    if target = 'owner' or (role = 'manager' and target = 'manager' and p_user <> auth.uid()) then
        raise exception 'You cannot remove that member.' using errcode = '42501';
    end if;

    perform private.log(p_project, 'member', null, 'remove', 'removed ' || private.username(p_user) || ' from the project',
                        jsonb_build_object('role', target), null);
    delete from public.project_members where project_id = p_project and user_id = p_user;
end $$;

-- ---------------------------------------------------------------- tasks

-- Create (p_task null) or update a task with its assignees and tags (TaskService::create/update).
create function public.save_task(p_project bigint, p_task bigint, p jsonb, p_assignees uuid[], p_tags bigint[]) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
    tid bigint := p_task;
    prev public.tasks;
    fields jsonb;
    added uuid[];
    d record;
begin
    perform private.require_role(p_project, 'member');
    p_assignees := coalesce(p_assignees, '{}');
    p_tags := coalesce(p_tags, '{}');

    -- Assignees must be members and tags must belong to this project (both unchecked before).
    if exists (select 1 from unnest(p_assignees) u
               where not exists (select 1 from public.project_members where project_id = p_project and user_id = u)) then
        raise exception 'Assignees must be members of the project.' using errcode = '22023';
    end if;
    if exists (select 1 from unnest(p_tags) t
               where not exists (select 1 from public.tags where id = t and project_id = p_project)) then
        raise exception 'Tags must belong to this project.' using errcode = '22023';
    end if;

    fields := jsonb_build_object(
        'title', btrim(p ->> 'title'), 'description', nullif(btrim(p ->> 'description'), ''),
        'status', coalesce(nullif(p ->> 'status', ''), 'todo'), 'priority', coalesce(nullif(p ->> 'priority', ''), 'medium'),
        'start_date', nullif(p ->> 'start_date', ''), 'due_date', nullif(p ->> 'due_date', ''),
        -- HH:MM:SS, so the diff doesn't see "17:30" and "17:30:00" as a change.
        'due_time', case when nullif(p ->> 'due_date', '') is not null then (nullif(p ->> 'due_time', '')::time)::text end);

    if tid is null then
        insert into public.tasks (project_id, created_by, title, description, status, priority, start_date, due_date, due_time, position, completed_at)
        values (p_project, auth.uid(), fields ->> 'title', fields ->> 'description', fields ->> 'status', fields ->> 'priority',
                (fields ->> 'start_date')::date, (fields ->> 'due_date')::date, (fields ->> 'due_time')::time,
                (select coalesce(max(position), -1) + 1 from public.tasks where project_id = p_project and status = fields ->> 'status'),
                case when fields ->> 'status' = 'completed' then now() end)
        returning id into tid;

        perform private.log(p_project, 'task', tid, 'create', 'created the task ' || (fields ->> 'title'), null,
                            jsonb_build_object('title', fields ->> 'title', 'status', fields ->> 'status'));
    else
        select * into prev from public.tasks where id = tid and project_id = p_project;
        if not found then
            raise exception 'Not found' using errcode = 'P0002';
        end if;

        update public.tasks set
            title = fields ->> 'title', description = fields ->> 'description', status = fields ->> 'status',
            priority = fields ->> 'priority', start_date = (fields ->> 'start_date')::date, due_date = (fields ->> 'due_date')::date,
            due_time = (fields ->> 'due_time')::time,
            -- A status change sends the task to the end of its new column.
            position = case when status = fields ->> 'status' then position
                            else (select coalesce(max(t.position), -1) + 1 from public.tasks t
                                  where t.project_id = p_project and t.status = fields ->> 'status') end,
            completed_at = case when fields ->> 'status' <> 'completed' then null
                                when status = 'completed' then completed_at else now() end
        where id = tid;

        select * into d from private.diff(to_jsonb(prev), fields);
        if d.new_values <> '{}' then
            perform private.log(p_project, 'task', tid,
                                case when d.new_values ->> 'status' = 'completed' then 'complete' else 'update' end,
                                'updated the task ' || prev.title, d.old_values, d.new_values);
        end if;
        if d.new_values ? 'status' then
            perform private.notify(private.interested_in(tid), 'task_status_changed', 'A task changed status',
                                   prev.title || ': ' || replace(prev.status, '_', ' ') || ' → ' || replace(fields ->> 'status', '_', ' '),
                                   'task', tid, p_project);
        end if;
    end if;

    -- Assignees: write only the difference; tags: replace (TaskAssigneeModel/TaskTagModel::syncForTask).
    delete from public.task_assignees where task_id = tid and user_id <> all (p_assignees);
    with ins as (
        insert into public.task_assignees (task_id, user_id)
        select tid, u from unnest(p_assignees) u on conflict do nothing returning user_id
    ) select array_agg(user_id) into added from ins;

    delete from public.task_tags where task_id = tid;
    insert into public.task_tags (task_id, tag_id) select distinct tid, t from unnest(p_tags) t;

    if added is not null then
        perform private.notify(added, 'task_assigned', 'You were assigned a task', fields ->> 'title', 'task', tid, p_project);
    end if;
    return tid;
end $$;

-- Board drag-and-drop (TaskService::move). p_position is the index within the column.
create function public.move_task(p_task bigint, p_status text, p_position int) returns void
language plpgsql security definer set search_path = '' as $$
declare
    t public.tasks;
begin
    select * into t from public.tasks where id = p_task;
    if not found then
        raise exception 'Not found' using errcode = 'P0002';
    end if;
    perform private.require_role(t.project_id, 'member');
    if p_status not in ('todo', 'in_progress', 'review', 'completed') then
        raise exception 'Invalid status.' using errcode = '22023';
    end if;

    if t.status <> p_status then
        update public.tasks set status = p_status,
            completed_at = case when p_status = 'completed' then now() end
        where id = p_task;
        perform private.resequence(t.project_id, t.status, null, 0);
    end if;
    perform private.resequence(t.project_id, p_status, p_task, greatest(p_position, 0));

    -- A reorder within the same column records nothing and notifies no one.
    if t.status <> p_status then
        perform private.log(t.project_id, 'task', p_task, case when p_status = 'completed' then 'complete' else 'update' end,
                            'moved ' || t.title || ' from ' || t.status || ' to ' || p_status,
                            jsonb_build_object('status', t.status), jsonb_build_object('status', p_status));
        perform private.notify(private.interested_in(p_task), 'task_status_changed', 'A task changed status',
                               t.title || ': ' || replace(t.status, '_', ' ') || ' → ' || replace(p_status, '_', ' '),
                               'task', p_task, t.project_id);
    end if;
end $$;

-- canDeleteTask: manager+ or the task's creator.
create function public.delete_task(p_task bigint) returns void
language plpgsql security definer set search_path = '' as $$
declare
    t public.tasks;
    role text;
begin
    select * into t from public.tasks where id = p_task;
    if not found then
        raise exception 'Not found' using errcode = 'P0002';
    end if;
    role := private.require_role(t.project_id, 'viewer');
    if private.role_rank(role) < 3 and t.created_by is distinct from auth.uid() then
        raise exception 'You do not have permission to do that.' using errcode = '42501';
    end if;

    perform private.log(t.project_id, 'task', p_task, 'delete', 'deleted the task ' || t.title,
                        jsonb_build_object('title', t.title, 'status', t.status), null);
    delete from public.tasks where id = p_task;
end $$;

create function public.add_comment(p_task bigint, p_comment text) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
    t public.tasks;
    cid bigint;
begin
    select * into t from public.tasks where id = p_task;
    if not found then
        raise exception 'Not found' using errcode = 'P0002';
    end if;
    perform private.require_role(t.project_id, 'member');

    insert into public.task_comments (task_id, user_id, comment) values (p_task, auth.uid(), btrim(p_comment))
    returning id into cid;

    perform private.log(t.project_id, 'task', p_task, 'add', 'commented on ' || t.title);
    perform private.notify(private.interested_in(p_task), 'comment_added', 'New comment on a task', t.title,
                           'task', p_task, t.project_id);
    return cid;
end $$;

-- Flip a checklist item; returns the task's progress across all its checklists.
create function public.toggle_item(p_item bigint) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
    tid bigint;
    pid bigint;
    done int;
    total int;
begin
    select c.task_id, private.checklist_project(c.id) into tid, pid
    from public.task_checklist_items i join public.task_checklists c on c.id = i.checklist_id where i.id = p_item;
    if pid is null then
        raise exception 'Not found' using errcode = 'P0002';
    end if;
    perform private.require_role(pid, 'member');

    update public.task_checklist_items
    set is_completed = not is_completed, completed_at = case when is_completed then null else now() end
    where id = p_item;

    select count(*) filter (where i.is_completed), count(*) into done, total
    from public.task_checklist_items i join public.task_checklists c on c.id = i.checklist_id where c.task_id = tid;

    return jsonb_build_object('completed', done, 'total', total,
                              'percent', case when total = 0 then 0 else round(done * 100.0 / total) end);
end $$;

-- ---------------------------------------------------------------- dashboard

-- Everything Dashboard::index shows, scoped to the caller (security invoker, so RLS applies).
create function public.dashboard() returns jsonb
language sql stable set search_path = '' as $$
    with mine as (
        select p.*, m.role,
               (select case when count(*) = 0 then 0
                            else round(count(*) filter (where t.status = 'completed') * 100.0 / count(*)) end
                from public.tasks t where t.project_id = p.id) as progress
        from public.projects p join public.project_members m on m.project_id = p.id and m.user_id = auth.uid()
    ), assigned as (
        select t.*, p.name as project_name
        from public.tasks t
        join public.task_assignees a on a.task_id = t.id and a.user_id = auth.uid()
        join public.projects p on p.id = t.project_id
    )
    select jsonb_build_object(
        'projectCounts', (select coalesce(jsonb_object_agg(status, n), '{}') from (select status, count(*) n from mine group by status) s),
        'taskCounts', (select jsonb_build_object(
            'assigned',  count(*),
            'overdue',   count(*) filter (where status <> 'completed' and due_date < current_date),
            'due_today', count(*) filter (where status <> 'completed' and due_date = current_date),
            'completed', count(*) filter (where status = 'completed')) from assigned),
        'myProjects', (select coalesce(jsonb_agg(to_jsonb(m) order by m.due_date nulls last, m.id desc), '[]') from mine m),
        'myTasks', (select coalesce(jsonb_agg(to_jsonb(a) order by a.due_date nulls last, a.id), '[]')
                    from (select * from assigned where status <> 'completed' order by due_date nulls last, id limit 8) a),
        'notifications', (select coalesce(jsonb_agg(to_jsonb(n) order by n.created_at desc), '[]')
                          from (select * from public.notifications where user_id = auth.uid() order by created_at desc limit 5) n),
        'unread', (select count(*) from public.notifications where user_id = auth.uid() and read_at is null)
    )
$$;

-- Only signed-in users may call the RPCs.
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;

-- Registration checks this before sign-up, since a clash would otherwise fail
-- inside the auth trigger with an unhelpful "database error".
create function public.username_taken(p_username text) returns boolean
language sql stable security definer set search_path = '' as $$
    select exists (select 1 from public.profiles where lower(username) = lower(p_username))
$$;
revoke execute on function public.username_taken(text) from public;
grant execute on function public.username_taken(text) to anon, authenticated;
