// Full project history: filterable by type, action and person; 20 per page.
import { page, render, html, humanise, param, idParam, canonical, notFound, activityItem, slide } from '../app.js';
import { read, live } from '../store.js';
import * as q from '../queries.js';

const PER_PAGE = 20;
const TYPES = ['project', 'member', 'task'];
const ACTIONS = ['create', 'update', 'complete', 'delete', 'add', 'remove'];

const id = idParam('project');
const content = await page('Activity');
const filters = { entity_type: param('entity_type') ?? '', action: param('action') ?? '', user_id: param('user_id') ?? '' };
const hasFilter = Object.values(filters).some(Boolean);
const pageNo = idParam('page') ?? 1;

const select = (name, label, all, values) => html`
    <div class="field">
        <label for="${name}">${label}</label>
        <select id="${name}" name="${name}">
            <option value="">${all}</option>
            ${values.map(([value, text]) => html`<option value="${value}" ${filters[name] === value ? 'selected' : ''}>${text}</option>`)}
        </select>
    </div>`;
const pageLink = (n) => {
    const q = new URLSearchParams(location.search);
    q.set('page', n);
    return `activity.html?${q}`;
};

function view(data) {
    if (!data) return notFound(content);
    const { project, count, entries, members } = data;
    const pages = Math.ceil(count / PER_PAGE);
    document.title = `Activity · ${project.name} · Project Manager`;
    canonical('project', project.id);
    render(content, html`
        <div class="page-header-row">
            <div>
                <h1>Activity</h1>
                <p class="text-muted">Everything that has happened in <a href="project.html?id=${id}">${project.name}</a></p>
            </div>
        </div>
        <section class="card mb-4"><div class="card-body">
            <form method="get" action="activity.html">
                <input type="hidden" name="project" value="${id}">
                <div class="form-grid">
                    ${select('entity_type', 'Type', 'All types', TYPES.map((t) => [t, humanise(t)]))}
                    ${select('action', 'Action', 'All actions', ACTIONS.map((a) => [a, humanise(a)]))}
                    ${select('user_id', 'Person', 'Anyone', members.map((m) => [m.user_id, m.profile.username]))}
                    <div class="field" style="align-self: end;">
                        <div class="toolbar">
                            <button type="submit" class="btn btn-primary btn-slide">${slide('Apply', 'filter')}</button>
                            ${hasFilter ? html`<a class="btn btn-ghost" href="activity.html?project=${id}">Clear</a>` : ''}
                        </div>
                    </div>
                </div>
            </form>
        </div></section>
        <section class="card">
            ${entries.length === 0 ? html`<div class="empty-state">
                <h2>${hasFilter ? 'Nothing matches those filters' : 'Nothing recorded yet'}</h2>
                <p>${hasFilter ? 'Try widening the filters above.' : 'Changes to this project and its tasks will be listed here.'}</p>
            </div>` : html`
                <div>${entries.map(activityItem)}</div>
                ${pages > 1 ? html`<div class="card-body row-between" style="border-top: 1px solid var(--border);">
                    ${pageNo > 1 ? html`<a class="btn btn-secondary btn-sm" href="${pageLink(pageNo - 1)}">Newer</a>` : html`<span></span>`}
                    <span class="text-muted">Page ${pageNo} of ${pages}</span>
                    ${pageNo < pages ? html`<a class="btn btn-secondary btn-sm" href="${pageLink(pageNo + 1)}">Older</a>` : html`<span></span>`}
                </div>` : ''}`}
        </section>`);
}

await live(content, () => (id ? read(q.activityPage, id, filters, pageNo, PER_PAGE) : null), view);
