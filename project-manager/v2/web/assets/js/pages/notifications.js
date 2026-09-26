import { page, render, html, call, sb, fmtDateTime, onSubmit, go } from '../app.js';

const content = await page('Notifications');
const notifications = await call(sb.from('notifications').select('*').order('created_at', { ascending: false }).limit(50));
const unread = notifications.filter((n) => n.read_at === null).length;

// Task notifications now carry their project, so they link too.
const linkFor = (n) => (n.related_type === 'task' && n.project_id ? `task.html?project=${n.project_id}&id=${n.related_id}`
    : n.related_type === 'project' ? `project.html?id=${n.related_id}` : null);

render(content, html`
    <div class="page-header-row">
        <div>
            <h1>Notifications</h1>
            <p class="text-muted">${unread > 0 ? `${unread} unread` : 'You are all caught up.'}</p>
        </div>
        ${unread > 0 ? html`<form data-read="all"><button type="submit" class="btn btn-secondary">Mark all as read</button></form>` : ''}
    </div>
    <section class="card">
        ${notifications.length === 0 ? html`<div class="empty-state">
            <h2>Nothing here yet</h2>
            <p>You will be told when you are assigned work, added to a project, or someone comments on your tasks.</p>
        </div>` : html`
            <ul class="list">${notifications.map((n) => {
                const link = linkFor(n);
                return html`<li class="list-item ${n.read_at ? '' : 'is-unread'}">
                    <div class="row">
                        ${n.read_at ? html`<span class="notification-dot is-read" aria-hidden="true"></span>` : html`<span class="notification-dot" role="img" aria-label="Unread"></span>`}
                        <div>
                            <div class="list-item-title">${link ? html`<a href="${link}">${n.title}</a>` : n.title}</div>
                            <div class="list-item-meta">
                                ${n.message ? html`<span>${n.message}</span><span aria-hidden="true">·</span>` : ''}
                                <span>${fmtDateTime(n.created_at)}</span>
                            </div>
                        </div>
                    </div>
                    ${n.read_at ? '' : html`<form class="inline-form" data-read="${n.id}"><button type="submit" class="btn btn-secondary btn-sm">Mark as read</button></form>`}
                </li>`;
            })}</ul>`}
    </section>`);

// RLS limits both updates to the caller's own rows.
content.querySelectorAll('form[data-read]').forEach((form) => onSubmit(form, async () => {
    let query = sb.from('notifications').update({ read_at: new Date().toISOString() }).is('read_at', null);
    if (form.dataset.read !== 'all') query = query.eq('id', form.dataset.read);
    await call(query);
    go('notifications.html', form.dataset.read === 'all' ? 'All notifications marked as read.' : 'Notification marked as read.');
}));
