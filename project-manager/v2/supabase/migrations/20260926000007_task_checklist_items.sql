-- A task's checklist is now just a flat list of items: the page no longer shows
-- or asks for checklist names. Items go into the task's first checklist, which
-- is created (untitled "Checklist") the first time something is added.
-- One statement per item, so the position trigger numbers pasted lists in order.
create function public.add_checklist_items(p_task bigint, p_items text[]) returns int
language plpgsql security definer set search_path = '' as $$
declare
    pid bigint := private.task_project(p_task);
    cid bigint;
    item text;
    added int := 0;
begin
    if pid is null then
        raise exception 'Not found' using errcode = 'P0002';
    end if;
    perform private.require_role(pid, 'member');

    select id into cid from public.task_checklists where task_id = p_task order by id limit 1;
    if cid is null then
        insert into public.task_checklists (task_id, title) values (p_task, 'Checklist') returning id into cid;
    end if;

    foreach item in array coalesce(p_items, '{}') loop
        if btrim(item) <> '' then
            insert into public.task_checklist_items (checklist_id, content) values (cid, btrim(item));
            added := added + 1;
        end if;
    end loop;

    return added;
end $$;

revoke execute on function public.add_checklist_items(bigint, text[]) from public, anon;
grant execute on function public.add_checklist_items(bigint, text[]) to authenticated;
