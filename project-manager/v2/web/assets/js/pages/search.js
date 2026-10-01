// Search across projects, tasks, comments and checklist items you can see.
// The query lives in the URL (?q=) so results can be bookmarked and shared.
import { page, render, html, raw, call, sb, param, icon } from '../app.js';

const content = await page('Search');
const query = (param('q') ?? '').trim();
const results = query ? await call(sb.rpc('search', { p_query: query })) : [];

const KIND = { project: 'Project', task: 'Task', comment: 'Comment', checklist: 'Checklist item' };
const linkFor = (r) => (r.kind === 'project' ? `project.html?id=${r.projectId}` : `task.html?project=${r.projectId}&id=${r.taskId}`);

// Snippets arrive with matches wrapped in ⟦ ⟧: escape the text first, then turn
// those markers into <mark>, so user text can never become HTML.
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const highlight = (s) => raw(s.replace(/[&<>"']/g, (c) => ESC[c]).replaceAll('⟦', '<mark>').replaceAll('⟧', '</mark>'));

render(content, html`
    <div class="page-header">
        <h1>Search</h1>
        <p class="text-muted">Projects, tasks, comments and checklist items you can access.</p>
    </div>
    <form class="search-form" method="get" action="search.html" role="search">
        <label class="visually-hidden" for="q">Search</label>
        <span class="search-form__icon" aria-hidden="true">${icon('search')}</span>
        <input type="search" id="q" name="q" value="${query}" placeholder="Search, e.g. checkout or design" autocomplete="off" autofocus>
    </form>
    ${query ? html`
        <p class="text-muted" role="status">${results.length === 0 ? `No matches for "${query}".` : `${results.length} match${results.length === 1 ? '' : 'es'} for "${query}".`}</p>
        ${results.length ? html`<section class="card"><ul class="list">${results.map((r) => html`
            <li class="list-item search-result">
                <div>
                    <div class="list-item-title"><a href="${linkFor(r)}">${r.title}</a></div>
                    <div class="list-item-meta"><span class="badge">${KIND[r.kind]}</span>${r.context ? html`<span>${r.context}</span>` : ''}</div>
                    <p class="search-result__snippet">${highlight(r.snippet)}</p>
                </div>
            </li>`)}</ul></section>` : ''}` : ''}`);
