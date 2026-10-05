import { page, render, html, raw, fmtDateTime, onSubmit, go, slide } from '../app.js';
import { read, live, mutate } from '../store.js';
import * as q from '../queries.js';

const content = await page('Notifications');

// Task notifications now carry their project, so they link too.
const linkFor = (n) => (n.related_type === 'task' && n.project_id ? `task.html?project=${n.project_id}&id=${n.related_id}`
    : n.related_type === 'project' ? `project.html?id=${n.related_id}` : null);

function view(notifications) {
    const unread = notifications.filter((n) => n.read_at === null).length;
    render(content, html`
        <div class="page-header-row">
            <div>
                <h1>Notifications</h1>
                <p class="text-muted">${unread > 0 ? `${unread} unread` : 'You are all caught up.'}</p>
            </div>
            ${unread > 0 ? html`<form data-read="all"><button type="submit" class="btn btn-secondary btn-slide">${slide('Mark all as read', 'check-all')}</button></form>` : ''}
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
                                <div class="list-item-title">${link ? html`<a href="${link}" ${n.read_at ? '' : raw(`data-open-unread="${n.id}"`)}>${n.title}</a>` : n.title}</div>
                                <div class="list-item-meta">
                                    ${n.message ? html`<span>${n.message}</span><span aria-hidden="true">·</span>` : ''}
                                    <span class="num">${fmtDateTime(n.created_at)}</span>
                                </div>
                            </div>
                        </div>
                        ${n.read_at ? '' : html`<form class="inline-form" data-read="${n.id}"><button type="submit" class="btn btn-secondary btn-sm btn-slide">${slide('Mark as read', 'save')}</button></form>`}
                    </li>`;
                })}</ul>`}
        </section>`);

    // RLS limits both updates to the caller's own rows.
    content.querySelectorAll('form[data-read]').forEach((form) => onSubmit(form, async () => {
        form.hidden = true; // gone the moment it's pressed, not after the round trip; back only if it failed
        try {
            await mutate('markRead', { id: form.dataset.read === 'all' ? null : Number(form.dataset.read) });
        } catch (error) {
            form.hidden = false;
            throw error;
        }
        go('notifications.html', form.dataset.read === 'all' ? 'All notifications marked as read.' : 'Notification marked as read.');
    }));

    // Opening an unread notification is reading it. A plain click waits for the change before leaving,
    // so it isn't lost; a click that opens a new tab just marks it and stays.
    content.querySelectorAll('a[data-open-unread]').forEach((a) => a.addEventListener('click', (event) => {
        const markRead = mutate('markRead', { id: Number(a.dataset.openUnread) }).catch(() => {});
        if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        markRead.finally(() => { location.href = a.href; });
    }));
}

await live(content, () => read(q.notificationsPage), view);
