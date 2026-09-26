-- Authorization, ported from app/Libraries/ProjectPolicy.php.
-- Reads go straight to the tables under RLS. Writes that carry business rules,
-- activity or notifications go through the RPCs in the next migration; only the
-- plain ones (tags, checklists, items, comment delete, marking read) are direct.

create schema private;
grant usage on schema private to authenticated;

create function private.role_rank(role text) returns int
language sql immutable as $$
    select case role when 'owner' then 4 when 'manager' then 3 when 'member' then 2 when 'viewer' then 1 else 0 end
$$;

-- The caller's role in a project, or null for a non-member.
create function private.project_role(pid bigint) returns text
language sql stable security definer set search_path = '' as $$
    select role from public.project_members where project_id = pid and user_id = auth.uid()
$$;

create function private.has_role(pid bigint, min_role text) returns boolean
language sql stable security definer set search_path = '' as $$
    select coalesce(private.role_rank(private.project_role(pid)) >= private.role_rank(min_role), false)
$$;

create function private.task_project(tid bigint) returns bigint
language sql stable security definer set search_path = '' as $$
    select project_id from public.tasks where id = tid
$$;

create function private.checklist_project(cid bigint) returns bigint
language sql stable security definer set search_path = '' as $$
    select t.project_id from public.task_checklists c join public.tasks t on t.id = c.task_id where c.id = cid
$$;

grant execute on all functions in schema private to authenticated;

alter table public.profiles             enable row level security;
alter table public.projects             enable row level security;
alter table public.project_members      enable row level security;
alter table public.tasks                enable row level security;
alter table public.task_assignees       enable row level security;
alter table public.task_comments        enable row level security;
alter table public.tags                 enable row level security;
alter table public.task_tags            enable row level security;
alter table public.task_checklists      enable row level security;
alter table public.task_checklist_items enable row level security;
alter table public.notifications        enable row level security;
alter table public.activity_logs        enable row level security;

-- Usernames are visible to every signed-in user (the add-member picker lists them).
create policy "signed-in read" on public.profiles for select to authenticated using (true);

-- Any role may read; a non-member sees nothing (the old 404).
create policy "members read" on public.projects        for select to authenticated using (private.has_role(id, 'viewer'));
create policy "members read" on public.project_members for select to authenticated using (private.has_role(project_id, 'viewer'));
create policy "members read" on public.tasks           for select to authenticated using (private.has_role(project_id, 'viewer'));
create policy "members read" on public.tags            for select to authenticated using (private.has_role(project_id, 'viewer'));
create policy "members read" on public.activity_logs   for select to authenticated using (private.has_role(project_id, 'viewer'));
create policy "members read" on public.task_assignees  for select to authenticated using (private.has_role(private.task_project(task_id), 'viewer'));
create policy "members read" on public.task_comments   for select to authenticated using (private.has_role(private.task_project(task_id), 'viewer'));
create policy "members read" on public.task_tags       for select to authenticated using (private.has_role(private.task_project(task_id), 'viewer'));
create policy "members read" on public.task_checklists for select to authenticated using (private.has_role(private.task_project(task_id), 'viewer'));
create policy "members read" on public.task_checklist_items for select to authenticated
    using (private.has_role(private.checklist_project(checklist_id), 'viewer'));

-- Tags: member+ creates, manager+ deletes (canDeleteTag).
create policy "member create" on public.tags for insert to authenticated with check (private.has_role(project_id, 'member'));
create policy "manager delete" on public.tags for delete to authenticated using (private.has_role(project_id, 'manager'));

-- Checklists and items: member+ creates. Toggling goes through toggle_item().
create policy "member create" on public.task_checklists for insert to authenticated
    with check (private.has_role(private.task_project(task_id), 'member'));
create policy "member create" on public.task_checklist_items for insert to authenticated
    with check (private.has_role(private.checklist_project(checklist_id), 'member'));

-- Comments: adding goes through add_comment(); author or manager+ deletes (canDeleteComment).
create policy "author or manager delete" on public.task_comments for delete to authenticated
    using (user_id = auth.uid() or private.has_role(private.task_project(task_id), 'manager'));

-- Notifications: your own only, and the only writable column is read_at.
create policy "own read" on public.notifications for select to authenticated using (user_id = auth.uid());
create policy "own update" on public.notifications for update to authenticated
    using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;

-- New checklist items go to the end of their list (TaskChecklistItemModel::nextPosition).
create function private.item_next_position() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
    new.position := (select coalesce(max(position), -1) + 1 from public.task_checklist_items where checklist_id = new.checklist_id);
    new.is_completed := false;
    new.completed_at := null;
    return new;
end $$;

create trigger next_position before insert on public.task_checklist_items
    for each row execute function private.item_next_position();
