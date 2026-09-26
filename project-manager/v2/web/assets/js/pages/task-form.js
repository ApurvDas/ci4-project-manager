// New task (?project=N) or edit one (?project=N&id=M). Member+ only.
import { page, render, html, call, sb, humanise, idParam, onSubmit, go, notFound, projectAndRole, can, dueTimeField, slide } from '../app.js';

const STATUSES = ['todo', 'in_progress', 'review', 'completed'];
const PRIORITIES = ['low', 'medium', 'high', 'critical'];

const projectId = idParam('project');
const id = idParam('id');
const content = await page(id ? 'Edit task' : 'New task');
const { project, role } = projectId ? await projectAndRole(projectId) : {};
if (!project || !can(role, 'member')) await notFound(content);

let task = { status: 'todo', priority: 'medium', task_assignees: [], task_tags: [] };
if (id) {
    task = (await sb.from('tasks').select('*, task_assignees(user_id), task_tags(tag_id)').eq('id', id).eq('project_id', projectId).maybeSingle()).data;
    if (!task) await notFound(content);
}

const [members, tags] = await Promise.all([
    call(sb.from('project_members').select('user_id, role, profile:profiles(username)').eq('project_id', projectId)),
    call(sb.from('tags').select('*').eq('project_id', projectId).order('name')),
]);
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
    const taskId = await call(sb.rpc('save_task', {
        p_project: projectId,
        p_task: id,
        p: fields,
        p_assignees: data.getAll('assignees'),
        p_tags: data.getAll('tags').map(Number),
    }));
    go(`task.html?project=${projectId}&id=${taskId}`, id ? 'Task updated.' : 'Task created.');
});
