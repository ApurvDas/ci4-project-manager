import { page, render, html, call, sb, humanise, fmtShort, isOverdue, idParam, notFound, projectAndRole, can, badge } from '../app.js';
import { enableBoard } from '../board.js';

const STATUSES = ['todo', 'in_progress', 'review', 'completed'];

const id = idParam('project');
const content = await page('Board');
const { project, role } = id ? await projectAndRole(id) : {};
if (!project) await notFound(content);
document.title = `Board · ${project.name} · Project Manager`;

const tasks = await call(sb.from('tasks')
    .select('id, title, status, priority, due_date, due_time, position, tags(name, color), task_assignees(profile:profiles(username))')
    .eq('project_id', id).order('position').order('id'));
const canWrite = can(role, 'member');

const card = (t) => {
    const overdue = t.status !== 'completed' && isOverdue(t.due_date, t.due_time);
    const people = t.task_assignees.map((a) => a.profile.username);
    return html`<article class="board-card" data-task-id="${t.id}" ${canWrite ? html`draggable="true"` : ''}>
        <a class="board-card-title" href="task.html?project=${id}&id=${t.id}">${t.title}</a>
        <div class="board-card-tags">${t.tags.map((g) => html`<span class="tag"><span class="tag-swatch" style="background: ${g.color}"></span>${g.name}</span>`)}</div>
        <div class="board-card-foot">
            ${badge('priority', t.priority)}
            ${t.due_date ? html`<span class="${overdue ? 'is-overdue' : 'text-muted'}">${fmtShort(t.due_date)}${t.due_time ? `, ${t.due_time.slice(0, 5)}` : ''}</span>` : ''}
        </div>
        ${people.length ? html`<div class="board-card-people">${people.map((u) => html`<span class="avatar avatar-sm" title="${u}">${u[0]}</span>`)}</div>` : ''}
    </article>`;
};

render(content, html`
    <div class="page-header-row">
        <div>
            <h1>Board</h1>
            <p class="text-muted">In <a href="project.html?id=${id}">${project.name}</a></p>
        </div>
        <div class="toolbar">
            <a class="btn btn-secondary" href="tasks.html?project=${id}">List view</a>
            ${canWrite ? html`<a class="btn btn-primary" href="task-form.html?project=${id}">New task</a>` : ''}
        </div>
    </div>
    ${canWrite ? '' : html`<div class="alert alert-info mb-4" role="status">You have read-only access to this project, so cards cannot be moved.</div>`}
    <div class="board" data-board data-can-write="${canWrite ? '1' : '0'}">
        ${STATUSES.map((status) => {
            const column = tasks.filter((t) => t.status === status);
            return html`<section class="board-column" data-status="${status}">
                <header class="board-column-head"><h2>${humanise(status)}</h2><span class="badge" data-column-count>${column.length}</span></header>
                <div class="board-dropzone" data-dropzone>${column.map(card)}</div>
            </section>`;
        })}
    </div>
    <p class="board-status" data-board-status role="status" aria-live="polite"></p>`);

enableBoard(content.querySelector('[data-board]'), (taskId, status, position) =>
    call(sb.rpc('move_task', { p_task: Number(taskId), p_status: status, p_position: position })));
