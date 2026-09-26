// New project (no ?id) or edit an existing one (?id=N, manager+).
import { page, render, html, call, sb, humanise, idParam, onSubmit, go, notFound, projectAndRole, can, dueTimeField, slide } from '../app.js';

const STATUSES = ['planning', 'active', 'on_hold', 'completed', 'archived'];
const PRIORITIES = ['low', 'medium', 'high', 'critical'];

const id = idParam('id');
const content = await page(id ? 'Edit project' : 'New project');

let project = { status: 'planning', priority: 'medium' };
if (id) {
    const found = await projectAndRole(id);
    if (!found.project || !can(found.role, 'manager')) {
        await notFound(content);
    }
    project = found.project;
}

const options = (values, selected) => values.map((v) => html`<option value="${v}" ${v === selected ? 'selected' : ''}>${humanise(v)}</option>`);
const back = id ? `project.html?id=${id}` : 'projects.html';

render(content, html`
    <div class="page-header">
        <h1>${id ? 'Edit project' : 'New project'}</h1>
        <p class="text-muted">${id ? 'Changes are recorded in the project activity history.' : 'You will be added as the owner automatically.'}</p>
    </div>
    <section class="card"><div class="card-body">
        <form data-validated novalidate>
            <div class="form-grid">
                <div class="field form-full" data-validate="projectName">
                    <label for="name">Project name</label>
                    <input type="text" id="name" name="name" value="${project.name ?? ''}" maxlength="150" autofocus required>
                    <p class="field-error" role="alert"></p>
                </div>
                <div class="field form-full">
                    <label for="description">Description</label>
                    <textarea id="description" name="description" maxlength="5000" placeholder="What is this project for?">${project.description ?? ''}</textarea>
                </div>
                <div class="field">
                    <label for="status">Status</label>
                    <select id="status" name="status" required>${options(STATUSES, project.status)}</select>
                </div>
                <div class="field">
                    <label for="priority">Priority</label>
                    <select id="priority" name="priority" required>${options(PRIORITIES, project.priority)}</select>
                </div>
                <div class="field">
                    <label for="start_date">Start date</label>
                    <input type="date" id="start_date" name="start_date" value="${project.start_date ?? ''}">
                </div>
                <div class="field">
                    <label for="due_date">Due date</label>
                    <input type="date" id="due_date" name="due_date" value="${project.due_date ?? ''}">
                    <p class="hint">Optional. Leave blank if there is no deadline.</p>
                </div>
                ${dueTimeField(project.due_time)}
            </div>
            <div class="form-actions">
                <button type="submit" class="btn btn-primary btn-slide" data-busy-label="Saving…">${id ? slide('Save changes', 'save') : slide('Create project', 'plus')}</button>
                <a class="btn btn-ghost" href="${back}">Cancel</a>
            </div>
        </form>
    </div></section>`);

onSubmit(content.querySelector('form'), async (fields) => {
    if (id) {
        await call(sb.rpc('update_project', { p_project: id, p: fields }));
        go(`project.html?id=${id}`, 'Project updated.');
    } else {
        const newId = await call(sb.rpc('create_project', { p: fields }));
        go(`project.html?id=${newId}`, 'Project created.');
    }
});
