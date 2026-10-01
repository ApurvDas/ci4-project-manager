import { page, render, html, dueState, idParam, canonical, notFound, can, badge, taskLate, overdueBadge, slide } from '../app.js';
import { read, live } from '../store.js';
import * as q from '../queries.js';

const id = idParam('project');
const content = await page('Tasks');

function view(data) {
    if (!data) return notFound(content);
    const { project, role, list: tasks } = data;
    document.title = `Tasks · ${project.name} · Project Manager`;
    canonical('project', project.id);
    render(content, html`
        <div class="page-header-row">
            <div>
                <h1>Tasks</h1>
                <p class="text-muted">In <a href="project.html?id=${id}">${project.name}</a></p>
            </div>
            <div class="toolbar">
                <a class="btn btn-secondary" href="board.html?project=${id}">Board view</a>
                ${can(role, 'member') ? html`<a class="btn btn-primary btn-slide" href="task-form.html?project=${id}">${slide('New task', 'plus')}</a>` : ''}
            </div>
        </div>
        <section class="card">
            ${tasks.length === 0 ? html`<div class="empty-state"><h2>No tasks yet</h2><p>Break the project down into tasks to get started.</p></div>` : html`
                <ul class="list">${tasks.map((t) => {
                    const [dueClass, dueLabel] = dueState(t.due_date, t.due_time, t.status === 'completed');
                    return html`<li class="list-item ${taskLate(t) ? 'is-late' : ''}">
                        <div>
                            <div class="list-item-title"><a href="task.html?project=${id}&id=${t.id}">${t.title}</a></div>
                            <div class="list-item-meta">
                                <span class="${dueClass}">${dueLabel}</span>
                                ${t.tags.map((g) => html`<span class="tag"><span class="tag-swatch" style="background: ${g.color}"></span>${g.name}</span>`)}
                            </div>
                        </div>
                        <div class="list-item-aside">${taskLate(t) ? overdueBadge(t.due_date, t.due_time) : ''}${badge('priority', t.priority)}${badge('status', t.status)}</div>
                    </li>`;
                })}</ul>`}
        </section>`);
}

await live(content, () => (id ? read(q.tasksPage, id) : null), view);
