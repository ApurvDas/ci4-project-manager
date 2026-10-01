// Every edit the app can make, as an entry in a table: what it does to the local copy at once
// (`local`, so the page shows it immediately, online or not) and how it reaches the server later
// (`send`, through the same functions the app always used, so role checks still run there).
// Pure apart from `send`, which is handed the Supabase client, so the effects are testable.
//
// An edit made offline waits in the outbox. Rows it creates get temporary NEGATIVE ids
// (the op's number and a counter, the same every time they are worked out) until the server's
// ids arrive; the `refs` of a later edit are swapped for the real ids when it is sent.

const uuid = () => crypto.randomUUID();
const blank = (v) => (v == null || String(v).trim() === '' ? null : String(v).trim());
const hms = (t) => (t && t.length === 5 ? `${t}:00` : t || null); // the server stores HH:MM:SS
const iso = (ms) => new Date(ms).toISOString();

const ref = (s, id) => (typeof id === 'number' && id < 0 ? s.aliases?.[id] ?? id : id);
const find = (rows, id) => rows.find((r) => r.id === id);
const drop = (rows, keep) => { for (let i = rows.length - 1; i >= 0; i--) if (!keep(rows[i])) rows.splice(i, 1); };
const stamp = (c, row) => ({ ...row, created_at: c.now, updated_at: c.now });

const taskColumns = (f) => ({
    title: String(f.title ?? '').trim(), description: blank(f.description), status: f.status || 'todo', priority: f.priority || 'medium',
    start_date: blank(f.start_date), due_date: blank(f.due_date), due_time: blank(f.due_date) ? hms(blank(f.due_time)) : null,
});
const projectColumns = (f) => ({
    name: String(f.name ?? '').trim(), description: blank(f.description), status: f.status || 'planning', priority: f.priority || 'medium',
    start_date: blank(f.start_date), due_date: blank(f.due_date), due_time: blank(f.due_date) ? hms(blank(f.due_time)) : null,
});

function dropTask(s, id) {
    const lists = new Set(s.task_checklists.filter((c) => c.task_id === id).map((c) => c.id));
    drop(s.task_checklist_items, (i) => !lists.has(i.checklist_id));
    for (const t of ['task_assignees', 'task_tags', 'task_comments', 'task_checklists', 'time_entries']) drop(s[t], (r) => r.task_id !== id);
    drop(s.tasks, (t) => t.id !== id);
}
function dropProject(s, id) {
    for (const t of s.tasks.filter((t) => t.project_id === id)) dropTask(s, t.id);
    for (const t of ['project_members', 'tags', 'activity_logs', 'notifications']) drop(s[t], (r) => r.project_id !== id);
    drop(s.projects, (p) => p.id !== id);
}

// Rewrite a column's positions as 0..n, splicing the moved task in (resequence() in the database).
function resequence(s, project, status, taskId, index) {
    const ids = s.tasks.filter((t) => t.project_id === project && t.status === status && t.id !== taskId)
        .sort((a, b) => a.position - b.position || a.id - b.id).map((t) => t.id);
    if (taskId != null) ids.splice(Math.max(0, Math.min(index, ids.length)), 0, taskId);
    ids.forEach((id, i) => { find(s.tasks, id).position = i; });
}

const running = (s) => s.time_entries.filter((e) => e.user_id === s.me.id && !e.ended_at);
const alreadyThere = (error) => /already/i.test(error?.message ?? '');
const missing = (error) => error?.code === 'P0002';

export const OPS = {
    // ------------------------------------------------------------ projects
    createProject: {
        label: (a) => `Create project “${a.fields.name}”`,
        prepare: (a) => ({ ...a, clientId: uuid() }),
        created: (a) => [{ k: 0, table: 'projects', cid: a.clientId }],
        local(s, a, c) {
            const id = c.tid(0);
            s.projects.push(stamp(c, { id, owner_id: s.me.id, ...projectColumns(a.fields), client_id: a.clientId }));
            s.project_members.push({ id: c.tid(1), project_id: id, user_id: s.me.id, role: 'owner', joined_at: c.now, updated_at: c.now });
        },
        send: (sb, a) => sb.rpc('create_project', { p: a.fields, p_client_id: a.clientId }),
    },
    updateProject: {
        refs: ['id'],
        label: (a) => `Edit project “${a.fields.name}”`,
        prepare: (a) => ({ ...a, editedAt: iso(Date.now()) }),
        local(s, a) { Object.assign(find(s.projects, ref(s, a.id)), projectColumns(a.fields)); },
        send: (sb, a) => sb.rpc('update_project', { p_project: a.id, p: a.fields, p_base: a.base ?? null, p_edited_at: a.editedAt }),
    },
    setProjectStatus: {
        refs: ['id'],
        label: (a) => ({ archived: 'Archive the project', completed: 'Mark the project complete' }[a.status] ?? 'Reopen the project'),
        local(s, a) { find(s.projects, ref(s, a.id)).status = a.status; },
        send: (sb, a) => sb.rpc('set_project_status', { p_project: a.id, p_status: a.status }),
    },
    deleteProject: {
        refs: ['id'],
        label: () => 'Delete a project',
        local(s, a) { dropProject(s, ref(s, a.id)); },
        send: (sb, a) => sb.rpc('delete_project', { p_project: a.id }),
        tolerate: missing, // already gone
    },

    // ------------------------------------------------------------ members and tags
    addMember: {
        refs: ['project'],
        label: () => 'Add a member',
        local(s, a, c) {
            s.project_members.push({ id: c.tid(0), project_id: ref(s, a.project), user_id: a.user, role: a.role, joined_at: c.now, updated_at: c.now });
        },
        send: (sb, a) => sb.rpc('add_member', { p_project: a.project, p_user: a.user, p_role: a.role }),
        tolerate: alreadyThere,
    },
    changeRole: {
        refs: ['project'],
        label: (a) => `Change a member’s role to ${a.role}`,
        local(s, a) { const m = s.project_members.find((x) => x.project_id === ref(s, a.project) && x.user_id === a.user); if (m) m.role = a.role; },
        send: (sb, a) => sb.rpc('change_role', { p_project: a.project, p_user: a.user, p_role: a.role }),
        tolerate: alreadyThere,
    },
    removeMember: {
        refs: ['project'],
        label: () => 'Remove a member',
        local(s, a) { drop(s.project_members, (m) => !(m.project_id === ref(s, a.project) && m.user_id === a.user)); },
        send: (sb, a) => sb.rpc('remove_member', { p_project: a.project, p_user: a.user }),
        tolerate: missing,
    },
    addTag: {
        refs: ['project'],
        label: (a) => `Add the tag “${a.name}”`,
        prepare: (a) => ({ ...a, clientId: uuid() }),
        created: (a) => [{ k: 0, table: 'tags', cid: a.clientId }],
        local(s, a, c) { s.tags.push(stamp(c, { id: c.tid(0), project_id: ref(s, a.project), name: a.name.trim(), color: a.color, client_id: a.clientId })); },
        async send(sb, a) {
            const result = await sb.from('tags').insert({ project_id: a.project, name: a.name.trim(), color: a.color, client_id: a.clientId });
            if (result.error?.code === '23505') {
                // Our own earlier attempt (the reply was lost), or someone else's tag with that name?
                const mine = await sb.from('tags').select('id').eq('client_id', a.clientId);
                if (mine.data?.length) return { data: null, error: null };
            }
            return result;
        },
    },
    deleteTag: {
        refs: ['id'],
        label: () => 'Delete a tag',
        local(s, a) { const id = ref(s, a.id); drop(s.task_tags, (l) => l.tag_id !== id); drop(s.tags, (t) => t.id !== id); },
        send: (sb, a) => sb.from('tags').delete().eq('id', a.id),
    },

    // ------------------------------------------------------------ tasks
    // fields: the form's values; base: the values it started from (with "assignees" and "tags").
    saveTask: {
        refs: ['project', 'task', 'tags[]'],
        label: (a) => `${a.task ? 'Edit' : 'Create'} task “${a.fields.title}”`,
        prepare: (a) => ({ ...a, clientId: a.task ? null : uuid(), editedAt: iso(Date.now()) }),
        created: (a) => (a.task ? [] : [{ k: 0, table: 'tasks', cid: a.clientId }]),
        local(s, a, c) {
            const project = ref(s, a.project);
            const cols = taskColumns(a.fields);
            let task = a.task ? find(s.tasks, ref(s, a.task)) : null;
            if (!task) {
                const peers = s.tasks.filter((t) => t.project_id === project && t.status === cols.status);
                task = stamp(c, { id: c.tid(0), project_id: project, created_by: s.me.id, ...cols, position: peers.reduce((m, t) => Math.max(m, t.position), -1) + 1,
                    completed_at: cols.status === 'completed' ? c.now : null, estimate_minutes: null, client_id: a.clientId });
                s.tasks.push(task);
            } else {
                if (task.status !== cols.status) {
                    const peers = s.tasks.filter((t) => t.project_id === project && t.status === cols.status);
                    task.position = peers.reduce((m, t) => Math.max(m, t.position), -1) + 1;
                    task.completed_at = cols.status === 'completed' ? c.now : null;
                }
                Object.assign(task, cols);
            }
            drop(s.task_assignees, (r) => r.task_id !== task.id);
            a.assignees.forEach((user, i) => s.task_assignees.push({ id: c.tid(1 + i), task_id: task.id, user_id: user, assigned_at: c.now, updated_at: c.now }));
            drop(s.task_tags, (r) => r.task_id !== task.id);
            for (const tag of a.tags) s.task_tags.push({ task_id: task.id, tag_id: ref(s, tag), updated_at: c.now });
        },
        send: (sb, a) => sb.rpc('save_task', { p_project: a.project, p_task: a.task ?? null, p: a.fields, p_assignees: a.assignees, p_tags: a.tags,
            p_client_id: a.clientId ?? null, p_base: a.base ?? null, p_edited_at: a.editedAt }),
    },
    setEstimate: {
        refs: ['task'],
        label: () => 'Set a time estimate',
        local(s, a) { const t = find(s.tasks, ref(s, a.task)); if (t) t.estimate_minutes = a.minutes || null; },
        send: (sb, a) => sb.rpc('set_task_estimate', { p_task: a.task, p_minutes: a.minutes }),
    },
    deleteTask: {
        refs: ['task'],
        label: () => 'Delete a task',
        local(s, a) { dropTask(s, ref(s, a.task)); },
        send: (sb, a) => sb.rpc('delete_task', { p_task: a.task }),
        tolerate: missing,
    },
    moveTask: {
        refs: ['task'],
        label: (a) => `Move a card to ${a.status.replace('_', ' ')}`,
        local(s, a, c) {
            const t = find(s.tasks, ref(s, a.task));
            if (!t) return;
            if (t.status !== a.status) {
                const old = t.status;
                t.status = a.status;
                t.completed_at = a.status === 'completed' ? c.now : null;
                resequence(s, t.project_id, old, null, 0);
            }
            resequence(s, t.project_id, a.status, t.id, Math.max(a.position, 0));
        },
        send: (sb, a) => sb.rpc('move_task', { p_task: a.task, p_status: a.status, p_position: a.position }),
    },

    // ------------------------------------------------------------ checklist
    addItems: {
        refs: ['task'],
        label: (a) => `Add ${a.items.length} checklist item${a.items.length === 1 ? '' : 's'}`,
        prepare: (a) => ({ ...a, clientIds: a.items.map(uuid), listClientId: uuid() }),
        created: (a) => a.items.map((_, i) => ({ k: 1 + i, table: 'task_checklist_items', cid: a.clientIds[i] })),
        local(s, a, c) {
            const task = ref(s, a.task);
            let list = s.task_checklists.filter((l) => l.task_id === task).sort((x, y) => x.id - y.id)[0];
            if (!list) {
                list = stamp(c, { id: c.tid(0), task_id: task, title: 'Checklist', client_id: a.listClientId });
                s.task_checklists.push(list);
            }
            a.items.forEach((content, i) => {
                const peers = s.task_checklist_items.filter((x) => x.checklist_id === list.id);
                s.task_checklist_items.push(stamp(c, { id: c.tid(1 + i), checklist_id: list.id, content, is_completed: false, completed_at: null,
                    position: peers.reduce((m, x) => Math.max(m, x.position), -1) + 1, client_id: a.clientIds[i] }));
            });
        },
        send: (sb, a) => sb.rpc('add_checklist_items', { p_task: a.task, p_items: a.items, p_client_ids: a.clientIds, p_list_client_id: a.listClientId }),
    },
    setItem: {
        refs: ['item'],
        label: (a) => (a.done ? 'Tick a checklist item' : 'Untick a checklist item'),
        local(s, a, c) {
            const item = find(s.task_checklist_items, ref(s, a.item));
            if (item) { item.is_completed = a.done; item.completed_at = a.done ? item.completed_at ?? c.now : null; }
        },
        send: (sb, a) => sb.rpc('set_item_done', { p_item: a.item, p_done: a.done }),
    },
    editItem: {
        refs: ['item'],
        label: (a) => `Edit a checklist item to “${a.content}”`,
        prepare: (a) => ({ ...a, editedAt: iso(Date.now()) }),
        local(s, a) { const item = find(s.task_checklist_items, ref(s, a.item)); if (item) item.content = a.content.trim(); },
        send: (sb, a) => sb.rpc('edit_checklist_item', { p_item: a.item, p_content: a.content, p_base: a.base ?? null, p_edited_at: a.editedAt }),
    },
    deleteItem: {
        refs: ['item'],
        label: () => 'Delete a checklist item',
        local(s, a) { drop(s.task_checklist_items, (i) => i.id !== ref(s, a.item)); },
        send: (sb, a) => sb.from('task_checklist_items').delete().eq('id', a.item),
    },

    // ------------------------------------------------------------ comments
    addComment: {
        refs: ['task'],
        label: () => 'Post a comment',
        prepare: (a) => ({ ...a, clientId: uuid() }),
        created: (a) => [{ k: 0, table: 'task_comments', cid: a.clientId }],
        local(s, a, c) {
            s.task_comments.push(stamp(c, { id: c.tid(0), task_id: ref(s, a.task), user_id: s.me.id, comment: a.comment.trim(), client_id: a.clientId }));
        },
        send: (sb, a) => sb.rpc('add_comment', { p_task: a.task, p_comment: a.comment, p_client_id: a.clientId }),
    },
    deleteComment: {
        refs: ['id'],
        label: () => 'Delete a comment',
        local(s, a) { drop(s.task_comments, (m) => m.id !== ref(s, a.id)); },
        send: (sb, a) => sb.from('task_comments').delete().eq('id', a.id),
    },

    // ------------------------------------------------------------ time
    startTimer: {
        refs: ['task'],
        label: () => 'Start the timer',
        prepare: (a) => ({ ...a, clientId: uuid(), startedAt: iso(Date.now()) }),
        created: (a) => [{ k: 0, table: 'time_entries', cid: a.clientId }],
        local(s, a, c) {
            for (const e of running(s)) e.ended_at = e.started_at > a.startedAt ? e.started_at : a.startedAt;
            s.time_entries.push(stamp(c, { id: c.tid(0), task_id: ref(s, a.task), user_id: s.me.id, started_at: a.startedAt, ended_at: null, note: null, client_id: a.clientId }));
        },
        send: (sb, a) => sb.rpc('start_timer', { p_task: a.task, p_client_id: a.clientId, p_started_at: a.startedAt }),
    },
    stopTimer: {
        label: () => 'Stop the timer',
        prepare: (a) => ({ ...a, endedAt: iso(Date.now()) }),
        local(s, a) { for (const e of running(s)) e.ended_at = e.started_at > a.endedAt ? e.started_at : a.endedAt; },
        send: (sb, a) => sb.rpc('stop_timer', { p_ended_at: a.endedAt }),
    },
    logTime: {
        refs: ['task'],
        label: (a) => `Log ${a.minutes} minutes`,
        prepare: (a) => ({ ...a, clientId: uuid(), endedAt: iso(Date.now()) }),
        created: (a) => [{ k: 0, table: 'time_entries', cid: a.clientId }],
        local(s, a, c) {
            s.time_entries.push(stamp(c, { id: c.tid(0), task_id: ref(s, a.task), user_id: s.me.id, started_at: iso(Date.parse(a.endedAt) - a.minutes * 60000),
                ended_at: a.endedAt, note: blank(a.note), client_id: a.clientId }));
        },
        send: (sb, a) => sb.rpc('log_time', { p_task: a.task, p_minutes: a.minutes, p_note: a.note ?? null, p_client_id: a.clientId, p_ended_at: a.endedAt }),
    },
    deleteTime: {
        refs: ['id'],
        label: () => 'Delete a time entry',
        local(s, a) { drop(s.time_entries, (e) => e.id !== ref(s, a.id)); },
        send: (sb, a) => sb.from('time_entries').delete().eq('id', a.id),
    },

    // ------------------------------------------------------------ notifications
    markRead: {
        refs: ['id'],
        label: (a) => (a.id ? 'Mark a notification as read' : 'Mark all notifications as read'),
        prepare: (a) => ({ ...a, at: iso(Date.now()) }),
        local(s, a) { for (const n of s.notifications) if (n.read_at == null && (a.id == null || n.id === a.id)) n.read_at = a.at; },
        send(sb, a) {
            let query = sb.from('notifications').update({ read_at: a.at }).is('read_at', null);
            if (a.id != null) query = query.eq('id', a.id);
            return query;
        },
    },
};

// The temporary ids an op's rows get: stable, negative, and apart from every other op's.
export const tempId = (seq, k) => -(seq * 100000 + k);

// Swap the temporary ids in an op's arguments for the real ones; throws if one is not known yet.
export function translate(op, args, aliases) {
    const out = { ...args };
    const swap = (v) => {
        if (typeof v !== 'number' || v >= 0) return v;
        if (aliases[v] == null) throw new Error('This depends on an earlier change that did not save.');
        return aliases[v];
    };
    for (const name of OPS[op].refs ?? []) {
        if (name.endsWith('[]')) out[name.slice(0, -2)] = (out[name.slice(0, -2)] ?? []).map(swap);
        else if (out[name] != null) out[name] = swap(out[name]);
    }
    return out;
}

// Does the server already have what this op would create? (Its rows came back in a pull.)
export const createdRows = (op, args, s) => (OPS[op].created?.(args) ?? [])
    .map(({ k, table, cid }) => ({ k, row: s[table].find((r) => r.client_id === cid) }));
