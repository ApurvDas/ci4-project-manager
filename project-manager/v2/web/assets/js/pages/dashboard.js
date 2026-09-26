import { page, render, html, call, sb, humanise, dueState, badge, progress, today, nowTime, taskLate, projectLate, overdueBadge } from '../app.js';

const content = await page('Dashboard');
const d = await call(sb.rpc('dashboard', { p_today: today(), p_now: nowTime() }));
// Tags of the open tasks, fetched in one go and keyed by task id.
const taskIds = d.myTasks.map((t) => t.id);
const tagsByTask = new Map(taskIds.length
    ? (await call(sb.from('tasks').select('id, tags(name, color)').in('id', taskIds))).map((t) => [t.id, t.tags])
    : []);
const pc = d.projectCounts;
const tc = d.taskCounts;

const stat = (value, label, cls = '') => html`<div class="stat ${cls}"><div class="stat-value">${value}</div><div class="stat-label">${label}</div></div>`;
// Your own projects show your role; other projects (seen as a site admin) don't have one.
const projectList = (projects, showRole) => html`<ul class="list">${projects.map((p) => html`<li class="list-item ${projectLate(p) ? 'is-late' : ''}">
    <div>
        <div class="list-item-title"><a href="project.html?id=${p.id}">${p.name}</a></div>
        <div class="list-item-meta">${projectLate(p) ? overdueBadge(p.due_date, p.due_time) : ''}${badge('status', p.status)}${showRole ? html`<span>${humanise(p.role)}</span>` : ''}</div>
    </div>
    <div class="list-item-aside">${progress(p.progress)}</div>
</li>`)}</ul>`;
const empty = (title, text) => html`<div class="empty-state"><h2>${title}</h2><p>${text}</p></div>`;

render(content, html`
    <div class="page-header">
        <h1>Dashboard</h1>
        <p>Your projects and the work assigned to you.</p>
    </div>

    <div class="stat-grid">
        ${stat(d.myProjects.length, 'Total projects')}
        ${stat(pc.active ?? 0, 'Active projects')}
        ${stat(pc.completed ?? 0, 'Completed projects')}
        ${stat(d.unread, 'Unread notifications')}
        ${stat(tc.assigned, 'Tasks assigned to you')}
        ${stat(tc.overdue, 'Overdue tasks', tc.overdue > 0 ? 'is-alert' : '')}
        ${stat(tc.due_today, 'Due today', tc.due_today > 0 ? 'is-warn' : '')}
        ${stat(tc.completed, 'Tasks completed')}
    </div>

    <div class="panels">
        <section class="card">
            <div class="panel-head"><h2>Your open tasks</h2><span class="badge">${d.myTasks.length}</span></div>
            ${d.myTasks.length === 0 ? empty('Nothing on your plate', 'Tasks assigned to you will appear here.') : html`
                <ul class="list">${d.myTasks.map((t) => {
                    const [dueClass, dueLabel] = dueState(t.due_date, t.due_time);
                    return html`<li class="list-item ${taskLate(t) ? 'is-late' : ''}">
                        <div>
                            <div class="list-item-title"><a href="task.html?project=${t.project_id}&id=${t.id}">${t.title}</a></div>
                            <div class="list-item-meta"><span>${t.project_name}</span><span aria-hidden="true">·</span><span class="${dueClass}">${dueLabel}</span></div>
                            ${tagsByTask.get(t.id)?.length ? html`<div class="list-item-tags">${tagsByTask.get(t.id).map((g) => html`<span class="tag"><span class="tag-swatch" style="background: ${g.color}"></span>${g.name}</span>`)}</div>` : ''}
                        </div>
                        <div class="list-item-aside">${taskLate(t) ? overdueBadge(t.due_date, t.due_time) : ''}${badge('priority', t.priority)}${badge('status', t.status)}</div>
                    </li>`;
                })}</ul>`}
        </section>

        <div class="stack">
            <section class="card">
                <div class="panel-head"><h2>Your projects</h2><span class="badge">${d.myProjects.length}</span></div>
                ${d.myProjects.length === 0 ? empty('No projects yet', 'Projects you own or belong to will appear here.') : projectList(d.myProjects, true)}
            </section>

            ${d.otherProjects.length ? html`<section class="card">
                <div class="panel-head"><h2>Other projects going on</h2><span class="badge">${d.otherProjects.length}</span></div>
                ${projectList(d.otherProjects, false)}
            </section>` : ''}

            <section class="card">
                <div class="panel-head"><h2>Notifications</h2>${d.unread > 0 ? html`<span class="badge">${d.unread} unread</span>` : ''}</div>
                ${d.notifications.length === 0 ? empty('All quiet', 'You have no notifications yet.') : html`
                    <ul class="list">${d.notifications.map((n) => html`<li class="list-item">
                        <div>
                            <div class="list-item-title">${n.title}</div>
                            <div class="list-item-meta">${n.message ? html`<span>${n.message}</span>` : ''}</div>
                        </div>
                        ${n.read_at === null ? html`<span class="notification-dot" role="img" aria-label="Unread"></span>` : ''}
                    </li>`)}</ul>`}
            </section>
        </div>
    </div>`);
