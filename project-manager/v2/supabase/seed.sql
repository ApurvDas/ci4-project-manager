-- Development data, ported from app/Database/Seeds. Local only: `npx supabase db reset`.
-- Six users, password Password123! for all; sign in with <name in lower case>@example.test.
-- IronWarrior is a site admin (see the site_admin migration).

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                        confirmation_token, email_change, email_change_token_new, recovery_token)
select '00000000-0000-0000-0000-000000000000', id, 'authenticated', 'authenticated', lower(name) || '@example.test',
       extensions.crypt('Password123!', extensions.gen_salt('bf')), now(),
       '{"provider":"email","providers":["email"]}', jsonb_build_object('username', name), now(), now(), '', '', '', ''
from (values ('00000000-0000-0000-0000-000000000001'::uuid, 'admin'),
             ('00000000-0000-0000-0000-000000000002'::uuid, 'manager'),
             ('00000000-0000-0000-0000-000000000003'::uuid, 'developer'),
             ('00000000-0000-0000-0000-000000000004'::uuid, 'designer'),
             ('00000000-0000-0000-0000-000000000005'::uuid, 'tester'),
             ('00000000-0000-0000-0000-000000000006'::uuid, 'IronWarrior')) u (id, name);

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), id, id::text, jsonb_build_object('sub', id::text, 'email', email), 'email', now(), now(), now()
from auth.users;

update public.profiles set is_admin = true where username = 'IronWarrior';

create temporary table u as select id, username from public.profiles;

insert into public.projects (owner_id, name, description, status, priority, start_date, due_date, created_at)
select (select id from u where username = owner), name, descr, status, priority,
       current_date + start_off, current_date + due_off, now() + make_interval(days => start_off)
from (values
    ('admin',   'Website Redesign',   'Rebuild the public marketing site with a new design system and a faster page load budget.', 'active',    'high',     -30,  14),
    ('manager', 'Mobile Application', 'Ship the first release of the companion mobile app for iOS and Android.',                  'planning',  'critical',  -5,  60),
    ('manager', 'Marketing Campaign', 'Q3 launch campaign covering content, social and partner outreach.',                       'on_hold',   'medium',   -60,  -3),
    ('admin',   'Internal Wiki',      'Consolidate engineering runbooks into a single searchable knowledge base.',               'completed', 'low',     -120, -45)
) p (owner, name, descr, status, priority, start_off, due_off);

create temporary table p as select id, name from public.projects;

insert into public.project_members (project_id, user_id, role, joined_at)
select (select id from p where name = proj), (select id from u where username = who), role, now() - interval '20 days'
from (values
    ('Website Redesign', 'admin', 'owner'), ('Website Redesign', 'manager', 'manager'), ('Website Redesign', 'designer', 'member'),
    ('Website Redesign', 'developer', 'member'), ('Website Redesign', 'tester', 'viewer'),
    ('Mobile Application', 'manager', 'owner'), ('Mobile Application', 'developer', 'member'), ('Mobile Application', 'tester', 'member'),
    ('Marketing Campaign', 'manager', 'owner'), ('Marketing Campaign', 'designer', 'member'),
    ('Internal Wiki', 'admin', 'owner'), ('Internal Wiki', 'developer', 'member')
) m (proj, who, role);

insert into public.tags (project_id, name, color)
select (select id from p where name = proj), tag, color
from (values
    ('Website Redesign', 'Design', '#EC4899'), ('Website Redesign', 'Frontend', '#3B82F6'),
    ('Website Redesign', 'Backend', '#10B981'), ('Website Redesign', 'Urgent', '#EF4444'),
    ('Mobile Application', 'iOS', '#6366F1'), ('Mobile Application', 'Android', '#22C55E'), ('Mobile Application', 'API', '#F59E0B'),
    ('Marketing Campaign', 'Content', '#8B5CF6'), ('Marketing Campaign', 'Social', '#06B6D4'),
    ('Internal Wiki', 'Docs', '#64748B')
) t (proj, tag, color);

-- proj, title, status, priority, creator, assignees, tags, due offset, completed offset, description
create temporary table seed_tasks as
select row_number() over () as ord, * from (values
    ('Website Redesign', 'Design homepage', 'completed', 'high', 'admin', '{designer}'::text[], '{Design}'::text[], -12, -11,
     'Produce the final homepage composition and hand off the spacing and type scale.'),
    ('Website Redesign', 'Build authentication', 'in_progress', 'critical', 'admin', '{developer,tester}', '{Backend,Urgent}', 2, null,
     'Wire up registration, login and password reset on top of CodeIgniter Shield.'),
    ('Website Redesign', 'Create API', 'in_progress', 'high', 'manager', '{developer}', '{Backend}', 7, null,
     'Expose the project and task endpoints consumed by the Kanban board.'),
    ('Website Redesign', 'Migrate legacy content', 'todo', 'medium', 'manager', '{designer,tester}', '{Frontend}', 0, null,
     'Move the remaining marketing pages across and check every redirect.'),
    ('Website Redesign', 'Accessibility audit', 'review', 'medium', 'admin', '{tester}', '{Frontend}', -1, null,
     'Audit against WCAG 2.2 AA and log every violation as a follow-up task.'),
    ('Website Redesign', 'Deploy application', 'todo', 'high', 'admin', '{developer}', '{Backend,Urgent}', 12, null,
     'Cut the production release once the audit findings are cleared.'),
    ('Mobile Application', 'Set up CI pipeline', 'todo', 'high', 'manager', '{developer}', '{API}', 10, null,
     'Build, test and sign both platforms on every push to main.'),
    ('Mobile Application', 'Design onboarding flow', 'todo', 'medium', 'manager', '{manager}', '{iOS}', 18, null,
     'Three-screen first-run experience with an option to skip.'),
    ('Mobile Application', 'Implement push notifications', 'in_progress', 'high', 'developer', '{developer,tester}', '{iOS,Android}', 21, null,
     'Deliver task assignment and due-date reminders to both platforms.'),
    ('Marketing Campaign', 'Draft launch blog post', 'review', 'medium', 'manager', '{designer}', '{Content}', -5, null,
     'Announcement post covering the redesign and the new mobile app.'),
    ('Marketing Campaign', 'Schedule social posts', 'todo', 'low', 'manager', '{manager}', '{Social}', 5, null,
     'Queue two weeks of posts across the usual channels.'),
    ('Internal Wiki', 'Migrate runbooks', 'completed', 'low', 'admin', '{developer}', '{Docs}', -50, -48,
     'Port the on-call runbooks over and retire the old shared drive.'),
    ('Internal Wiki', 'Write contribution guide', 'completed', 'low', 'developer', '{developer}', '{Docs}', -46, -46,
     'Explain how to add and review a page.')
) s (proj, title, status, priority, creator, assignees, tags, due_off, done_off, descr);

-- Positions restart at 0 in every column, in declaration order.
insert into public.tasks (project_id, created_by, title, description, status, priority, position, due_date, completed_at, created_at)
select (select id from p where name = proj), (select id from u where username = creator), title, descr, status, priority,
       row_number() over (partition by proj, status order by ord) - 1,
       current_date + due_off, now() + make_interval(days => done_off), now() - interval '14 days'
from seed_tasks order by ord;

insert into public.task_assignees (task_id, user_id)
select t.id, (select id from u where username = a)
from seed_tasks s join public.tasks t on t.title = s.title, unnest(s.assignees) a;

insert into public.task_tags (task_id, tag_id)
select t.id, g.id
from seed_tasks s
join public.tasks t on t.title = s.title
cross join lateral unnest(s.tags) tag
join public.tags g on g.project_id = t.project_id and g.name = tag;

insert into public.task_checklists (task_id, title)
select id, c.title from (values ('Build authentication', 'Authentication'), ('Deploy application', 'Launch checks'),
                                ('Draft launch blog post', 'Editorial')) c (task, title)
join public.tasks t on t.title = c.task;

-- The position trigger forces new items to unticked, so tick afterwards.
insert into public.task_checklist_items (checklist_id, content)
select c.id, content from (values
    ('Authentication', 1, 'Create login page'), ('Authentication', 2, 'Add validation'),
    ('Authentication', 3, 'Forgot password'), ('Authentication', 4, 'Email verification'),
    ('Launch checks', 1, 'Run migrations'), ('Launch checks', 2, 'Smoke test the checkout'), ('Launch checks', 3, 'Enable database backups'),
    ('Editorial', 1, 'Outline the structure'), ('Editorial', 2, 'Write the first draft'), ('Editorial', 3, 'Editorial review')
) i (list, n, content) join public.task_checklists c on c.title = i.list order by list, n;

-- A couple of deadlines with a time of day.
update public.tasks set due_time = '17:30' where title = 'Build authentication';
update public.projects set due_time = '18:00' where name = 'Website Redesign';

update public.task_checklist_items set is_completed = true, completed_at = now() - interval '2 days'
where content in ('Create login page', 'Add validation', 'Outline the structure', 'Write the first draft');

insert into public.task_comments (task_id, user_id, comment, created_at)
select t.id, (select id from u where username = who), body, now() + make_interval(days => off)
from (values
    ('Build authentication', 'manager', 'Please keep everything on Shield rather than rolling our own session handling.', -4),
    ('Build authentication', 'developer', 'Agreed. Registration and login are done, password reset is next.', -2),
    ('Design homepage', 'admin', 'Signed off. Nice work on the type scale.', -11),
    ('Accessibility audit', 'tester', 'Found three contrast failures in the footer, raising them separately.', -1),
    ('Draft launch blog post', 'designer', 'Draft is ready for review whenever you have a moment.', -5)
) c (task, who, body, off) join public.tasks t on t.title = c.task;

insert into public.notifications (user_id, type, title, message, related_type, related_id, project_id, read_at, created_at)
select (select id from u where username = who), n.type, n.title, n.message, 'task', t.id, t.project_id,
       case when is_read then now() end, now() + make_interval(days => off)
from (values
    ('developer', 'task_assigned', 'You were assigned a task', 'Build authentication', 'Build authentication', -10, false),
    ('tester', 'task_assigned', 'You were assigned a task', 'Build authentication', 'Build authentication', -10, false),
    ('manager', 'task_status_changed', 'A task changed status', 'Draft launch blog post: in progress → review', 'Draft launch blog post', -5, false),
    ('admin', 'comment_added', 'New comment on a task', 'Build authentication', 'Build authentication', -2, true),
    ('designer', 'task_assigned', 'You were assigned a task', 'Design homepage', 'Design homepage', -20, true)
) n (who, type, title, message, task, off, is_read) join public.tasks t on t.title = n.task;

-- History: creation of every project and task.
insert into public.activity_logs (user_id, project_id, entity_type, entity_id, action, description, new_values, created_at)
select owner_id, id, 'project', id, 'create', 'created the project ' || name,
       jsonb_build_object('name', name, 'status', status), created_at
from public.projects
union all
select created_by, project_id, 'task', id, 'create', 'created the task ' || title,
       jsonb_build_object('title', title, 'status', status), created_at
from public.tasks;
