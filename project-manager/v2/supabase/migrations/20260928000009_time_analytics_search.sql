-- Time tracking, project analytics and full-text search.

-- ---------------------------------------------------------------- time tracking

alter table public.tasks
    add column estimate_minutes integer check (estimate_minutes is null or estimate_minutes between 1 and 100000);

-- One row per stretch of work. A running timer has no ended_at yet.
create table public.time_entries (
    id         bigint generated always as identity primary key,
    task_id    bigint not null references public.tasks (id) on delete cascade,
    user_id    uuid not null references public.profiles (id) on delete cascade,
    started_at timestamptz not null default now(),
    ended_at   timestamptz,
    note       text check (char_length(note) <= 255),
    created_at timestamptz not null default now(),
    check (ended_at is null or ended_at >= started_at)
);
create index on public.time_entries (task_id);
create index on public.time_entries (user_id);
-- At most one running timer per person.
create unique index time_entries_one_running on public.time_entries (user_id) where ended_at is null;

alter table public.time_entries enable row level security;
create policy "members read" on public.time_entries for select to authenticated
    using (private.has_role(private.task_project(task_id), 'viewer'));
-- People may delete their own entries; starting, stopping and logging go through RPCs.
create policy "own delete" on public.time_entries for delete to authenticated
    using (user_id = auth.uid());

create function public.set_task_estimate(p_task bigint, p_minutes integer) returns void
language plpgsql security definer set search_path = '' as $$
begin
    perform private.require_role(private.task_project(p_task), 'member');
    update public.tasks set estimate_minutes = nullif(p_minutes, 0) where id = p_task;
end $$;

-- Starting a timer stops whatever the caller had running.
create function public.start_timer(p_task bigint) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
    eid bigint;
begin
    perform private.require_role(private.task_project(p_task), 'member');
    update public.time_entries set ended_at = now() where user_id = auth.uid() and ended_at is null;
    insert into public.time_entries (task_id, user_id) values (p_task, auth.uid()) returning id into eid;
    return eid;
end $$;

create function public.stop_timer() returns void
language sql security definer set search_path = '' as $$
    update public.time_entries set ended_at = now() where user_id = auth.uid() and ended_at is null
$$;

-- Add time after the fact: p_minutes ending now.
create function public.log_time(p_task bigint, p_minutes integer, p_note text default null) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
    eid bigint;
begin
    perform private.require_role(private.task_project(p_task), 'member');
    if p_minutes is null or p_minutes < 1 or p_minutes > 1440 then
        raise exception 'Log between 1 minute and 24 hours at a time.' using errcode = '22023';
    end if;
    insert into public.time_entries (task_id, user_id, started_at, ended_at, note)
    values (p_task, auth.uid(), now() - make_interval(mins => p_minutes), now(), nullif(btrim(p_note), ''))
    returning id into eid;
    return eid;
end $$;

-- ---------------------------------------------------------------- analytics

-- Everything the Analytics page shows, for one project (members only).
create function public.project_analytics(p_project bigint, p_today date default current_date) returns jsonb
language plpgsql stable set search_path = '' as $$
begin
    if not private.has_role(p_project, 'viewer') then
        raise exception 'Not found' using errcode = 'P0002';
    end if;
    return jsonb_build_object(
        -- Tasks completed in each of the last 8 weeks (Monday-start).
        'weekly', (select jsonb_agg(jsonb_build_object('week', w::date, 'completed',
                        (select count(*) from public.tasks t where t.project_id = p_project
                            and t.completed_at >= w and t.completed_at < w + interval '7 days')) order by w)
                   from generate_series(date_trunc('week', p_today::timestamp) - interval '7 weeks',
                                        date_trunc('week', p_today::timestamp), interval '1 week') w),
        -- Open tasks at the end of each of the last 30 days.
        'burndown', (select jsonb_agg(jsonb_build_object('day', d::date, 'open',
                        (select count(*) from public.tasks t where t.project_id = p_project
                            and t.created_at < d + interval '1 day'
                            and (t.completed_at is null or t.completed_at >= d + interval '1 day'))) order by d)
                     from generate_series((p_today - 29)::timestamp, p_today::timestamp, interval '1 day') d),
        'avgDaysToFinish', (select round((avg(extract(epoch from completed_at - created_at)) / 86400)::numeric, 1)
                            from public.tasks where project_id = p_project and completed_at is not null),
        'totals', (select jsonb_build_object(
                        'tasks', count(*),
                        'completed', count(*) filter (where status = 'completed'),
                        'overdue', count(*) filter (where status <> 'completed' and due_date < p_today),
                        'estimateMinutes', coalesce(sum(estimate_minutes), 0))
                   from public.tasks where project_id = p_project),
        'loggedMinutes', (select coalesce(round(sum(extract(epoch from coalesce(e.ended_at, now()) - e.started_at)) / 60), 0)
                          from public.time_entries e join public.tasks t on t.id = e.task_id
                          where t.project_id = p_project),
        'byMember', (select coalesce(jsonb_agg(jsonb_build_object('username', pr.username, 'minutes', x.minutes) order by x.minutes desc), '[]')
                     from (select e.user_id, round(sum(extract(epoch from coalesce(e.ended_at, now()) - e.started_at)) / 60) as minutes
                           from public.time_entries e join public.tasks t on t.id = e.task_id
                           where t.project_id = p_project group by e.user_id) x
                     join public.profiles pr on pr.id = x.user_id)
    );
end $$;

-- ---------------------------------------------------------------- search

create index tasks_search on public.tasks using gin (to_tsvector('simple', title || ' ' || coalesce(description, '')));
create index task_comments_search on public.task_comments using gin (to_tsvector('simple', comment));
create index task_checklist_items_search on public.task_checklist_items using gin (to_tsvector('simple', content));
create index projects_search on public.projects using gin (to_tsvector('simple', name || ' ' || coalesce(description, '')));

-- Full-text search across projects, tasks, comments and checklist items.
-- Every word is matched as a prefix ("auth" finds "authentication"). Security
-- invoker, so row-level security limits results to projects the caller can
-- see. Snippets mark matches with ⟦ ⟧, which the page turns into highlights
-- after escaping the text.
create function public.search(p_query text) returns jsonb
language plpgsql stable set search_path = '' as $$
declare
    q tsquery;
    opts constant text := 'StartSel=⟦,StopSel=⟧,MaxFragments=1,MaxWords=18,MinWords=5';
begin
    select to_tsquery('simple', string_agg(w || ':*', ' & ')) into q
    from regexp_split_to_table(lower(coalesce(p_query, '')), '[^[:alnum:]]+') w
    where w <> '';
    if q is null then
        return '[]'::jsonb;
    end if;

    return coalesce((
        select jsonb_agg(r order by (r ->> 'rank')::real desc)
        from (
            select jsonb_build_object('kind', 'project', 'projectId', p.id, 'title', p.name, 'context', null,
                       'snippet', ts_headline('simple', p.name || ' ' || coalesce(p.description, ''), q, opts),
                       'rank', ts_rank(to_tsvector('simple', p.name || ' ' || coalesce(p.description, '')), q) + 0.2) as r
            from public.projects p
            where to_tsvector('simple', p.name || ' ' || coalesce(p.description, '')) @@ q
            union all
            select jsonb_build_object('kind', 'task', 'projectId', t.project_id, 'taskId', t.id, 'title', t.title, 'context', p.name,
                       'snippet', ts_headline('simple', t.title || ' ' || coalesce(t.description, ''), q, opts),
                       'rank', ts_rank(to_tsvector('simple', t.title || ' ' || coalesce(t.description, '')), q) + 0.1)
            from public.tasks t join public.projects p on p.id = t.project_id
            where to_tsvector('simple', t.title || ' ' || coalesce(t.description, '')) @@ q
            union all
            select jsonb_build_object('kind', 'comment', 'projectId', t.project_id, 'taskId', t.id, 'title', t.title, 'context', p.name,
                       'snippet', ts_headline('simple', c.comment, q, opts),
                       'rank', ts_rank(to_tsvector('simple', c.comment), q))
            from public.task_comments c join public.tasks t on t.id = c.task_id join public.projects p on p.id = t.project_id
            where to_tsvector('simple', c.comment) @@ q
            union all
            select jsonb_build_object('kind', 'checklist', 'projectId', t.project_id, 'taskId', t.id, 'title', t.title, 'context', p.name,
                       'snippet', ts_headline('simple', i.content, q, opts),
                       'rank', ts_rank(to_tsvector('simple', i.content), q))
            from public.task_checklist_items i join public.task_checklists cl on cl.id = i.checklist_id
            join public.tasks t on t.id = cl.task_id join public.projects p on p.id = t.project_id
            where to_tsvector('simple', i.content) @@ q
            limit 40
        ) s
    ), '[]'::jsonb);
end $$;

revoke execute on function public.set_task_estimate(bigint, integer), public.start_timer(bigint), public.stop_timer(),
    public.log_time(bigint, integer, text), public.project_analytics(bigint, date), public.search(text) from public, anon;
grant execute on function public.set_task_estimate(bigint, integer), public.start_timer(bigint), public.stop_timer(),
    public.log_time(bigint, integer, text), public.project_analytics(bigint, date), public.search(text) to authenticated;
