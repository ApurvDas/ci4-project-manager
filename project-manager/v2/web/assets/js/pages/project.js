import {
    page, render, html, call, sb, me, humanise, fmtDate, fmtDue, badge, idParam, notFound, projectAndRole, can,
    onSubmit, go, ACTIVITY, activityItem,
} from '../app.js';

const STATUSES = ['todo', 'in_progress', 'review', 'completed'];
const RANK = { owner: 4, manager: 3, member: 2, viewer: 1 };

const id = idParam('id');
const content = await page('Project');
const { project, role } = id ? await projectAndRole(id) : {};
if (!project) await notFound(content);
document.title = `${project.name} · Project Manager`;

const [tasks, members, tags, activity, profiles] = await Promise.all([
    call(sb.from('tasks').select('id, title, status, priority, due_date, due_time').eq('project_id', id)
        .order('due_date', { nullsFirst: false }).order('due_time', { nullsFirst: false }).order('id')),
    call(sb.from('project_members').select('user_id, role, profile:profiles(username)').eq('project_id', id)),
    call(sb.from('tags').select('*').eq('project_id', id).order('name')),
    call(sb.from('activity_logs').select(ACTIVITY).eq('project_id', id).order('created_at', { ascending: false }).order('id', { ascending: false }).limit(12)),
    call(sb.from('profiles').select('id, username').order('username')),
]);
members.sort((a, b) => RANK[b.role] - RANK[a.role] || a.profile.username.localeCompare(b.profile.username));

const isOwner = role === 'owner';
const canManage = can(role, 'manager');
const canWrite = can(role, 'member');
const assignable = isOwner ? ['manager', 'member', 'viewer'] : ['member', 'viewer'];
const memberIds = new Set(members.map((m) => m.user_id));
const candidates = profiles.filter((p) => !memberIds.has(p.id));
// Average of task progress, where a task's checklist counts until it's completed
// (same rule as the dashboard, defined once in project_progress()).
const percent = await call(sb.rpc('project_progress', { p_project: id }));
const border = 'border-top: 1px solid var(--border);';

// Mirrors canRemoveMember / canChangeRole — only to hide controls.
const canRemove = (m) => m.role !== 'owner' && (isOwner || (canManage && (m.role !== 'manager' || m.user_id === me.id)));
const canChangeRole = (m) => isOwner && m.role !== 'owner';

// Ready-made tags offered as one-click chips (only those the project lacks).
const SUGGESTED_TAGS = [
    ['Bug', '#EF4444'], ['Bug-Fix', '#F43F5E'], ['Feature', '#3B82F6'], ['Urgent', '#F97316'],
    ['Design', '#EC4899'], ['Frontend', '#6366F1'], ['Backend', '#10B981'], ['Testing', '#EAB308'],
    ['Docs', '#64748B'], ['Research', '#8B5CF6'], ['Demo', '#3B82F6'], ['Investor', '#A855F7'],
    ['Driver-App', '#22C55E'], ['Marketing', '#D946EF'],
];
const have = new Set(tags.map((t) => t.name.toLowerCase()));
const suggestions = SUGGESTED_TAGS.filter(([name]) => !have.has(name.toLowerCase())).map(([name, color]) => ({ name, color }));

// A custom tag's colour follows its name (same name, same colour) until the user picks one.
const PALETTE = SUGGESTED_TAGS.map(([, color]) => color);
const colourFor = (name) => PALETTE[[...name.toLowerCase()].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % PALETTE.length];

const options = (values, selected) => values.map((v) => html`<option value="${v}" ${v === selected ? 'selected' : ''}>${humanise(v)}</option>`);
const empty = (title, text) => html`<div class="empty-state"><h2>${title}</h2><p>${text}</p></div>`;

render(content, html`
    <div class="page-header-row">
        <div>
            <h1>${project.name}</h1>
            <div class="list-item-meta">${badge('status', project.status)}${badge('priority', project.priority)}<span>You are ${memberIds.has(me.id) ? humanise(role) : 'Site admin'}</span></div>
        </div>
        <div class="toolbar">
            ${canManage ? html`<a class="btn btn-secondary" href="project-form.html?id=${id}">Edit</a>` : ''}
            ${isOwner ? html`
                <form class="inline-form" data-action="status"><button type="submit" class="btn btn-secondary">${project.status === 'archived' ? 'Reopen' : 'Archive'}</button></form>
                <form class="inline-form" data-action="delete-project"
                      data-confirm="Delete this project? Its tasks, comments and history go with it. This cannot be undone.">
                    <button type="submit" class="btn btn-danger">Delete</button>
                </form>` : ''}
        </div>
    </div>

    ${project.description ? html`<section class="card mb-4"><div class="card-body"><p class="pre-line">${project.description}</p></div></section>` : ''}

    <section class="card mb-4"><div class="card-body">
        <dl class="meta-list">
            <div><dt>Start date</dt><dd>${fmtDate(project.start_date) || '—'}</dd></div>
            <div><dt>Due</dt><dd>${fmtDue(project.due_date, project.due_time) || '—'}</dd></div>
            <div><dt>Members</dt><dd>${members.length}</dd></div>
            <div><dt>Progress</dt><dd>${percent}%</dd></div>
        </dl>
    </div></section>

    <div class="stat-grid">${STATUSES.map((s) => html`
        <div class="stat"><div class="stat-value">${tasks.filter((t) => t.status === s).length}</div><div class="stat-label">${humanise(s)}</div></div>`)}
    </div>

    <div class="panels">
        <div class="stack">
            <section class="card">
                <div class="panel-head">
                    <h2>Tasks</h2>
                    <div class="toolbar">
                        <a class="btn btn-secondary btn-sm" href="board.html?project=${id}">Board</a>
                        <a class="btn btn-secondary btn-sm" href="tasks.html?project=${id}">List</a>
                        ${canWrite ? html`<a class="btn btn-primary btn-sm" href="task-form.html?project=${id}">New task</a>` : ''}
                    </div>
                </div>
                ${tasks.length === 0 ? empty('No tasks yet', 'Break this project down into tasks to get started.') : html`
                    <ul class="list">${tasks.slice(0, 8).map((t) => html`
                        <li class="list-item">
                            <div>
                                <div class="list-item-title"><a href="task.html?project=${id}&id=${t.id}">${t.title}</a></div>
                                <div class="list-item-meta">${t.due_date ? `Due ${fmtDue(t.due_date, t.due_time)}` : 'No due date'}</div>
                            </div>
                            <div class="list-item-aside">${badge('priority', t.priority)}${badge('status', t.status)}</div>
                        </li>`)}
                    </ul>
                    ${tasks.length > 8 ? html`<div class="card-body" style="${border}"><a href="tasks.html?project=${id}">View all ${tasks.length} tasks</a></div>` : ''}`}
            </section>

            <section class="card">
                <div class="panel-head">
                    <h2>Recent activity</h2>
                    <a class="btn btn-secondary btn-sm" href="activity.html?project=${id}">Full history</a>
                </div>
                ${activity.length === 0 ? empty('Nothing recorded yet', 'Changes to this project will be listed here.') : html`<div>${activity.map(activityItem)}</div>`}
            </section>
        </div>

        <div class="stack">
            <section class="card">
                <div class="panel-head"><h2>Members</h2><span class="badge">${members.length}</span></div>
                <ul class="list">${members.map((m) => html`
                    <li class="list-item">
                        <div class="row">
                            <span class="avatar" aria-hidden="true">${m.profile.username[0]}</span>
                            <div><div class="list-item-title">${m.profile.username}</div><div class="list-item-meta">${humanise(m.role)}</div></div>
                        </div>
                        <div class="list-item-aside">
                            ${canChangeRole(m) ? html`
                                <form class="inline-form" data-action="role" data-user="${m.user_id}">
                                    <label class="visually-hidden" for="role-${m.user_id}">Role for ${m.profile.username}</label>
                                    <select id="role-${m.user_id}" name="role">${options(assignable, m.role)}</select>
                                    <button type="submit" class="btn btn-secondary btn-sm">Save</button>
                                </form>` : ''}
                            ${canRemove(m) ? html`
                                <form class="inline-form" data-action="remove" data-user="${m.user_id}" data-confirm="Remove ${m.profile.username} from this project?">
                                    <button type="submit" class="btn btn-danger btn-sm">Remove</button>
                                </form>` : ''}
                        </div>
                    </li>`)}
                </ul>
                ${canManage ? html`<div class="card-body" style="${border}">
                    ${candidates.length === 0 ? html`<p class="text-muted">Everyone is already a member of this project.</p>` : html`
                        <form data-action="add-member">
                            <div class="field">
                                <label for="user_id">Add a member</label>
                                <select id="user_id" name="user_id" required>${candidates.map((c) => html`<option value="${c.id}">${c.username}</option>`)}</select>
                            </div>
                            <div class="field">
                                <label for="member_role">Role</label>
                                <select id="member_role" name="role" required>${options(assignable, 'member')}</select>
                            </div>
                            <button type="submit" class="btn btn-secondary mt-4">Add to project</button>
                        </form>`}
                </div>` : ''}
            </section>

            <section class="card">
                <div class="panel-head"><h2>Tags</h2><span class="badge">${tags.length}</span></div>
                ${tags.length === 0 ? empty('No tags', 'Create tags to label and filter tasks.') : html`
                    <div class="tag-list">${tags.map((t) => html`
                        <span class="tag">
                            <span class="tag-swatch" style="background: ${t.color}"></span>${t.name}
                            ${canManage ? html`
                                <form class="inline-form" data-action="delete-tag" data-tag="${t.id}"
                                      data-confirm="Delete this tag? It will be removed from every task that uses it.">
                                    <button type="submit" class="tag-remove" aria-label="Delete tag ${t.name}">×</button>
                                </form>` : ''}
                        </span>`)}
                    </div>`}
                ${canWrite ? html`<div class="card-body" style="${border}">
                    ${suggestions.length ? html`
                        <p class="hint mt-0">Quick add — one click each:</p>
                        <div class="tag-list tag-suggestions">${suggestions.map((s) => html`
                            <form class="inline-form" data-action="add-tag">
                                <input type="hidden" name="name" value="${s.name}">
                                <input type="hidden" name="color" value="${s.color}">
                                <button type="submit" class="tag tag-suggest" aria-label="Add tag ${s.name}">
                                    <span class="tag-swatch" style="background: ${s.color}"></span>${s.name}<span aria-hidden="true">+</span>
                                </button>
                            </form>`)}
                        </div>` : ''}
                    <form data-action="add-tag" class="${suggestions.length ? 'mt-4' : ''}">
                        <div class="form-grid">
                            <div class="field"><label for="tag-name">Custom tag</label><input type="text" id="tag-name" name="name" maxlength="50" placeholder="e.g. Investor" required></div>
                            <div class="field"><label for="tag-color">Colour</label><input type="color" id="tag-color" name="color" value="#6B7280"><p class="hint">Picked for you; change it if you like.</p></div>
                        </div>
                        <button type="submit" class="plus-btn mt-4" title="Add tag" aria-label="Add tag">
                            <svg viewBox="0 0 24 24" width="50" height="50" aria-hidden="true">
                                <path stroke-width="1.5" d="M12 22C17.5 22 22 17.5 22 12C22 6.5 17.5 2 12 2C6.5 2 2 6.5 2 12C2 17.5 6.5 22 12 22Z"></path>
                                <path stroke-width="1.5" d="M8 12H16"></path>
                                <path stroke-width="1.5" d="M12 16V8"></path>
                            </svg>
                        </button>
                    </form>
                </div>` : ''}
            </section>
        </div>
    </div>`);

const here = `project.html?id=${id}`;
const actions = {
    status: async () => {
        const next = project.status === 'archived' ? 'active' : 'archived';
        await call(sb.rpc('set_project_status', { p_project: id, p_status: next }));
        go(here, next === 'archived' ? 'Project archived.' : 'Project reopened.');
    },
    'delete-project': async () => {
        await call(sb.rpc('delete_project', { p_project: id }));
        go('projects.html', 'Project deleted.');
    },
    role: async (f, form) => {
        await call(sb.rpc('change_role', { p_project: id, p_user: form.dataset.user, p_role: f.role }));
        go(here, 'Role updated.');
    },
    remove: async (f, form) => {
        await call(sb.rpc('remove_member', { p_project: id, p_user: form.dataset.user }));
        go(form.dataset.user === me.id ? 'projects.html' : here, 'Member removed.');
    },
    'add-member': async (f) => {
        await call(sb.rpc('add_member', { p_project: id, p_user: f.user_id, p_role: f.role }));
        go(here, 'Member added.');
    },
    'add-tag': async (f) => {
        const { error } = await sb.from('tags').insert({ project_id: id, name: f.name.trim(), color: f.color });
        if (error?.code === '23505') throw new Error('A tag with that name already exists.');
        if (error) throw error;
        go(here, 'Tag added.');
    },
    'delete-tag': async (f, form) => {
        await call(sb.from('tags').delete().eq('id', form.dataset.tag));
        go(here, 'Tag deleted.');
    },
};

// Auto-colour the custom tag as its name is typed, until the colour is picked by hand.
const tagName = content.querySelector('#tag-name');
const tagColour = content.querySelector('#tag-color');
if (tagName) {
    let picked = false;
    tagColour.addEventListener('input', () => { picked = true; });
    tagName.addEventListener('input', () => {
        if (!picked) tagColour.value = tagName.value.trim() ? colourFor(tagName.value.trim()) : '#6B7280';
    });
}

// A role's Save only makes sense once a different role is picked.
content.querySelectorAll('form[data-action="role"]').forEach((form) => {
    const select = form.querySelector('select');
    const save = form.querySelector('button');
    const current = select.value;
    save.disabled = true;
    select.addEventListener('change', () => { save.disabled = select.value === current; });
});

content.querySelectorAll('form[data-action]').forEach((form) => {
    form.addEventListener('submit', (e) => {
        if (form.dataset.confirm && !confirm(form.dataset.confirm)) e.preventDefault();
    });
    onSubmit(form, (fields) => actions[form.dataset.action](fields, form));
});
