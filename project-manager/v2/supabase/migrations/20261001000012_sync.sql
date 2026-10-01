-- Local copy + live sync. Clients keep their own copy of what they can see and ask
-- sync_pull() for everything changed since the last pull. Three things make that work:
--   1. every synced table has an updated_at (kept fresh by the touch trigger);
--   2. rows that are deleted leave a note in `deletions`, since a missing row can't be pulled;
--   3. the tables are published to Realtime, so open apps hear about changes at once.
-- Reads stay under RLS (sync_pull is security invoker), so a client only ever gets its own data.

-- 1. updated_at on the tables that lacked it (activity_logs is append-only: it has created_at).
alter table public.tags             add column updated_at timestamptz not null default now();
alter table public.task_tags        add column updated_at timestamptz not null default now();
alter table public.task_assignees   add column updated_at timestamptz not null default now();
alter table public.project_members  add column updated_at timestamptz not null default now();
alter table public.time_entries     add column updated_at timestamptz not null default now();
alter table public.notifications    add column updated_at timestamptz not null default now();

create trigger touch before update on public.tags             for each row execute function public.touch_updated_at();
create trigger touch before update on public.task_tags        for each row execute function public.touch_updated_at();
create trigger touch before update on public.task_assignees   for each row execute function public.touch_updated_at();
create trigger touch before update on public.project_members  for each row execute function public.touch_updated_at();
create trigger touch before update on public.time_entries     for each row execute function public.touch_updated_at();
create trigger touch before update on public.notifications    for each row execute function public.touch_updated_at();

-- 2. Deletions. row_id is text because task_tags has a composite key ("task:tag").
create table public.deletions (
    id         bigint generated always as identity primary key,
    table_name text not null,
    row_id     text not null,
    project_id bigint,
    deleted_at timestamptz not null default now()
);
create index on public.deletions (deleted_at);
alter table public.deletions enable row level security;
-- Same visibility as the rows themselves. A null project (the parent was deleted in the
-- same cascade) is never visible: clients drop a deleted task's or project's children themselves.
create policy "members read" on public.deletions for select to authenticated
    using (project_id is not null and private.has_role(project_id, 'viewer'));

create function private.record_deletion() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
    j   jsonb := to_jsonb(old);
    pid bigint;
begin
    pid := case tg_table_name
        when 'projects' then (j ->> 'id')::bigint
        when 'task_assignees' then private.task_project((j ->> 'task_id')::bigint)
        when 'task_tags' then private.task_project((j ->> 'task_id')::bigint)
        when 'task_comments' then private.task_project((j ->> 'task_id')::bigint)
        when 'task_checklists' then private.task_project((j ->> 'task_id')::bigint)
        when 'time_entries' then private.task_project((j ->> 'task_id')::bigint)
        when 'task_checklist_items' then private.checklist_project((j ->> 'checklist_id')::bigint)
        else (j ->> 'project_id')::bigint
    end;
    insert into public.deletions (table_name, row_id, project_id)
    values (tg_table_name,
            case tg_table_name when 'task_tags' then (j ->> 'task_id') || ':' || (j ->> 'tag_id') else j ->> 'id' end,
            pid);
    -- A client offline for longer than this does a full re-pull instead (see sync_pull).
    delete from public.deletions where deleted_at < now() - interval '30 days';
    return null;
end $$;

create trigger record_deletion after delete on public.projects             for each row execute function private.record_deletion();
create trigger record_deletion after delete on public.project_members      for each row execute function private.record_deletion();
create trigger record_deletion after delete on public.tasks                for each row execute function private.record_deletion();
create trigger record_deletion after delete on public.task_assignees       for each row execute function private.record_deletion();
create trigger record_deletion after delete on public.task_tags            for each row execute function private.record_deletion();
create trigger record_deletion after delete on public.tags                 for each row execute function private.record_deletion();
create trigger record_deletion after delete on public.task_comments        for each row execute function private.record_deletion();
create trigger record_deletion after delete on public.task_checklists      for each row execute function private.record_deletion();
create trigger record_deletion after delete on public.task_checklist_items for each row execute function private.record_deletion();
create trigger record_deletion after delete on public.time_entries         for each row execute function private.record_deletion();

-- Everything the caller can see that changed since p_since (null = everything), in one round trip.
-- The 5-minute overlap catches rows committed late; clients upsert, so repeats are harmless.
-- The client uses the returned "now" as its next cursor, never its own clock.
-- "visibleProjects" lets it drop projects it can no longer see (membership removed, project deleted).
-- ponytail: the overlap re-sends recent rows on every pull, and all profiles and activity come every
-- time they're new; replace with a per-row change log if payloads grow.
create function public.sync_pull(p_since timestamptz default null) returns jsonb
language sql stable set search_path = '' as $$
    with c as (select coalesce(p_since - interval '5 minutes', '-infinity'::timestamptz) as since)
    select jsonb_build_object(
        'now', now(),
        'me', (select jsonb_build_object('id', id, 'username', username, 'is_admin', is_admin) from public.profiles where id = auth.uid()),
        'profiles',             (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'username', username)), '[]') from public.profiles),
        'projects',             (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from public.projects x, c where x.updated_at > c.since),
        'project_members',      (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from public.project_members x, c where x.updated_at > c.since),
        'tasks',                (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from public.tasks x, c where x.updated_at > c.since),
        'task_assignees',       (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from public.task_assignees x, c where x.updated_at > c.since),
        'tags',                 (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from public.tags x, c where x.updated_at > c.since),
        'task_tags',            (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from public.task_tags x, c where x.updated_at > c.since),
        'task_comments',        (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from public.task_comments x, c where x.updated_at > c.since),
        'task_checklists',      (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from public.task_checklists x, c where x.updated_at > c.since),
        'task_checklist_items', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from public.task_checklist_items x, c where x.updated_at > c.since),
        'time_entries',         (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from public.time_entries x, c where x.updated_at > c.since),
        'notifications',        (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from public.notifications x, c where x.updated_at > c.since),
        'activity_logs',        (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from public.activity_logs x, c where x.created_at > c.since),
        'deletions',            (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from public.deletions x, c where x.deleted_at > c.since),
        'visibleProjects',      (select coalesce(jsonb_agg(id), '[]') from public.projects)
    )
$$;
revoke execute on function public.sync_pull(timestamptz) from public, anon;
grant execute on function public.sync_pull(timestamptz) to authenticated;

-- 3. Live updates. Deletions are published too, since a DELETE event itself carries no row to filter by RLS.
alter publication supabase_realtime add table
    public.projects, public.project_members, public.tasks, public.task_assignees, public.tags, public.task_tags,
    public.task_comments, public.task_checklists, public.task_checklist_items, public.time_entries,
    public.notifications, public.activity_logs, public.deletions;
