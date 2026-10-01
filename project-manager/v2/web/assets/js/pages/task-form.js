// New task (?project=N) or edit one (?project=N&id=M). Member+ only.
import { page, render, html, humanise, idParam, canonical, onSubmit, go, notFound, can, dueTimeField, slide } from '../app.js';
import { read, mutate } from '../store.js';
import * as q from '../queries.js';

const STATUSES = ['todo', 'in_progress', 'review', 'completed'];
const PRIORITIES = ['low', 'medium', 'high', 'critical'];

const projectId = idParam('project');
const id = idParam('id');
const content = await page(id ? 'Edit task' : 'New task');
const data = projectId ? await read(q.taskFormPage, projectId, id) : null;
if (!data || !can(data.role, 'member')) await notFound(content);
const { project, members, tags } = data;
const task = data.task ?? { status: 'todo', priority: 'medium', task_assignees: [], task_tags: [] };
canonical('project', project.id);
if (id) canonical('id', task.id);
const assigned = new Set(task.task_assignees.map((a) => a.user_id));
const tagged = new Set(task.task_tags.map((t) => t.tag_id));

const options = (values, selected) => values.map((v) => html`<option value="${v}" ${v === selected ? 'selected' : ''}>${humanise(v)}</option>`);
const back = id ? `task.html?project=${projectId}&id=${id}` : `project.html?id=${projectId}`;

render(content, html`
    <div class="page-header">
        <h1>${id ? 'Edit task' : 'New task'}</h1>
        <p class="text-muted">In <a href="project.html?id=${projectId}">${project.name}</a></p>
    </div>
    <section class="card"><div class="card-body">
        <form data-validated novalidate>
            <div class="form-grid">
                <div class="field form-full" data-validate="projectName">
                    <label for="title">Title</label>
                    <input type="text" id="title" name="title" value="${task.title ?? ''}" maxlength="200" autofocus required>
                    <p class="field-error" role="alert"></p>
                </div>
                <div class="field form-full">
                    <label for="description">Description</label>
                    <textarea id="description" name="description" maxlength="5000">${task.description ?? ''}</textarea>
                </div>
                <div class="field"><label for="status">Status</label><select id="status" name="status" required>${options(STATUSES, task.status)}</select></div>
                <div class="field"><label for="priority">Priority</label><select id="priority" name="priority" required>${options(PRIORITIES, task.priority)}</select></div>
                <div class="field"><label for="start_date">Start date</label><input type="date" id="start_date" name="start_date" value="${task.start_date ?? ''}"></div>
                <div class="field"><label for="due_date">Due date</label><input type="date" id="due_date" name="due_date" value="${task.due_date ?? ''}"></div>
                ${dueTimeField(task.due_time)}
                <div class="field">
                    <label for="estimate">Estimate (hours)</label>
                    <input type="number" id="estimate" name="estimate" min="0" max="1666" step="0.25" value="${task.estimate_minutes ? task.estimate_minutes / 60 : ''}" placeholder="e.g. 4">
                    <p class="hint">Optional. Compared with the time logged on the task.</p>
                </div>
                <div class="field form-full">
                    <label>Assignees</label>
                    <div class="check-grid">${members.map((m) => html`
                        <label class="checkbox">
                            <input type="checkbox" name="assignees" value="${m.user_id}" ${assigned.has(m.user_id) ? 'checked' : ''}><span class="checkmark"></span>
                            ${m.profile.username} <span class="text-muted">(${humanise(m.role)})</span>
                        </label>`)}
                    </div>
                    <p class="hint">A task can have as many assignees as it needs.</p>
                </div>
                <div class="field form-full">
                    <label>Tags</label>
                    ${tags.length === 0 ? html`<p class="hint">No tags yet — create them on the project page.</p>` : html`
                        <div class="check-grid">${tags.map((t) => html`
                            <label class="checkbox">
                                <input type="checkbox" name="tags" value="${t.id}" ${tagged.has(t.id) ? 'checked' : ''}><span class="checkmark"></span>
                                <span class="tag-swatch" style="background: ${t.color}"></span>${t.name}
                            </label>`)}
                        </div>`}
                </div>
            </div>
            <div class="form-actions">
                <button type="submit" class="btn btn-primary btn-slide" data-busy-label="Saving…">${id ? slide('Save changes', 'save') : slide('Create task', 'plus')}</button>
                <a class="btn btn-ghost" href="${back}">Cancel</a>
            </div>
        </form>
    </div></section>`);

onSubmit(content.querySelector('form'), async (fields, form) => {
    const data = new FormData(form);
    // The values the form started from, so the server can tell which fields this edit really changed.
    const base = id ? {
        title: task.title, description: task.description, status: task.status, priority: task.priority,
        start_date: task.start_date, due_date: task.due_date, due_time: task.due_time,
        assignees: task.task_assignees.map((a) => a.user_id), tags: task.task_tags.map((t) => t.tag_id),
    } : null;
    const taskId = (await mutate('saveTask', {
        project: projectId, task: id, fields, base,
        assignees: data.getAll('assignees'), tags: data.getAll('tags').map(Number),
    })) ?? id;
    const estimate = Math.round(Number(fields.estimate || 0) * 60);
    if (estimate !== (task.estimate_minutes ?? 0)) {
        await mutate('setEstimate', { task: taskId, minutes: estimate });
    }
    go(`task.html?project=${projectId}&id=${taskId}`, id ? 'Task updated.' : 'Task created.');
});
