-- Tables ported from app/Database/Migrations (MySQL) to Postgres.
-- Soft deletes are dropped: deletes are hard and cascade; activity_logs keep
-- their rows through ON DELETE SET NULL.

create table public.profiles (
    id       uuid primary key references auth.users (id) on delete cascade,
    username text not null unique check (username ~ '^[A-Za-z0-9._-]{3,30}$')
);

-- Every new auth user gets a profile; the username comes from sign-up metadata.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
    insert into public.profiles (id, username)
    values (new.id, coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1)));
    return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
    for each row execute function public.handle_new_user();

create table public.projects (
    id          bigint generated always as identity primary key,
    owner_id    uuid not null references public.profiles (id) on delete restrict,
    name        text not null check (char_length(name) between 3 and 150),
    description text check (char_length(description) <= 5000),
    status      text not null default 'planning'
                check (status in ('planning', 'active', 'on_hold', 'completed', 'archived')),
    priority    text not null default 'medium'
                check (priority in ('low', 'medium', 'high', 'critical')),
    start_date  date,
    due_date    date,
    due_time    time, -- optional wall-clock time on due_date; null = any time that day
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);
create index on public.projects (owner_id);
create index on public.projects (status);
create index on public.projects (due_date);

create table public.project_members (
    id         bigint generated always as identity primary key,
    project_id bigint not null references public.projects (id) on delete cascade,
    user_id    uuid not null references public.profiles (id) on delete cascade,
    role       text not null default 'member' check (role in ('owner', 'manager', 'member', 'viewer')),
    joined_at  timestamptz not null default now(),
    unique (project_id, user_id)
);
create index on public.project_members (user_id);

create table public.tasks (
    id           bigint generated always as identity primary key,
    project_id   bigint not null references public.projects (id) on delete cascade,
    created_by   uuid not null references public.profiles (id) on delete restrict,
    title        text not null check (char_length(title) between 3 and 200),
    description  text check (char_length(description) <= 5000),
    status       text not null default 'todo' check (status in ('todo', 'in_progress', 'review', 'completed')),
    priority     text not null default 'medium' check (priority in ('low', 'medium', 'high', 'critical')),
    position     integer not null default 0 check (position >= 0),
    start_date   date,
    due_date     date,
    due_time     time, -- optional wall-clock time on due_date; null = any time that day
    completed_at timestamptz,
    created_at   timestamptz not null default now(),
    updated_at   timestamptz not null default now()
);
create index on public.tasks (project_id, status, position);
create index on public.tasks (created_by);
create index on public.tasks (due_date);

create table public.task_assignees (
    id          bigint generated always as identity primary key,
    task_id     bigint not null references public.tasks (id) on delete cascade,
    user_id     uuid not null references public.profiles (id) on delete cascade,
    assigned_at timestamptz not null default now(),
    unique (task_id, user_id)
);
create index on public.task_assignees (user_id);

create table public.task_comments (
    id         bigint generated always as identity primary key,
    task_id    bigint not null references public.tasks (id) on delete cascade,
    user_id    uuid not null references public.profiles (id) on delete restrict,
    comment    text not null check (char_length(btrim(comment)) between 1 and 5000),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create index on public.task_comments (task_id);
create index on public.task_comments (user_id);

create table public.tags (
    id         bigint generated always as identity primary key,
    project_id bigint not null references public.projects (id) on delete cascade,
    name       text not null check (char_length(btrim(name)) between 1 and 50),
    color      text not null default '#6B7280' check (color ~ '^#[0-9A-Fa-f]{6}$'),
    created_at timestamptz not null default now(),
    unique (project_id, name)
);

create table public.task_tags (
    task_id bigint not null references public.tasks (id) on delete cascade,
    tag_id  bigint not null references public.tags (id) on delete cascade,
    primary key (task_id, tag_id)
);
create index on public.task_tags (tag_id);

create table public.task_checklists (
    id         bigint generated always as identity primary key,
    task_id    bigint not null references public.tasks (id) on delete cascade,
    title      text not null check (char_length(btrim(title)) between 1 and 150),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create index on public.task_checklists (task_id);

create table public.task_checklist_items (
    id           bigint generated always as identity primary key,
    checklist_id bigint not null references public.task_checklists (id) on delete cascade,
    content      text not null check (char_length(btrim(content)) between 1 and 255),
    is_completed boolean not null default false,
    position     integer not null default 0 check (position >= 0),
    completed_at timestamptz,
    created_at   timestamptz not null default now(),
    updated_at   timestamptz not null default now()
);
create index on public.task_checklist_items (checklist_id, position);

create table public.notifications (
    id           bigint generated always as identity primary key,
    user_id      uuid not null references public.profiles (id) on delete cascade,
    type         text not null,
    title        text not null,
    message      text,
    related_type text,
    related_id   bigint,
    project_id   bigint references public.projects (id) on delete cascade, -- new: lets task notifications link
    read_at      timestamptz,
    created_at   timestamptz not null default now()
);
create index on public.notifications (user_id, read_at);

create table public.activity_logs (
    id          bigint generated always as identity primary key,
    user_id     uuid references public.profiles (id) on delete set null,
    project_id  bigint references public.projects (id) on delete set null,
    entity_type text not null,
    entity_id   bigint,
    action      text not null,
    description text,
    old_values  jsonb,
    new_values  jsonb,
    created_at  timestamptz not null default now()
);
create index on public.activity_logs (project_id, created_at);
create index on public.activity_logs (entity_type, entity_id);
create index on public.activity_logs (user_id);

-- updated_at maintenance (CodeIgniter did this in PHP).
create function public.touch_updated_at() returns trigger language plpgsql as $$
begin
    new.updated_at := now();
    return new;
end $$;

create trigger touch before update on public.projects             for each row execute function public.touch_updated_at();
create trigger touch before update on public.tasks                for each row execute function public.touch_updated_at();
create trigger touch before update on public.task_comments        for each row execute function public.touch_updated_at();
create trigger touch before update on public.task_checklists      for each row execute function public.touch_updated_at();
create trigger touch before update on public.task_checklist_items for each row execute function public.touch_updated_at();
