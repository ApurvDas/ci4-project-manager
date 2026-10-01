import { page, render, html, humanise, fmtDue, badge, progress, today, nowTime, projectLate, overdueBadge, slide } from '../app.js';
import { snapshot, live } from '../store.js';
import * as q from '../queries.js';

const content = await page('Projects');

// Your own projects show your role; other projects (seen as a site admin) don't have one.
function projectList(list, showRole) {
    return html`<ul class="list">${list.map((p) => html`
        <li class="list-item ${projectLate(p) ? 'is-late' : ''}">
            <div>
                <div class="list-item-title"><a href="project.html?id=${p.id}">${p.name}</a></div>
                <div class="list-item-meta">
                    ${projectLate(p) ? overdueBadge(p.due_date, p.due_time) : ''}${badge('status', p.status)}${badge('priority', p.priority)}
                    ${showRole ? html`<span>${humanise(p.role)}</span>` : ''}
                    ${p.due_date ? html`<span aria-hidden="true">·</span><span>Due ${fmtDue(p.due_date, p.due_time)}</span>` : ''}
                </div>
            </div>
            <div class="list-item-aside">${progress(p.progress)}</div>
        </li>`)}
    </ul>`;
}

function view({ projects, otherProjects }) {
    render(content, html`
        <div class="page-header-row">
            <div>
                <h1>Projects</h1>
                <p class="text-muted">Every project you own or belong to.</p>
            </div>
            <a class="btn btn-primary btn-slide" href="project-form.html">${slide('New project', 'plus')}</a>
        </div>
        <section class="card">
            ${projects.length === 0 ? html`
                <div class="empty-state">
                    <h2>No projects yet</h2>
                    <p>Create your first project to start tracking work.</p>
                    <div class="row mt-4" style="justify-content: center;"><a class="btn btn-primary btn-slide" href="project-form.html">${slide('New project', 'plus')}</a></div>
                </div>` : html`
                ${projectList(projects, true)}`}
        </section>
        ${otherProjects.length ? html`
            <h2 class="mt-5 mb-4">Other projects going on</h2>
            <p class="text-muted mb-4">You can see these as a site admin, but you are not a member.</p>
            <section class="card">${projectList(otherProjects, false)}</section>` : ''}`);
}

await live(content, async () => {
    const { myProjects, otherProjects } = q.dashboard(await snapshot(), today(), nowTime());
    return { projects: myProjects, otherProjects };
}, view);
