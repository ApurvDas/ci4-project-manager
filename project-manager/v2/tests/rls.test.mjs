// Permission rules, tested through the public API exactly as a browser would call it.
// Needs the local stack: `npx supabase start`. Resets the database first.
//
// Seed roles — Website Redesign: admin owner, manager manager, designer + developer member, tester viewer.
//              Internal Wiki: admin owner, developer member (designer is not a member).
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

const URL = 'http://127.0.0.1:54321';
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

const as = {};
let ids = {};

async function signIn(name) {
    const client = createClient(URL, ANON, { auth: { persistSession: false } });
    const { data, error } = await client.auth.signInWithPassword({ email: `${name}@example.test`, password: 'Password123!' });
    assert.ifError(error);
    client.uid = data.user.id;
    return client;
}

const code = (result) => result.error?.code;

before(async () => {
    execSync('npx supabase db reset', { stdio: 'ignore' });
    for (const name of ['admin', 'manager', 'developer', 'designer', 'tester', 'ironwarrior']) {
        as[name] = await signIn(name);
    }
    // Between them, admin and manager are members of every seeded project.
    for (const who of [as.admin, as.manager]) {
        const { data: projects } = await who.from('projects').select('id, name');
        const { data: tasks } = await who.from('tasks').select('id, title, status, position, project_id');
        Object.assign(ids, Object.fromEntries([...projects.map((p) => [p.name, p.id]), ...tasks.map((t) => [t.title, t])]));
    }
});

test('a non-member sees nothing of a project', async () => {
    const { data } = await as.designer.from('projects').select('id').eq('id', ids['Internal Wiki']);
    assert.equal(data.length, 0);
    const tasks = await as.designer.from('tasks').select('id').eq('project_id', ids['Internal Wiki']);
    assert.equal(tasks.data.length, 0);
});

test('anonymous callers get nothing', async () => {
    const anon = createClient(URL, ANON, { auth: { persistSession: false } });
    assert.equal((await anon.from('projects').select('id')).data.length, 0);
    assert.ok((await anon.rpc('dashboard')).error);
});

test('a viewer cannot move a task; a member can, and positions stay dense', async () => {
    const task = ids['Migrate legacy content'];
    assert.equal(code(await as.tester.rpc('move_task', { p_task: task.id, p_status: 'review', p_position: 0 })), '42501');

    assert.ifError((await as.developer.rpc('move_task', { p_task: task.id, p_status: 'review', p_position: 0 })).error);

    const { data } = await as.developer.from('tasks').select('title, status, position')
        .eq('project_id', task.project_id).order('status').order('position');
    for (const status of ['todo', 'review']) {
        const positions = data.filter((t) => t.status === status).map((t) => t.position);
        assert.deepEqual(positions, positions.map((_, i) => i), `${status} column is 0..n`);
    }
    assert.equal(data.find((t) => t.title === 'Migrate legacy content').position, 0);

    // Logged, and the interested users (not the actor) were notified.
    const log = await as.developer.from('activity_logs').select('description').eq('entity_id', task.id).eq('action', 'update');
    assert.match(log.data[0].description, /^moved Migrate legacy content from todo to review$/);
    const own = await as.developer.from('notifications').select('id').eq('related_id', task.id).eq('type', 'task_status_changed');
    assert.equal(own.data.length, 0, 'actor is not notified');
    const designer = await as.designer.from('notifications').select('message').eq('related_id', task.id).eq('type', 'task_status_changed');
    assert.equal(designer.data.length, 1);
});

test('member rules: add/remove/change role follow ProjectPolicy', async () => {
    const wr = ids['Website Redesign'];
    // A manager may not add a manager, nor anyone as owner.
    assert.equal(code(await as.manager.rpc('add_member', { p_project: wr, p_user: as.designer.uid, p_role: 'manager' })), '42501');
    // Nobody writes project_members directly.
    assert.ok((await as.admin.from('project_members').insert({ project_id: wr, user_id: as.designer.uid, role: 'owner' })).error);
    // Only the owner changes roles, and never to owner.
    assert.equal(code(await as.manager.rpc('change_role', { p_project: wr, p_user: as.designer.uid, p_role: 'viewer' })), '42501');
    assert.equal(code(await as.admin.rpc('change_role', { p_project: wr, p_user: as.designer.uid, p_role: 'owner' })), '42501');
    assert.ifError((await as.admin.rpc('change_role', { p_project: wr, p_user: as.designer.uid, p_role: 'manager' })).error);
    // A manager cannot remove another manager, or the owner; can remove a member.
    assert.equal(code(await as.manager.rpc('remove_member', { p_project: wr, p_user: as.designer.uid })), '42501');
    assert.equal(code(await as.manager.rpc('remove_member', { p_project: wr, p_user: as.admin.uid })), '42501');
    assert.ifError((await as.manager.rpc('remove_member', { p_project: wr, p_user: as.tester.uid })).error);
    // The owner adds them back; they get an invitation.
    assert.ifError((await as.admin.rpc('add_member', { p_project: wr, p_user: as.tester.uid, p_role: 'viewer' })).error);
    const invite = await as.tester.from('notifications').select('title').eq('type', 'project_invitation');
    assert.equal(invite.data.length, 1);
});

test('only the owner archives, including through the edit form', async () => {
    const wr = ids['Website Redesign'];
    const { data: p } = await as.manager.from('projects').select('*').eq('id', wr).single();
    assert.equal(code(await as.manager.rpc('update_project', { p_project: wr, p: { ...p, status: 'archived' } })), '42501');
    assert.equal(code(await as.manager.rpc('set_project_status', { p_project: wr, p_status: 'archived' })), '42501');
    assert.ifError((await as.manager.rpc('update_project', { p_project: wr, p: { ...p, priority: 'critical' } })).error);
    assert.ifError((await as.admin.rpc('set_project_status', { p_project: wr, p_status: 'archived' })).error);
    assert.ifError((await as.admin.rpc('set_project_status', { p_project: wr, p_status: 'active' })).error);

    // Mark complete: owner only, and a bad status is still rejected.
    assert.equal(code(await as.manager.rpc('set_project_status', { p_project: wr, p_status: 'completed' })), '42501');
    assert.equal(code(await as.admin.rpc('set_project_status', { p_project: wr, p_status: 'bogus' })), '22023');
    assert.ifError((await as.admin.rpc('set_project_status', { p_project: wr, p_status: 'completed' })).error);
    assert.equal((await as.admin.from('projects').select('status').eq('id', wr).single()).data.status, 'completed');
    assert.ifError((await as.admin.rpc('set_project_status', { p_project: wr, p_status: 'active' })).error);
});

test('settle_projects completes a past-deadline project only when all its work is done', async () => {
    const wiki = ids['Internal Wiki'];            // 100% done, due 45 days ago, seeded as completed
    const mc = ids['Marketing Campaign'];         // 33% done, due 3 days ago, on hold
    const status = async (id, who = as.admin) => (await who.from('projects').select('status').eq('id', id).single()).data.status;
    const { data: w } = await as.admin.from('projects').select('*').eq('id', wiki).single();
    const reopen = (changes) => as.admin.rpc('update_project', { p_project: wiki, p: { ...w, status: 'active', ...changes } });

    const anon = createClient(URL, ANON, { auth: { persistSession: false } });
    assert.ok((await anon.rpc('settle_projects')).error);

    // Not due yet: left alone, however finished it is.
    assert.ifError((await reopen({ due_date: '2099-01-01' })).error);
    assert.ifError((await as.designer.rpc('settle_projects')).error);
    assert.equal(await status(wiki), 'active');

    // Archived stays archived.
    assert.ifError((await as.admin.rpc('set_project_status', { p_project: wiki, p_status: 'archived' })).error);
    assert.ifError((await as.designer.rpc('settle_projects')).error);
    assert.equal(await status(wiki), 'archived');

    // Past due and 100%: completed, logged as the system. With work left, untouched.
    assert.ifError((await reopen({})).error);
    assert.ifError((await as.designer.rpc('settle_projects')).error);
    assert.equal(await status(wiki), 'completed');
    assert.equal(await status(mc, as.manager), 'on_hold');
    const { data: log } = await as.admin.from('activity_logs').select('user_id, description').eq('project_id', wiki).eq('action', 'auto');
    assert.equal(log.length, 1);
    assert.equal(log[0].user_id, null);
    assert.match(log[0].description, /marked the project complete/);

    // Nothing left to settle, so a second run changes nothing.
    assert.equal((await as.designer.rpc('settle_projects')).data, 0);
});

test('save_task: assignees must be members, tags from this project; diff is logged', async () => {
    const wr = ids['Website Redesign'];
    const fields = { title: 'Write tests', status: 'todo', priority: 'low' };
    // tester is not in Marketing Campaign.
    assert.equal(code(await as.manager.rpc('save_task', { p_project: ids['Marketing Campaign'], p_task: null, p: fields, p_assignees: [as.tester.uid], p_tags: [] })), '22023');
    const { data: wikiTag } = await as.admin.from('tags').select('id').eq('project_id', ids['Internal Wiki']).single();
    assert.equal(code(await as.admin.rpc('save_task', { p_project: wr, p_task: null, p: fields, p_assignees: [], p_tags: [wikiTag.id] })), '22023');

    const created = await as.developer.rpc('save_task', { p_project: wr, p_task: null, p: fields, p_assignees: [as.designer.uid], p_tags: [] });
    assert.ifError(created.error);
    const assigned = await as.designer.from('notifications').select('id').eq('related_id', created.data).eq('type', 'task_assigned');
    assert.equal(assigned.data.length, 1);

    const updated = await as.developer.rpc('save_task', { p_project: wr, p_task: created.data, p: { ...fields, status: 'completed' }, p_assignees: [as.designer.uid], p_tags: [] });
    assert.ifError(updated.error);
    const { data: task } = await as.developer.from('tasks').select('completed_at').eq('id', created.data).single();
    assert.ok(task.completed_at, 'completed_at set');
    const { data: log } = await as.developer.from('activity_logs').select('action, old_values, new_values')
        .eq('entity_id', created.data).eq('action', 'complete').single();
    assert.deepEqual(log.new_values, { status: 'completed' });
    assert.deepEqual(log.old_values, { status: 'todo' });
});

test('delete task: creator or manager+ only', async () => {
    const task = ids['Create API']; // created by manager
    assert.equal(code(await as.developer.rpc('delete_task', { p_task: task.id })), '42501');
    assert.equal(code(await as.designer.rpc('delete_task', { p_task: ids['Migrate runbooks'].id })), 'P0002'); // non-member
    assert.ifError((await as.manager.rpc('delete_task', { p_task: task.id })).error);
});

test('comments, tags, checklists', async () => {
    const task = ids['Build authentication'];
    assert.equal(code(await as.tester.rpc('add_comment', { p_task: task.id, p_comment: 'hi' })), '42501'); // viewer
    const added = await as.designer.rpc('add_comment', { p_task: task.id, p_comment: 'Looks good' });
    assert.ifError(added.error);
    // Another member cannot delete it (RLS filters it out: zero rows); the author can.
    const { data: gone } = await as.developer.from('task_comments').delete().eq('id', added.data).select();
    assert.equal(gone.length, 0);
    assert.equal((await as.designer.from('task_comments').delete().eq('id', added.data).select()).data.length, 1);

    const tag = await as.developer.from('tags').insert({ project_id: task.project_id, name: 'QA' }).select().single();
    assert.ifError(tag.error);
    assert.equal((await as.developer.from('tags').delete().eq('id', tag.data.id).select()).data.length, 0);
    assert.equal((await as.manager.from('tags').delete().eq('id', tag.data.id).select()).data.length, 1);

    const { data: item } = await as.developer.from('task_checklist_items').select('id, is_completed')
        .eq('content', 'Forgot password').single();
    assert.equal(code(await as.tester.rpc('toggle_item', { p_item: item.id })), '42501');
    const progress = await as.developer.rpc('toggle_item', { p_item: item.id });
    assert.deepEqual(progress.data, { completed: 3, total: 4, percent: 75 });
});

test('notifications: own rows only, and only read_at is writable', async () => {
    const { data: mine } = await as.developer.from('notifications').select('id, user_id');
    assert.ok(mine.length > 0);
    assert.ok(mine.every((n) => n.user_id === as.developer.uid));
    assert.ok((await as.developer.from('notifications').update({ title: 'x' }).eq('id', mine[0].id)).error);
    assert.ifError((await as.developer.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', mine[0].id)).error);
});

test('dashboard counts', async () => {
    const { data, error } = await as.developer.rpc('dashboard');
    assert.ifError(error);
    assert.equal(data.myProjects.length, 3);
    assert.ok(data.taskCounts.assigned >= 5);
    assert.ok(data.myTasks.every((t) => t.status !== 'completed'));
});

test('a site admin has owner-level access everywhere; nobody can grant it to themselves', async () => {
    const { data: projects } = await as.ironwarrior.from('projects').select('id');
    assert.equal(projects.length, 4, 'sees every project without being a member');
    assert.equal((await as.ironwarrior.rpc('my_project_role', { p_project: ids['Marketing Campaign'] })).data, 'owner');
    // Not a member anywhere yet: all four are "other projects going on", none are theirs.
    const dash = (await as.ironwarrior.rpc('dashboard')).data;
    assert.equal(dash.myProjects.length, 0);
    assert.equal(dash.otherProjects.length, 4);
    assert.ok(dash.otherProjects.every((p) => p.is_member === false));
    // Owner-only action on a project they are not a member of.
    assert.ifError((await as.ironwarrior.rpc('set_project_status', { p_project: ids['Marketing Campaign'], p_status: 'archived' })).error);

    // A normal user cannot flip the flag (no update policy on profiles).
    await as.designer.from('profiles').update({ is_admin: true }).eq('id', as.designer.uid);
    const { data: me } = await as.designer.from('profiles').select('is_admin').eq('id', as.designer.uid).single();
    assert.equal(me.is_admin, false);
    assert.equal((await as.designer.rpc('my_project_role', { p_project: ids['Internal Wiki'] })).data, null);
});

test('deadline time: saved, optional, ignored without a date, and not logged as a change when unchanged', async () => {
    const wr = ids['Website Redesign'];
    const fields = { title: 'Timed task', status: 'todo', priority: 'low', due_date: '2030-01-15', due_time: '17:30' };
    const tid = (await as.manager.rpc('save_task', { p_project: wr, p_task: null, p: fields, p_assignees: [], p_tags: [] })).data;
    const { data: saved } = await as.manager.from('tasks').select('due_date, due_time').eq('id', tid).single();
    assert.deepEqual(saved, { due_date: '2030-01-15', due_time: '17:30:00' });

    // Same values again (the form sends "17:30"): nothing changed, so nothing logged.
    await as.manager.rpc('save_task', { p_project: wr, p_task: tid, p: fields, p_assignees: [], p_tags: [] });
    const { data: logs } = await as.manager.from('activity_logs').select('id').eq('entity_id', tid).eq('action', 'update');
    assert.equal(logs.length, 0);

    // A time without a date is meaningless and dropped.
    await as.manager.rpc('save_task', { p_project: wr, p_task: tid, p: { ...fields, due_date: '' }, p_assignees: [], p_tags: [] });
    const { data: cleared } = await as.manager.from('tasks').select('due_date, due_time').eq('id', tid).single();
    assert.deepEqual(cleared, { due_date: null, due_time: null });

    // Overdue is judged by the viewer's clock: due today at 17:30 is overdue at 18:00, not at 09:00.
    await as.manager.rpc('save_task', { p_project: wr, p_task: tid, p: { ...fields, due_date: '2030-01-15' }, p_assignees: [as.developer.uid], p_tags: [] });
    const at = async (time) => (await as.developer.rpc('dashboard', { p_today: '2030-01-15', p_now: time })).data.taskCounts;
    const morning = await at('09:00');
    const evening = await at('18:00');
    assert.equal(evening.overdue - morning.overdue, 1);
    assert.equal(morning.due_today - evening.due_today, 1);
});

test('add_checklist: many items at once, in order, all or nothing', async () => {
    const task = ids['Deploy application'];
    assert.equal(code(await as.tester.rpc('add_checklist', { p_task: task.id, p_title: 'Nope', p_items: ['a'] })), '42501'); // viewer

    const cid = (await as.developer.rpc('add_checklist', { p_task: task.id, p_title: 'Demo steps', p_items: ['Log in', '', 'Go online', 'Accept ride'] })).data;
    const { data: items } = await as.developer.from('task_checklist_items').select('content, position, is_completed')
        .eq('checklist_id', cid).order('position');
    assert.deepEqual(items.map((i) => [i.content, i.position]), [['Log in', 0], ['Go online', 1], ['Accept ride', 2]]);
    assert.ok(items.every((i) => !i.is_completed));

    // A too-long item rolls the whole thing back: no half-made checklist.
    assert.ok((await as.developer.rpc('add_checklist', { p_task: task.id, p_title: 'Broken', p_items: ['ok', 'x'.repeat(300)] })).error);
    const { data: broken } = await as.developer.from('task_checklists').select('id').eq('title', 'Broken');
    assert.equal(broken.length, 0);
});

test('checklists: member+ renames and deletes; viewers cannot; ticks only via toggle_item', async () => {
    const task = ids['Build authentication'];
    const { data: list } = await as.developer.from('task_checklists').select('id').eq('task_id', task.id).eq('title', 'Authentication').single();
    const { data: item } = await as.developer.from('task_checklist_items').select('id').eq('content', 'Add validation').single();

    // Viewer: RLS filters the rows out, so nothing changes.
    assert.equal((await as.tester.from('task_checklists').update({ title: 'Hacked' }).eq('id', list.id).select()).data.length, 0);
    assert.equal((await as.tester.from('task_checklist_items').delete().eq('id', item.id).select()).data.length, 0);

    // Member: rename, edit text.
    assert.equal((await as.developer.from('task_checklists').update({ title: 'Auth' }).eq('id', list.id).select()).data.length, 1);
    assert.equal((await as.developer.from('task_checklist_items').update({ content: 'Validate input' }).eq('id', item.id).select()).data.length, 1);
    // ...but not flip the tick directly (column not granted).
    assert.ok((await as.developer.from('task_checklist_items').update({ is_completed: false }).eq('id', item.id)).error);

    // Member: delete an item, then the whole checklist (its items go with it).
    assert.equal((await as.developer.from('task_checklist_items').delete().eq('id', item.id).select()).data.length, 1);
    assert.equal((await as.developer.from('task_checklists').delete().eq('id', list.id).select()).data.length, 1);
    const { data: left } = await as.developer.from('task_checklist_items').select('id').eq('checklist_id', list.id);
    assert.equal(left.length, 0);
});

test('add_checklist_items: one flat list per task, created on first use', async () => {
    const wr = ids['Website Redesign'];
    const tid = (await as.manager.rpc('save_task', { p_project: wr, p_task: null, p: { title: 'Flat list task', status: 'todo', priority: 'low' }, p_assignees: [], p_tags: [] })).data;

    assert.equal(code(await as.tester.rpc('add_checklist_items', { p_task: tid, p_items: ['nope'] })), '42501'); // viewer
    assert.equal((await as.developer.rpc('add_checklist_items', { p_task: tid, p_items: ['One', ' ', 'Two'] })).data, 2);
    assert.equal((await as.developer.rpc('add_checklist_items', { p_task: tid, p_items: ['Three'] })).data, 1);

    const { data: lists } = await as.developer.from('task_checklists').select('id, task_checklist_items(content, position)').eq('task_id', tid);
    assert.equal(lists.length, 1, 'all items share one checklist');
    const items = lists[0].task_checklist_items.sort((a, b) => a.position - b.position).map((i) => i.content);
    assert.deepEqual(items, ['One', 'Two', 'Three']);
});

test('project progress moves with checklist ticks, and completed tasks count fully', async () => {
    const wiki = ids['Internal Wiki'];            // 2 tasks, both completed
    assert.equal((await as.admin.rpc('project_progress', { p_project: wiki })).data, 100);

    const mc = ids['Marketing Campaign'];         // 2 open tasks; "Draft launch blog post" has 2 of 3 items ticked
    const before = (await as.manager.rpc('project_progress', { p_project: mc })).data;
    assert.equal(before, 33);                    // (66.7% + 0%) / 2

    const { data: item } = await as.manager.from('task_checklist_items').select('id').eq('content', 'Editorial review').single();
    await as.manager.rpc('toggle_item', { p_item: item.id });
    assert.equal((await as.manager.rpc('project_progress', { p_project: mc })).data, 50); // (100% + 0%) / 2

    const dash = (await as.manager.rpc('dashboard')).data;
    assert.equal(dash.myProjects.find((p) => p.id === mc).progress, 50, 'dashboard agrees');
    assert.equal((await as.designer.rpc('project_progress', { p_project: ids['Mobile Application'] })).data, 0, 'non-member sees nothing');
});

test('time tracking: member+ starts/stops/logs; one running timer each; viewers cannot', async () => {
    const task = ids['Build authentication'];
    assert.equal(code(await as.tester.rpc('start_timer', { p_task: task.id })), '42501'); // viewer
    assert.equal(code(await as.designer.rpc('log_time', { p_task: ids['Migrate runbooks'].id, p_minutes: 30 })), 'P0002'); // non-member

    const first = (await as.developer.rpc('start_timer', { p_task: task.id })).data;
    const second = (await as.developer.rpc('start_timer', { p_task: ids['Deploy application'].id })).data; // stops the first
    const { data: running } = await as.developer.from('time_entries').select('id').eq('user_id', as.developer.uid).is('ended_at', null);
    assert.deepEqual(running.map((r) => r.id), [second]);
    await as.developer.rpc('stop_timer');
    const { data: none } = await as.developer.from('time_entries').select('id').eq('user_id', as.developer.uid).is('ended_at', null);
    assert.equal(none.length, 0);
    assert.ok(first);

    assert.equal(code(await as.developer.rpc('log_time', { p_task: task.id, p_minutes: 0 })), '22023');
    assert.ifError((await as.developer.rpc('log_time', { p_task: task.id, p_minutes: 90, p_note: 'Pairing' })).error);
    assert.ifError((await as.manager.rpc('set_task_estimate', { p_task: task.id, p_minutes: 240 })).error);

    // Another member can see but not delete someone else's entry.
    const { data: mine } = await as.developer.from('time_entries').select('id').eq('note', 'Pairing').single();
    assert.equal((await as.designer.from('time_entries').delete().eq('id', mine.id).select()).data.length, 0);
    assert.equal((await as.developer.from('time_entries').delete().eq('id', mine.id).select()).data.length, 1);
});

test('project analytics: members only, with weekly, burndown and totals', async () => {
    assert.equal(code(await as.designer.rpc('project_analytics', { p_project: ids['Internal Wiki'] })), 'P0002');
    const { data, error } = await as.admin.rpc('project_analytics', { p_project: ids['Internal Wiki'] });
    assert.ifError(error);
    assert.equal(data.weekly.length, 8);
    assert.equal(data.burndown.length, 30);
    assert.equal(data.totals.tasks, 2);
    assert.equal(data.totals.completed, 2);
    assert.ok(data.avgDaysToFinish !== null);
});

test('search: prefix matches across tasks, comments and checklists, only in visible projects', async () => {
    const found = (await as.developer.rpc('search', { p_query: 'auth' })).data;
    assert.ok(found.some((r) => r.kind === 'task' && r.title === 'Build authentication'));
    assert.ok(found.every((r) => typeof r.snippet === 'string'));
    const kinds = new Set((await as.developer.rpc('search', { p_query: 'shield' })).data.map((r) => r.kind));
    assert.ok(kinds.has('comment') || kinds.has('task'));
    assert.ok((await as.developer.rpc('search', { p_query: 'backups' })).data.some((r) => r.kind === 'checklist'));
    // designer is not in Internal Wiki, so its runbooks task never shows up.
    assert.equal((await as.designer.rpc('search', { p_query: 'runbooks' })).data.length, 0);
    assert.ok((await as.developer.rpc('search', { p_query: 'runbooks' })).data.length > 0);
    assert.deepEqual((await as.developer.rpc('search', { p_query: '  !! ' })).data, []);
});
