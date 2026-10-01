-- "Mark complete" button: set_project_status also accepts 'completed'.
-- Still owner-only; 'active' is how a completed or archived project is reopened.
create or replace function public.set_project_status(p_project bigint, p_status text) returns void
language plpgsql security definer set search_path = '' as $$
declare
    old text;
begin
    perform private.require_role(p_project, 'owner');
    if p_status not in ('archived', 'active', 'completed') then
        raise exception 'Invalid status.' using errcode = '22023';
    end if;
    select status into old from public.projects where id = p_project;
    update public.projects set status = p_status where id = p_project;
    perform private.log(p_project, 'project', p_project, 'update',
                        case p_status when 'archived' then 'archived the project'
                                      when 'completed' then 'marked the project complete'
                                      else 'reopened the project' end,
                        jsonb_build_object('status', old), jsonb_build_object('status', p_status));
end $$;
