import {
    page, render, html, call, sb, me, fmtDate, fmtDue, fmtDateTime, isOverdue, badge, idParam, notFound, projectAndRole, can, onSubmit, go, showAlert, errorMessage, ACTIVITY, activityItem, overdueBanner, slide,
} from '../app.js';

const projectId = idParam('project');
const id = idParam('id');
const content = await page('Task');
const { project, role } = projectId ? await projectAndRole(projectId) : {};
const task = project && id
    ? (await sb.from('tasks').select('*, tags(name, color), task_assignees(profile:profiles(username))').eq('id', id).eq('project_id', projectId).maybeSingle()).data
    : null;
if (!task) await notFound(content);
document.title = `${task.title} · Project Manager`;

const [checklists, comments, activity] = await Promise.all([
    call(sb.from('task_checklists').select('id, title, task_checklist_items(id, content, is_completed, position)').eq('task_id', id).order('id')),
    call(sb.from('task_comments').select('*, profile:profiles(username)').eq('task_id', id).order('created_at').order('id')),
    call(sb.from('activity_logs').select(ACTIVITY).eq('entity_type', 'task').eq('entity_id', id).order('created_at', { ascending: false }).order('id', { ascending: false }).limit(10)),
]);

const canWrite = can(role, 'member');
const canManage = can(role, 'manager');
const canDelete = canManage || task.created_by === me.id;
const overdue = task.status !== 'completed' && isOverdue(task.due_date, task.due_time);
// One flat list per task; older tasks may hold several checklists, shown in creation order.
const items = checklists.flatMap((c) => c.task_checklist_items.sort((a, b) => a.position - b.position || a.id - b.id));
const progressText = (p) => `${p.completed}/${p.total} · ${p.percent}%`;
const doneCount = items.filter((i) => i.is_completed).length;
const border = 'border-top: 1px solid var(--border);';
const empty = (title, text) => html`<div class="empty-state"><h2>${title}</h2><p>${text}</p></div>`;

render(content, html`
    <div class="page-header-row">
        <div>
            <h1>${task.title}</h1>
            <div class="list-item-meta">
                <a href="project.html?id=${projectId}">${project.name}</a><span aria-hidden="true">·</span>
                ${badge('status', task.status)}${badge('priority', task.priority)}
                ${task.tags.map((g) => html`<span class="tag"><span class="tag-swatch" style="background: ${g.color}"></span>${g.name}</span>`)}
            </div>
        </div>
        <div class="toolbar">
            ${canWrite ? html`<a class="btn btn-secondary btn-slide" href="task-form.html?project=${projectId}&id=${id}">${slide('Edit', 'edit')}</a>` : ''}
            ${canDelete ? html`<form class="inline-form" data-action="delete-task" data-confirm="Delete this task?"><button type="submit" class="btn btn-danger btn-slide">${slide('Delete', 'trash')}</button></form>` : ''}
        </div>
    </div>
    ${overdue ? overdueBanner('task', task.due_date, task.due_time) : ''}

    <div class="panels">
        <div class="stack">
            ${task.description ? html`<section class="card"><div class="card-body"><p class="pre-line">${task.description}</p></div></section>` : ''}

            <section class="card">
                <div class="panel-head">
                    <h2>Checklist</h2>
                    ${items.length ? html`<span class="badge" data-checklist-progress>${progressText({ completed: doneCount, total: items.length, percent: Math.round((doneCount * 100) / items.length) })}</span>` : ''}
                </div>
                ${items.length === 0 ? empty('No checklist yet', 'Add the steps for this task below.') : html`
                    <div class="checklist"><ul class="checklist-items">${items.map((i) => html`
                        <li class="checklist-item ${i.is_completed ? 'is-done' : ''}">
                            ${canWrite
                                ? html`<button type="button" class="checklist-box" data-toggle-item="${i.id}" aria-pressed="${String(i.is_completed)}" aria-label="Toggle ${i.content}"><span class="checkmark"></span></button>`
                                : html`<span class="checklist-box ${i.is_completed ? 'is-checked' : ''}" aria-hidden="true"><span class="checkmark"></span></span>`}
                            <span class="checklist-text" data-text>${i.content}</span>
                            ${canWrite ? html`<span class="checklist-tools">
                                <button type="button" data-edit="item" data-id="${i.id}" data-max="255" aria-label="Edit ${i.content}">✎</button>
                                <button type="button" data-delete="item" data-id="${i.id}" aria-label="Delete ${i.content}">×</button>
                            </span>` : ''}
                        </li>`)}
                    </ul></div>`}
                ${canWrite ? html`<div class="card-body" style="${border}">
                    <form data-action="add-items">
                        <div class="field">
                            <label class="visually-hidden" for="checklist-items">Add checklist items</label>
                            <textarea id="checklist-items" name="items" rows="3" placeholder="Add an item — or paste a list, one per line" required></textarea>
                            <p class="hint">Bullets and checkboxes at the start of a line are removed. Ctrl+Enter adds.</p>
                        </div>
                        <button type="submit" class="btn btn-secondary btn-slide mt-4">${slide('Add', 'plus')}</button>
                    </form>
                </div>` : ''}
            </section>

            <section class="card">
                <div class="panel-head"><h2>Comments</h2><span class="badge">${comments.length}</span></div>
                ${comments.length === 0 ? empty('No comments yet', 'Discussion about this task will appear here.') : html`<div>${comments.map((c) => html`
                    <div class="activity-item">
                        <span class="avatar" aria-hidden="true">${c.profile.username[0]}</span>
                        <div style="flex: 1;">
                            <div class="row-between">
                                <strong>${c.profile.username}</strong>
                                ${canManage || c.user_id === me.id ? html`
                                    <form class="inline-form" data-action="delete-comment" data-comment="${c.id}" data-confirm="Delete this comment?">
                                        <button type="submit" class="btn btn-danger btn-sm btn-slide">${slide('Delete', 'trash')}</button>
                                    </form>` : ''}
                            </div>
                            <div class="activity-body pre-line">${c.comment}</div>
                            <div class="activity-time">${fmtDateTime(c.created_at)}</div>
                        </div>
                    </div>`)}</div>`}
                ${canWrite ? html`<div class="card-body" style="${border}">
                    <form data-action="comment">
                        <div class="field"><label for="comment">Add a comment</label><textarea id="comment" name="comment" maxlength="5000" required></textarea></div>
                        <button type="submit" class="btn btn-primary btn-slide mt-4" data-busy-label="Posting…">${slide('Post comment', 'send')}</button>
                    </form>
                </div>` : ''}
            </section>
        </div>

        <div class="stack">
            <section class="card"><div class="card-body">
                <dl class="meta-list">
                    <div><dt>Start date</dt><dd>${fmtDate(task.start_date) || '—'}</dd></div>
                    <div><dt>Due</dt><dd class="${overdue ? 'is-overdue' : ''}">${fmtDue(task.due_date, task.due_time) || '—'}</dd></div>
                    ${task.completed_at ? html`<div><dt>Completed</dt><dd>${fmtDate(task.completed_at)}</dd></div>` : ''}
                </dl>
            </div></section>

            <section class="card">
                <div class="panel-head"><h2>Assignees</h2><span class="badge">${task.task_assignees.length}</span></div>
                ${task.task_assignees.length === 0 ? empty('Unassigned', 'Nobody is working on this yet.') : html`
                    <ul class="list">${task.task_assignees.map(({ profile }) => html`
                        <li class="list-item"><div class="row"><span class="avatar" aria-hidden="true">${profile.username[0]}</span><span class="list-item-title">${profile.username}</span></div></li>`)}
                    </ul>`}
            </section>

            <section class="card">
                <div class="panel-head"><h2>History</h2></div>
                ${activity.length === 0 ? empty('Nothing recorded', 'Changes to this task will be listed here.') : html`<div>${activity.map(activityItem)}</div>`}
            </section>
        </div>
    </div>`);

const here = `task.html?project=${projectId}&id=${id}`;
const actions = {
    'delete-task': async () => {
        await call(sb.rpc('delete_task', { p_task: id }));
        go(`project.html?id=${projectId}`, 'Task deleted.');
    },
    'add-items': async (f) => {
        // One item per line; drop list markers such as "-", "•", "1.", "[ ]" or "☐".
        const lines = f.items.split(/\r?\n/)
            .map((line) => line.replace(/^\s*(?:[-*•◦▪]\s*)?(?:\d+[.)]\s+)?(?:\[[ xX]?\]|[☐☑✓✔□■])?\s*/, '').trim())
            .filter(Boolean);
        if (lines.length === 0) throw new Error('Type an item first.');
        const tooLong = lines.find((item) => item.length > 255);
        if (tooLong) throw new Error(`Items can be at most 255 characters: "${tooLong.slice(0, 40)}…"`);
        const added = await call(sb.rpc('add_checklist_items', { p_task: id, p_items: lines }));
        go(here, `Added ${added} item${added === 1 ? '' : 's'}.`);
    },
    comment: async (f) => {
        await call(sb.rpc('add_comment', { p_task: id, p_comment: f.comment }));
        go(here, 'Comment posted.');
    },
    'delete-comment': async (f, form) => {
        const deleted = await call(sb.from('task_comments').delete().eq('id', form.dataset.comment).select('id'));
        if (deleted.length === 0) throw new Error('You do not have permission to do that.');
        go(here, 'Comment deleted.');
    },
};

content.querySelectorAll('form[data-action]').forEach((form) => {
    form.addEventListener('submit', (e) => {
        if (form.dataset.confirm && !confirm(form.dataset.confirm)) e.preventDefault();
    });
    onSubmit(form, (fields) => actions[form.dataset.action](fields, form));
});

// Ctrl+Enter in the add box submits it (plain Enter makes a new line).
content.querySelector('#checklist-items')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) e.target.form.requestSubmit();
});

// Edit / delete for checklist items. RLS allows member+ and only
// the text columns; the page reloads afterwards so progress stays correct.
const TABLES = {
    item: { table: 'task_checklist_items', column: 'content', noun: 'Item' },
};

content.addEventListener('click', async (event) => {
    const del = event.target.closest('[data-delete]');
    if (del) {
        const kind = TABLES[del.dataset.delete];
        if (!confirm('Delete this item?')) return;
        try {
            const gone = await call(sb.from(kind.table).delete().eq('id', del.dataset.id).select('id'));
            if (gone.length === 0) throw new Error('You do not have permission to do that.');
            go(here, `${kind.noun} deleted.`);
        } catch (error) {
            showAlert(errorMessage(error));
        }
        return;
    }

    const edit = event.target.closest('[data-edit]');
    if (!edit) return;
    const kind = TABLES[edit.dataset.edit];
    const row = edit.closest('.checklist-item');
    const text = row.querySelector('[data-text]');

    // Swap the text for a small inline form: Enter saves, Esc cancels.
    const form = document.createElement('form');
    form.className = 'checklist-edit';
    form.innerHTML = `<input type="text" required><button type="submit" class="btn btn-secondary btn-sm btn-slide">${slide('Save', 'save')}</button><button type="button" class="btn btn-ghost btn-sm" data-cancel>Cancel</button>`;
    const input = form.querySelector('input');
    input.value = text.textContent;
    input.maxLength = Number(edit.dataset.max);
    input.setAttribute('aria-label', 'New item text');
    text.hidden = true;
    edit.parentElement.hidden = true;
    text.after(form);
    input.focus();
    input.select();

    const cancel = () => { form.remove(); text.hidden = false; edit.parentElement.hidden = false; };
    form.querySelector('[data-cancel]').addEventListener('click', cancel);
    input.addEventListener('keydown', (e) => { if (e.key === 'Escape') cancel(); });
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const value = input.value.trim();
        if (!value || value === text.textContent) return cancel();
        try {
            const saved = await call(sb.from(kind.table).update({ [kind.column]: value }).eq('id', edit.dataset.id).select('id'));
            if (saved.length === 0) throw new Error('You do not have permission to do that.');
            go(here, `${kind.noun} updated.`);
        } catch (error) {
            showAlert(errorMessage(error));
        }
    });
});

// Ticking an item updates in place; toggle_item() re-checks the role and returns fresh progress.
content.addEventListener('click', async (event) => {
    const box = event.target.closest('[data-toggle-item]');
    if (!box || box.disabled) return;
    box.disabled = true;
    try {
        const progress = await call(sb.rpc('toggle_item', { p_item: Number(box.dataset.toggleItem) }));
        const done = box.getAttribute('aria-pressed') !== 'true';
        box.setAttribute('aria-pressed', String(done));
        box.closest('.checklist-item').classList.toggle('is-done', done);
        content.querySelector('[data-checklist-progress]').textContent = progressText(progress);
    } catch (error) {
        showAlert(errorMessage(error));
    } finally {
        box.disabled = false;
    }
});
