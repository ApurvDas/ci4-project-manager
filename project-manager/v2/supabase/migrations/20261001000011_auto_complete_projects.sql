-- Once a project's deadline has passed, it is Completed if all its work is done
-- (progress 100%, see project_progress()); otherwise it stays as it is and the
-- app flags it Overdue. Runs every 5 minutes, and once now for existing projects.
-- Archived projects are left alone.
-- ponytail: compares against the database clock (UTC), so a project can flip a few
-- hours after the local deadline; the Overdue flag itself already hides at 100%.

create function public.settle_projects() returns int
language plpgsql security definer set search_path = '' as $$
declare
    r record;
    n int := 0;
begin
    for r in
        select p.id, p.status from public.projects p
        where p.status not in ('completed', 'archived')
          and (p.due_date < current_date or (p.due_date = current_date and p.due_time < localtime))
          and public.project_progress(p.id) = 100
    loop
        update public.projects set status = 'completed' where id = r.id;
        -- No user: this is the system acting, so the log reads "Project Manager ...".
        insert into public.activity_logs (project_id, entity_type, entity_id, action, description, old_values, new_values)
        values (r.id, 'project', r.id, 'auto', 'marked the project complete: all work is done and the deadline has passed',
                jsonb_build_object('status', r.status), jsonb_build_object('status', 'completed'));
        n := n + 1;
    end loop;
    return n;
end $$;

-- Safe for anyone to call: it only applies the rule above.
revoke execute on function public.settle_projects() from public, anon;
grant execute on function public.settle_projects() to authenticated;

create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('settle-projects', '*/5 * * * *', 'select public.settle_projects()');

select public.settle_projects();
