// What each page reads, computed from the local copy instead of asked of the server.
// Pure functions over a snapshot `s`: { me, projects, tasks, ... } with one array per table,
// no browser APIs, so tests run them against the server's own answers. Each one returns the
// same shape the page's PostgREST query used to, so rendering code barely changes.
// ponytail: plain scans (no indexes) — fine for thousands of rows, add maps if a copy gets large.

const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const nullsLast = (a, b) => (a == null) - (b == null) || cmp(a, b);
const byDue = (a, b) => nullsLast(a.due_date, b.due_date) || nullsLast(a.due_time, b.due_time) || a.id - b.id;
const newest = (a, b) => cmp(b.created_at, a.created_at) || b.id - a.id;
const name = (s, id) => s.profiles.find((p) => p.id === id)?.username ?? '';
const who = (s, id) => ({ username: name(s, id) });
// An id from the address bar may be a temporary one (a row made offline); once the server has
// assigned a real id, the alias map knows it.
const rid = (s, id) => (typeof id === 'number' && id < 0 ? s.aliases?.[id] ?? id : id);

// The caller's role in a project: their own membership, else owner if they are a site admin.
export function role(s, pid) {
    const mine = s.project_members.find((m) => m.project_id === pid && m.user_id === s.me.id);
    return mine?.role ?? (s.me.is_admin && s.projects.some((p) => p.id === pid) ? 'owner' : null);
}

// A task counts 100% when completed, else the share of its checklist ticked; a project is
// the rounded average of its tasks. Same rule as project_progress() in the database.
function progressOf(s) {
    const listTask = new Map(s.task_checklists.map((c) => [c.id, c.task_id]));
    const total = new Map();
    const done = new Map();
    for (const i of s.task_checklist_items) {
        const t = listTask.get(i.checklist_id);
        if (t == null) continue;
        total.set(t, (total.get(t) ?? 0) + 1);
        if (i.is_completed) done.set(t, (done.get(t) ?? 0) + 1);
    }
    const task = (t) => (t.status === 'completed' ? 100 : total.get(t.id) ? (100 * (done.get(t.id) ?? 0)) / total.get(t.id) : 0);
    return (pid) => {
        const tasks = s.tasks.filter((t) => t.project_id === pid);
        return tasks.length ? Math.round(tasks.reduce((sum, t) => sum + task(t), 0) / tasks.length + 1e-9) : 0;
    };
}
export const progress = (s, pid) => progressOf(s)(pid);

export const unread = (s) => s.notifications.filter((n) => n.read_at == null).length;

export function projectAndRole(s, pid) {
    pid = rid(s, pid);
    return { project: s.projects.find((p) => p.id === pid) ?? null, role: role(s, pid) };
}

const tagsOf = (s, task) => s.task_tags.filter((l) => l.task_id === task.id)
    .map((l) => s.tags.find((t) => t.id === l.tag_id)).filter(Boolean).map(({ name, color }) => ({ name, color }));
const assigneesOf = (s, task) => s.task_assignees.filter((a) => a.task_id === task.id).map((a) => ({ profile: who(s, a.user_id) }));
const withProfile = (s, rows) => rows.map((r) => ({ ...r, profile: s.profiles.some((p) => p.id === r.user_id) ? who(s, r.user_id) : null }));

// Dashboard and project list (the dashboard() function in the database, same keys).
export function dashboard(s, today, now) {
    const prog = progressOf(s);
    const member = new Set(s.project_members.filter((m) => m.user_id === s.me.id).map((m) => m.project_id));
    const mine = s.projects
        .map((p) => ({ ...p, role: role(s, p.id), is_member: member.has(p.id), progress: prog(p.id) }))
        .sort((a, b) => nullsLast(a.due_date, b.due_date) || b.id - a.id);
    const assigned = s.task_assignees.filter((a) => a.user_id === s.me.id)
        .map((a) => s.tasks.find((t) => t.id === a.task_id)).filter(Boolean)
        .map((t) => ({ ...t, project_name: s.projects.find((p) => p.id === t.project_id)?.name }));
    const open = assigned.filter((t) => t.status !== 'completed');
    const late = (t) => t.due_date != null && (t.due_date < today || (t.due_date === today && t.due_time != null && t.due_time < now));
    const counts = {};
    for (const p of mine.filter((p) => p.is_member)) counts[p.status] = (counts[p.status] ?? 0) + 1;
    return {
        projectCounts: counts,
        taskCounts: {
            assigned: assigned.length,
            overdue: open.filter(late).length,
            due_today: open.filter((t) => t.due_date === today && (t.due_time == null || t.due_time >= now)).length,
            completed: assigned.length - open.length,
        },
        myProjects: mine.filter((p) => p.is_member),
        otherProjects: mine.filter((p) => !p.is_member),
        myTasks: open.sort(byDue).slice(0, 8),
        notifications: [...s.notifications].sort(newest).slice(0, 5),
        unread: unread(s),
    };
}

// Tags of the tasks on the dashboard, keyed by task id.
export const tagsByTask = (s, tasks) => Object.fromEntries(tasks.map((t) => [t.id, tagsOf(s, t)]));

const members = (s, pid) => s.project_members.filter((m) => m.project_id === pid)
    .map((m) => ({ user_id: m.user_id, role: m.role, profile: who(s, m.user_id) }));
const tagList = (s, pid) => s.tags.filter((t) => t.project_id === pid).sort((a, b) => a.name.localeCompare(b.name));

export function projectPage(s, pid) {
    pid = rid(s, pid);
    const { project, role: r } = projectAndRole(s, pid);
    if (!project) return null;
    return {
        project,
        role: r,
        percent: progress(s, pid),
        tasks: s.tasks.filter((t) => t.project_id === pid).sort(byDue)
            .map(({ id, title, status, priority, due_date, due_time }) => ({ id, title, status, priority, due_date, due_time })),
        members: members(s, pid),
        tags: tagList(s, pid),
        activity: withProfile(s, s.activity_logs.filter((a) => a.project_id === pid).sort(newest).slice(0, 12)),
        profiles: s.profiles.map(({ id, username }) => ({ id, username })).sort((a, b) => a.username.localeCompare(b.username)),
    };
}

export function taskPage(s, pid, id) {
    pid = rid(s, pid);
    id = rid(s, id);
    const { project, role: r } = projectAndRole(s, pid);
    const row = s.tasks.find((t) => t.id === id && t.project_id === pid);
    if (!project || !row) return null;
    return {
        project,
        role: r,
        task: { ...row, tags: tagsOf(s, row), task_assignees: assigneesOf(s, row) },
        checklists: s.task_checklists.filter((c) => c.task_id === id).sort((a, b) => a.id - b.id).map((c) => ({
            id: c.id,
            title: c.title,
            task_checklist_items: s.task_checklist_items.filter((i) => i.checklist_id === c.id)
                .map(({ id: itemId, content, is_completed, position }) => ({ id: itemId, content, is_completed, position })),
        })),
        comments: withProfile(s, s.task_comments.filter((c) => c.task_id === id)).sort((a, b) => cmp(a.created_at, b.created_at) || a.id - b.id),
        activity: withProfile(s, s.activity_logs.filter((a) => a.entity_type === 'task' && a.entity_id === id).sort(newest).slice(0, 10)),
        timeEntries: withProfile(s, s.time_entries.filter((e) => e.task_id === id)).sort((a, b) => cmp(b.started_at, a.started_at)),
    };
}

// Task list (and the project's task cards): tags on every task, assignees for the board.
export function tasksPage(s, pid) {
    pid = rid(s, pid);
    const { project, role: r } = projectAndRole(s, pid);
    if (!project) return null;
    const tasks = s.tasks.filter((t) => t.project_id === pid);
    return {
        project,
        role: r,
        list: [...tasks].sort(byDue).map((t) => ({
            id: t.id, title: t.title, status: t.status, priority: t.priority, due_date: t.due_date, due_time: t.due_time, tags: tagsOf(s, t),
        })),
        board: [...tasks].sort((a, b) => a.position - b.position || a.id - b.id).map((t) => ({
            id: t.id, title: t.title, status: t.status, priority: t.priority, due_date: t.due_date, due_time: t.due_time,
            position: t.position, tags: tagsOf(s, t), task_assignees: assigneesOf(s, t),
        })),
    };
}

export function activityPage(s, pid, filters, pageNo, perPage) {
    pid = rid(s, pid);
    const { project } = projectAndRole(s, pid);
    if (!project) return null;
    const all = withProfile(s, s.activity_logs.filter((a) => a.project_id === pid
        && Object.entries(filters).every(([field, value]) => !value || String(a[field]) === value)).sort(newest));
    return {
        project,
        count: all.length,
        entries: all.slice((pageNo - 1) * perPage, pageNo * perPage),
        members: members(s, pid),
    };
}

export const notificationsPage = (s) => [...s.notifications].sort(newest).slice(0, 50);

// The task form reads the task with its assignee and tag ids, plus the people and tags to pick from.
export function taskFormPage(s, pid, id) {
    pid = rid(s, pid);
    id = rid(s, id);
    const { project, role: r } = projectAndRole(s, pid);
    if (!project) return null;
    let task = null;
    if (id) {
        const row = s.tasks.find((t) => t.id === id && t.project_id === pid);
        if (!row) return null;
        task = {
            ...row,
            task_assignees: s.task_assignees.filter((a) => a.task_id === id).map((a) => ({ user_id: a.user_id })),
            task_tags: s.task_tags.filter((l) => l.task_id === id).map((l) => ({ tag_id: l.tag_id })),
        };
    }
    return { project, role: r, task, members: members(s, pid), tags: tagList(s, pid) };
}
