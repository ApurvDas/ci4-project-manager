-- Create a checklist together with many items in one call (a pasted list,
-- one item per line). All or nothing: a bad item rolls back the checklist.
-- Items are inserted one statement at a time so the position trigger numbers
-- them in order.
create function public.add_checklist(p_task bigint, p_title text, p_items text[] default '{}') returns bigint
language plpgsql security definer set search_path = '' as $$
declare
    pid bigint := private.task_project(p_task);
    cid bigint;
    item text;
begin
    if pid is null then
        raise exception 'Not found' using errcode = 'P0002';
    end if;
    perform private.require_role(pid, 'member');

    insert into public.task_checklists (task_id, title) values (p_task, btrim(p_title)) returning id into cid;

    foreach item in array coalesce(p_items, '{}') loop
        if btrim(item) <> '' then
            insert into public.task_checklist_items (checklist_id, content) values (cid, btrim(item));
        end if;
    end loop;

    return cid;
end $$;

revoke execute on function public.add_checklist(bigint, text, text[]) from public, anon;
grant execute on function public.add_checklist(bigint, text, text[]) to authenticated;
