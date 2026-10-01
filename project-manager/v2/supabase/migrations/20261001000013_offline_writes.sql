-- Offline editing. Edits made without a connection wait in the app's outbox and are replayed
-- through the functions below, so every role check still runs here, on the server, per edit.
--   * Creates carry a client_id, so a retry (the reply was lost) never duplicates a row.
--   * Edits carry the values the editor started from (p_base) and when they edited (p_edited_at),
--     and are merged per field: a field only one side changed keeps that change; when both sides
--     changed the same field the later edit wins, and the loser is reported back so the app can say so.
--   * Time logged offline is stored when it happened, within sane limits.
-- With p_base null every function behaves as before.
-- ponytail: row-level updated_at stands in for a per-field timestamp and the editor's clock is
-- trusted. Add per-field timestamps if real conflicts get misjudged.

-- ---------------------------------------------------------------- client ids

alter table public.projects             add column client_id uuid unique;
alter table public.tasks                add column client_id uuid unique;
alter table public.task_checklists      add column client_id uuid unique;
alter table public.task_checklist_items add column client_id uuid unique;
alter table public.task_comments        add column client_id uuid unique;
alter table public.time_entries         add column client_id uuid unique;
alter table public.tags                 add column client_id uuid unique;

-- Offline timestamps: not in the future (5 minutes of clock slack), not older than 30 days.
create function private.check_time(p_at timestamptz) returns void
language plpgsql stable as $$
begin
    if p_at > now() + interval '5 minutes' or p_at < now() - interval '30 days' then
        raise exception 'That time is not allowed: it must be within the last 30 days and not in the future.' using errcode = '22023';
    end if;
end $$;

-- ---------------------------------------------------------------- projects

drop function public.create_project(jsonb);
create function public.create_project(p jsonb, p_client_id uuid default null) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
    pid bigint;
begin
    if auth.uid() is null then
        raise exception 'Sign in first.' using errcode = '42501';
    end if;
    if p_client_id is not null then
        select id into pid from public.projects where client_id = p_client_id and owner_id = auth.uid();
        if found then return pid; end if; -- a retry: already created
    end if;

    insert into public.projects (owner_id, name, description, status, priority, start_date, due_date, due_time, client_id)
    values (auth.uid(), btrim(p ->> 'name'), nullif(btrim(p ->> 'description'), ''),
            coalesce(nullif(p ->> 'status', ''), 'planning'), coalesce(nullif(p ->> 'priority', ''), 'medium'),
            nullif(p ->> 'start_date', '')::date, nullif(p ->> 'due_date', '')::date, (case when nullif(p ->> 'due_date', '') is not null then (nullif(p ->> 'due_time', '')::time)::text end)::time,
            p_client_id)
    returning id into pid;

    insert into public.project_members (project_id, user_id, role) values (pid, auth.uid(), 'owner');

    perform private.log(pid, 'project', pid, 'create', 'created the project ' || btrim(p ->> 'name'), null,
                        jsonb_build_object('name', btrim(p ->> 'name'), 'status', coalesce(nullif(p ->> 'status', ''), 'planning')));
    return pid;
end $$;
revoke execute on function public.create_project(jsonb, uuid) from public, anon;
grant execute on function public.create_project(jsonb, uuid) to authenticated;

-- Returns { overwritten: [{field, theirs}], lost: [{field, yours}] }.
drop function public.update_project(bigint, jsonb);
create function public.update_project(p_project bigint, p jsonb, p_base jsonb default null, p_edited_at timestamptz default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
    role text := private.require_role(p_project, 'manager');
    prev public.projects;
    after jsonb;
    merged jsonb;
    overwritten jsonb := '[]';
    lost jsonb := '[]';
    k text;
    mine jsonb;
    theirs jsonb;
    d record;
begin
    select * into prev from public.projects where id = p_project;

    after := jsonb_build_object(
        'name', btrim(p ->> 'name'), 'description', nullif(btrim(p ->> 'description'), ''),
        'status', p ->> 'status', 'priority', p ->> 'priority',
        'start_date', nullif(p ->> 'start_date', ''), 'due_date', nullif(p ->> 'due_date', ''),
        -- HH:MM:SS, so the diff doesn't see "17:30" and "17:30:00" as a change.
        'due_time', case when nullif(p ->> 'due_date', '') is not null then (nullif(p ->> 'due_time', '')::time)::text end);

    merged := (select jsonb_object_agg(f, to_jsonb(prev) -> f) from unnest(array['name', 'description', 'status', 'priority', 'start_date', 'due_date', 'due_time']) f);
    foreach k in array array['name', 'description', 'status', 'priority', 'start_date', 'due_date', 'due_time'] loop
        mine := after -> k;
        theirs := to_jsonb(prev) -> k;
        if p_base is null then
            merged := merged || jsonb_build_object(k, mine);
        elsif mine is not distinct from (p_base -> k) then
            null; -- the editor didn't change this field: keep whatever is stored
        elsif theirs is not distinct from (p_base -> k) then
            merged := merged || jsonb_build_object(k, mine);
        elsif coalesce(p_edited_at, now()) > prev.updated_at then
            merged := merged || jsonb_build_object(k, mine);
            overwritten := overwritten || jsonb_build_object('field', k, 'theirs', theirs);
        else
            lost := lost || jsonb_build_object('field', k, 'yours', mine);
        end if;
    end loop;

    -- Archiving is owner-only, including through this form.
    if role <> 'owner' and (merged ->> 'status' = 'archived') <> (prev.status = 'archived') then
        raise exception 'Only the owner can archive or reopen a project.' using errcode = '42501';
    end if;

    update public.projects set
        name = merged ->> 'name', description = merged ->> 'description', status = merged ->> 'status',
        priority = merged ->> 'priority', start_date = (merged ->> 'start_date')::date, due_date = (merged ->> 'due_date')::date,
        due_time = (merged ->> 'due_time')::time
    where id = p_project;

    select * into d from private.diff(to_jsonb(prev), merged);
    if d.new_values <> '{}' then
        perform private.log(p_project, 'project', p_project, 'update', 'updated the project settings', d.old_values, d.new_values);
    end if;
    return jsonb_build_object('id', p_project, 'overwritten', overwritten, 'lost', lost);
end $$;
revoke execute on function public.update_project(bigint, jsonb, jsonb, timestamptz) from public, anon;
grant execute on function public.update_project(bigint, jsonb, jsonb, timestamptz) to authenticated;

-- ---------------------------------------------------------------- tasks

-- Create (p_task null) or update a task with its assignees and tags.
-- Returns { id, overwritten, lost } as update_project does. p_base also carries "assignees" and
-- "tags" (what the editor started from); each is merged as one field.
drop function public.save_task(bigint, bigint, jsonb, uuid[], bigint[]);
create function public.save_task(p_project bigint, p_task bigint, p jsonb, p_assignees uuid[], p_tags bigint[],
                                 p_client_id uuid default null, p_base jsonb default null, p_edited_at timestamptz default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
    tid bigint := p_task;
    prev public.tasks;
    fields jsonb;
    merged jsonb;
    overwritten jsonb := '[]';
    lost jsonb := '[]';
    k text;
    mine jsonb;
    theirs jsonb;
    cur_a uuid[];
    base_a uuid[];
    cur_t bigint[];
    base_t bigint[];
    added uuid[];
    d record;
begin
    perform private.require_role(p_project, 'member');
    p_assignees := coalesce(p_assignees, '{}');
    p_tags := coalesce(p_tags, '{}');

    if p_task is null and p_client_id is not null then
        select id into tid from public.tasks where client_id = p_client_id and project_id = p_project;
        if found then
            return jsonb_build_object('id', tid, 'overwritten', '[]'::jsonb, 'lost', '[]'::jsonb); -- a retry: already created
        end if;
    end if;

    -- Assignees must be members and tags must belong to this project.
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
        insert into public.tasks (project_id, created_by, title, description, status, priority, start_date, due_date, due_time, position, completed_at, client_id)
        values (p_project, auth.uid(), fields ->> 'title', fields ->> 'description', fields ->> 'status', fields ->> 'priority',
                (fields ->> 'start_date')::date, (fields ->> 'due_date')::date, (fields ->> 'due_time')::time,
                (select coalesce(max(position), -1) + 1 from public.tasks where project_id = p_project and status = fields ->> 'status'),
                case when fields ->> 'status' = 'completed' then now() end, p_client_id)
        returning id into tid;

        perform private.log(p_project, 'task', tid, 'create', 'created the task ' || (fields ->> 'title'), null,
                            jsonb_build_object('title', fields ->> 'title', 'status', fields ->> 'status'));
    else
        select * into prev from public.tasks where id = tid and project_id = p_project;
        if not found then
            raise exception 'Not found' using errcode = 'P0002';
        end if;

        merged := (select jsonb_object_agg(f, to_jsonb(prev) -> f)
                   from unnest(array['title', 'description', 'status', 'priority', 'start_date', 'due_date', 'due_time']) f);
        foreach k in array array['title', 'description', 'status', 'priority', 'start_date', 'due_date', 'due_time'] loop
            mine := fields -> k;
            theirs := to_jsonb(prev) -> k;
            if p_base is null then
                merged := merged || jsonb_build_object(k, mine);
            elsif mine is not distinct from (p_base -> k) then
                null; -- the editor didn't change this field: keep whatever is stored
            elsif theirs is not distinct from (p_base -> k) then
                merged := merged || jsonb_build_object(k, mine);
            elsif coalesce(p_edited_at, now()) > prev.updated_at then
                merged := merged || jsonb_build_object(k, mine);
                overwritten := overwritten || jsonb_build_object('field', k, 'theirs', theirs);
            else
                lost := lost || jsonb_build_object('field', k, 'yours', mine);
            end if;
        end loop;

        update public.tasks set
            title = merged ->> 'title', description = merged ->> 'description', status = merged ->> 'status',
            priority = merged ->> 'priority', start_date = (merged ->> 'start_date')::date, due_date = (merged ->> 'due_date')::date,
            due_time = (merged ->> 'due_time')::time,
            -- A status change sends the task to the end of its new column.
            position = case when status = merged ->> 'status' then position
                            else (select coalesce(max(t.position), -1) + 1 from public.tasks t
                                  where t.project_id = p_project and t.status = merged ->> 'status') end,
            completed_at = case when merged ->> 'status' <> 'completed' then null
                                when status = 'completed' then completed_at else now() end
        where id = tid;

        select * into d from private.diff(to_jsonb(prev), merged);
        if d.new_values <> '{}' then
            perform private.log(p_project, 'task', tid,
                                case when d.new_values ->> 'status' = 'completed' then 'complete' else 'update' end,
                                'updated the task ' || prev.title, d.old_values, d.new_values);
        end if;
        if d.new_values ? 'status' then
            perform private.notify(private.interested_in(tid), 'task_status_changed', 'A task changed status',
                                   prev.title || ': ' || replace(prev.status, '_', ' ') || ' → ' || replace(merged ->> 'status', '_', ' '),
                                   'task', tid, p_project);
        end if;

        -- Assignees and tags merge as whole fields, like the columns above.
        if p_base is not null and p_base ? 'assignees' then
            cur_a := coalesce((select array_agg(user_id order by user_id) from public.task_assignees where task_id = tid), '{}');
            base_a := coalesce((select array_agg(x::uuid order by x::uuid) from jsonb_array_elements_text(p_base -> 'assignees') x), '{}');
            p_assignees := coalesce((select array_agg(u order by u) from unnest(p_assignees) u), '{}');
            if p_assignees = base_a then
                p_assignees := cur_a;
            elsif cur_a <> base_a then
                if coalesce(p_edited_at, now()) > prev.updated_at then
                    overwritten := overwritten || jsonb_build_object('field', 'assignees', 'theirs', to_jsonb(cur_a));
                else
                    lost := lost || jsonb_build_object('field', 'assignees', 'yours', to_jsonb(p_assignees));
                    p_assignees := cur_a;
                end if;
            end if;
        end if;
        if p_base is not null and p_base ? 'tags' then
            cur_t := coalesce((select array_agg(tag_id order by tag_id) from public.task_tags where task_id = tid), '{}');
            base_t := coalesce((select array_agg(x::bigint order by x::bigint) from jsonb_array_elements_text(p_base -> 'tags') x), '{}');
            p_tags := coalesce((select array_agg(t order by t) from unnest(p_tags) t), '{}');
            if p_tags = base_t then
                p_tags := cur_t;
            elsif cur_t <> base_t then
                if coalesce(p_edited_at, now()) > prev.updated_at then
                    overwritten := overwritten || jsonb_build_object('field', 'tags', 'theirs', to_jsonb(cur_t));
                else
                    lost := lost || jsonb_build_object('field', 'tags', 'yours', to_jsonb(p_tags));
                    p_tags := cur_t;
                end if;
            end if;
        end if;
    end if;

    -- Assignees: write only the difference; tags: replace.
    delete from public.task_assignees where task_id = tid and user_id <> all (p_assignees);
    with ins as (
        insert into public.task_assignees (task_id, user_id)
        select tid, u from unnest(p_assignees) u on conflict do nothing returning user_id
    ) select array_agg(user_id) into added from ins;

    delete from public.task_tags where task_id = tid;
    insert into public.task_tags (task_id, tag_id) select distinct tid, t from unnest(p_tags) t;

    if added is not null then
        perform private.notify(added, 'task_assigned', 'You were assigned a task', coalesce(merged ->> 'title', fields ->> 'title'), 'task', tid, p_project);
    end if;
    return jsonb_build_object('id', tid, 'overwritten', overwritten, 'lost', lost);
end $$;
revoke execute on function public.save_task(bigint, bigint, jsonb, uuid[], bigint[], uuid, jsonb, timestamptz) from public, anon;
grant execute on function public.save_task(bigint, bigint, jsonb, uuid[], bigint[], uuid, jsonb, timestamptz) to authenticated;

-- ---------------------------------------------------------------- checklists

-- Returns { added, ids }: the ids of the items in order, so the app can match them to what it showed.
-- p_client_ids lines up with the non-blank items; an id seen before is not inserted again.
drop function public.add_checklist_items(bigint, text[]);
create function public.add_checklist_items(p_task bigint, p_items text[], p_client_ids uuid[] default null, p_list_client_id uuid default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
    pid bigint := private.task_project(p_task);
    cid bigint;
    item text;
    iid bigint;
    n int := 0;
    added int := 0;
    ids bigint[] := '{}';
begin
    if pid is null then
        raise exception 'Not found' using errcode = 'P0002';
    end if;
    perform private.require_role(pid, 'member');

    select id into cid from public.task_checklists where task_id = p_task order by id limit 1;
    if cid is null then
        insert into public.task_checklists (task_id, title, client_id) values (p_task, 'Checklist', p_list_client_id) returning id into cid;
    end if;

    foreach item in array coalesce(p_items, '{}') loop
        if btrim(item) <> '' then
            n := n + 1;
            iid := null;
            if p_client_ids is not null and p_client_ids[n] is not null then
                select id into iid from public.task_checklist_items where client_id = p_client_ids[n];
            end if;
            if iid is null then
                insert into public.task_checklist_items (checklist_id, content, client_id)
                values (cid, btrim(item), case when p_client_ids is null then null else p_client_ids[n] end)
                returning id into iid;
                added := added + 1;
            end if;
            ids := ids || iid;
        end if;
    end loop;

    return jsonb_build_object('added', added, 'ids', to_jsonb(ids));
end $$;
revoke execute on function public.add_checklist_items(bigint, text[], uuid[], uuid) from public, anon;
grant execute on function public.add_checklist_items(bigint, text[], uuid[], uuid) to authenticated;

-- Tick or untick to a stated value (toggle_item flips, which is wrong to repeat). Returns the task's progress.
create function public.set_item_done(p_item bigint, p_done boolean) returns jsonb
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
    set is_completed = p_done, completed_at = case when p_done then coalesce(completed_at, now()) end
    where id = p_item and is_completed is distinct from p_done;

    select count(*) filter (where i.is_completed), count(*) into done, total
    from public.task_checklist_items i join public.task_checklists c on c.id = i.checklist_id where c.task_id = tid;
    return jsonb_build_object('completed', done, 'total', total,
                              'percent', case when total = 0 then 0 else round(done * 100.0 / total) end);
end $$;
revoke execute on function public.set_item_done(bigint, boolean) from public, anon;
grant execute on function public.set_item_done(bigint, boolean) to authenticated;

-- Edit an item's text, merged like the other edits. Returns { id, overwritten, lost }.
create function public.edit_checklist_item(p_item bigint, p_content text, p_base text default null, p_edited_at timestamptz default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
    pid bigint;
    cur public.task_checklist_items;
    mine text := btrim(p_content);
    overwritten jsonb := '[]';
    lost jsonb := '[]';
begin
    select * into cur from public.task_checklist_items where id = p_item;
    if found then pid := private.checklist_project(cur.checklist_id); end if;
    if pid is null then
        raise exception 'Not found' using errcode = 'P0002';
    end if;
    perform private.require_role(pid, 'member');
    if mine is null or mine = '' or char_length(mine) > 255 then
        raise exception 'Items must be 1 to 255 characters.' using errcode = '22023';
    end if;

    if p_base is null or cur.content = p_base then
        update public.task_checklist_items set content = mine where id = p_item;
    elsif mine = p_base then
        null; -- the editor didn't change it
    elsif coalesce(p_edited_at, now()) > cur.updated_at then
        update public.task_checklist_items set content = mine where id = p_item;
        overwritten := jsonb_build_array(jsonb_build_object('field', 'item', 'theirs', cur.content));
    else
        lost := jsonb_build_array(jsonb_build_object('field', 'item', 'yours', mine));
    end if;
    return jsonb_build_object('id', p_item, 'overwritten', overwritten, 'lost', lost);
end $$;
revoke execute on function public.edit_checklist_item(bigint, text, text, timestamptz) from public, anon;
grant execute on function public.edit_checklist_item(bigint, text, text, timestamptz) to authenticated;

-- ---------------------------------------------------------------- comments

drop function public.add_comment(bigint, text);
create function public.add_comment(p_task bigint, p_comment text, p_client_id uuid default null) returns bigint
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

    if p_client_id is not null then
        select id into cid from public.task_comments where client_id = p_client_id and user_id = auth.uid();
        if found then return cid; end if; -- a retry: already posted
    end if;

    insert into public.task_comments (task_id, user_id, comment, client_id) values (p_task, auth.uid(), btrim(p_comment), p_client_id)
    returning id into cid;

    perform private.log(t.project_id, 'task', p_task, 'add', 'commented on ' || t.title);
    perform private.notify(private.interested_in(p_task), 'comment_added', 'New comment on a task', t.title,
                           'task', p_task, t.project_id);
    return cid;
end $$;
revoke execute on function public.add_comment(bigint, text, uuid) from public, anon;
grant execute on function public.add_comment(bigint, text, uuid) to authenticated;

-- ---------------------------------------------------------------- time

-- Starting a timer stops whatever the caller had running (at the moment the new one starts).
-- p_started_at lets an offline start be recorded when it happened.
drop function public.start_timer(bigint);
create function public.start_timer(p_task bigint, p_client_id uuid default null, p_started_at timestamptz default null) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
    eid bigint;
    began timestamptz := coalesce(p_started_at, now());
begin
    perform private.require_role(private.task_project(p_task), 'member');
    if p_client_id is not null then
        select id into eid from public.time_entries where client_id = p_client_id and user_id = auth.uid();
        if found then return eid; end if; -- a retry: already started
    end if;
    if p_started_at is not null then perform private.check_time(p_started_at); end if;

    update public.time_entries set ended_at = greatest(started_at, began) where user_id = auth.uid() and ended_at is null;
    insert into public.time_entries (task_id, user_id, started_at, client_id) values (p_task, auth.uid(), began, p_client_id)
    returning id into eid;
    return eid;
end $$;
revoke execute on function public.start_timer(bigint, uuid, timestamptz) from public, anon;
grant execute on function public.start_timer(bigint, uuid, timestamptz) to authenticated;

-- p_ended_at lets an offline stop be recorded when it happened (never before the start, never in the future).
drop function public.stop_timer();
create function public.stop_timer(p_ended_at timestamptz default null) returns void
language sql security definer set search_path = '' as $$
    update public.time_entries
    set ended_at = greatest(started_at, least(coalesce(p_ended_at, now()), now()))
    where user_id = auth.uid() and ended_at is null
$$;
revoke execute on function public.stop_timer(timestamptz) from public, anon;
grant execute on function public.stop_timer(timestamptz) to authenticated;

-- Add time after the fact: p_minutes ending at p_ended_at (default now).
drop function public.log_time(bigint, integer, text);
create function public.log_time(p_task bigint, p_minutes integer, p_note text default null,
                                p_client_id uuid default null, p_ended_at timestamptz default null) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
    eid bigint;
    finished timestamptz := coalesce(p_ended_at, now());
begin
    perform private.require_role(private.task_project(p_task), 'member');
    if p_client_id is not null then
        select id into eid from public.time_entries where client_id = p_client_id and user_id = auth.uid();
        if found then return eid; end if; -- a retry: already logged
    end if;
    if p_minutes is null or p_minutes < 1 or p_minutes > 1440 then
        raise exception 'Log between 1 minute and 24 hours at a time.' using errcode = '22023';
    end if;
    if p_ended_at is not null then perform private.check_time(p_ended_at); end if;

    insert into public.time_entries (task_id, user_id, started_at, ended_at, note, client_id)
    values (p_task, auth.uid(), finished - make_interval(mins => p_minutes), finished, nullif(btrim(p_note), ''), p_client_id)
    returning id into eid;
    return eid;
end $$;
revoke execute on function public.log_time(bigint, integer, text, uuid, timestamptz) from public, anon;
grant execute on function public.log_time(bigint, integer, text, uuid, timestamptz) to authenticated;
