// Shared page plumbing: the Supabase client, escaped HTML templates, the page
// shell (header, alerts, footer), flash messages, dates and error text.
// Everything here is presentation — permissions are enforced by the database.
import config from './config.js';

export const sb = window.supabase.createClient(config.url, config.anonKey);

// ---------------------------------------------------------------- templates

// html`...` escapes every interpolated value unless it is itself html`` or raw().
class Raw {
    constructor(s) { this.s = s; }
    toString() { return this.s; } // lets html`` output drop into a plain string
}
export const raw = (s) => new Raw(String(s));
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const show = (v) => (v instanceof Raw ? v.s
    : Array.isArray(v) ? v.map(show).join('')
    : v == null || v === false ? ''
    : String(v).replace(/[&<>"']/g, (c) => ESC[c]));
export const html = (strings, ...values) =>
    raw(strings.reduce((out, s, i) => out + s + (i < values.length ? show(values[i]) : ''), ''));

// Line icons for the sliding action buttons (24px grid, drawn with currentColor).
const ICONS = {
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
    save: '<path d="M20 6 9 17l-5-5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    trash: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="m19 6-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/>',
    archive: '<rect x="2" y="3" width="20" height="5" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/><path d="M10 12h4"/>',
    reopen: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
    send: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
    'user-plus': '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/>',
    'user-minus': '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 11h-6"/>',
    tag: '<path d="M12.6 2.6A2 2 0 0 0 11.2 2H4a2 2 0 0 0-2 2v7.2a2 2 0 0 0 .6 1.4l8.7 8.7a2.4 2.4 0 0 0 3.4 0l6.6-6.6a2.4 2.4 0 0 0 0-3.4Z"/><circle cx="7.5" cy="7.5" r="1"/>',
    'check-all': '<path d="M18 6 7 17l-5-5"/><path d="m22 10-7.5 7.5L13 16"/>',
    filter: '<path d="M22 3H2l8 9.46V19l4 2v-8.54Z"/>',
};

// Inside of a sliding action button (Uiverse, andrew-demchenk0): the label,
// plus an icon panel that slides across the whole button on hover. Use on a
// .btn with the extra class .btn-slide.
// A bare line icon from the same set (for icon-only buttons).
export const icon = (name) => html`<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${raw(ICONS[name])}</svg>`;

export const slide = (label, icon) => html`<span class="btn-slide__text">${label}</span><span class="btn-slide__icon" aria-hidden="true"><svg viewBox="0 0 24 24">${raw(ICONS[icon])}</svg></span>`;

export function render(el, content) {
    el.innerHTML = show(content);
    window.pmForms.enhance(el);
    return el;
}

// ---------------------------------------------------------------- formatting

export const humanise = (v) => (v ? v[0].toUpperCase() + v.slice(1).replaceAll('_', ' ') : '');

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad = (n) => String(n).padStart(2, '0');
// 'YYYY-MM-DD' is a calendar date: parse it as local, not UTC midnight.
const toDate = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(v + 'T00:00:00') : new Date(v));

export const today = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
export const nowTime = () => { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`; };
const hhmm = (t) => t.slice(0, 5); // '17:30:00' -> '17:30'
export const fmtShort = (v) => { const d = toDate(v); return `${d.getDate()} ${MONTHS[d.getMonth()]}`; };
export const fmtDate = (v) => (v ? `${fmtShort(v)} ${toDate(v).getFullYear()}` : '');
export const fmtDateTime = (v) => { const d = toDate(v); return `${fmtDate(v)}, ${pad(d.getHours())}:${pad(d.getMinutes())}`; };

// A deadline is a date plus an optional time; without a time it lasts all day.
export const fmtDue = (date, time) => (date ? fmtDate(date) + (time ? `, ${hhmm(time)}` : '') : '');
export const isOverdue = (date, time) => !!date && (date < today() || (date === today() && !!time && time < nowTime()));

// Past its deadline and not finished: completed tasks and completed or
// archived projects never count as late.
export const taskLate = (t) => t.status !== 'completed' && isOverdue(t.due_date, t.due_time);
export const projectLate = (p) => !['completed', 'archived'].includes(p.status) && isOverdue(p.due_date, p.due_time);

// "Overdue by 3 days" / "Overdue since 17:30 today".
export function overdueText(date, time) {
    const days = Math.round((toDate(today()) - toDate(date)) / 86400000);
    return days > 0 ? `Overdue by ${days} day${days === 1 ? '' : 's'}` : `Overdue since ${hhmm(time)} today`;
}

export const overdueBadge = (date, time) =>
    html`<span class="badge badge-overdue" title="${overdueText(date, time)}">Overdue</span>`;

// The banner at the top of an overdue task or project page.
export const overdueBanner = (noun, date, time) => html`
    <div class="alert alert-urgent mb-4" role="alert">
        <strong>⚠ This ${noun} is ${overdueText(date, time).toLowerCase()}</strong> — it was due ${fmtDue(date, time)}. Deal with it now.
    </div>`;

// [css class, label] for a deadline relative to now. Pass done=true for
// finished work, so a past date isn't flagged as overdue.
export function dueState(due, time, done = false) {
    if (!due) return ['', 'No due date'];
    const at = time ? `, ${hhmm(time)}` : '';
    if (done) return ['', `Due ${fmtDue(due, time)}`];
    if (isOverdue(due, time)) return ['is-overdue', `Overdue — ${fmtShort(due)}${at}`];
    if (due === today()) return ['is-due-today', `Due today${at}`];
    return ['', `Due ${fmtDue(due, time)}`];
}

// The optional time input that sits next to a due date on the forms.
export const dueTimeField = (value) => html`
    <div class="field">
        <label for="due_time">Due time</label>
        <input type="time" id="due_time" name="due_time" value="${value ? hhmm(value) : ''}">
        <p class="hint">Optional. Leave blank for any time that day.</p>
    </div>`;

export const progress = (percent) => html`
    <span class="text-muted">${percent}%</span>
    <span class="progress" role="img" aria-label="${percent}% of tasks complete"><span class="progress-bar" style="width: ${percent}%"></span></span>`;

// Select string for activity rows with the actor's username.
export const ACTIVITY = '*, profile:profiles(username)';

// One activity entry with its field diff. A creation has no old value, so only the new one shows.
export function activityItem(entry) {
    const who = entry.profile?.username;
    const changes = Object.entries(entry.new_values ?? {});
    return html`<div class="activity-item">
        <span class="avatar" aria-hidden="true">${(who ?? '?')[0]}</span>
        <div>
            <div class="activity-body"><strong>${who ?? 'A removed user'}</strong> ${entry.description ?? entry.action}</div>
            ${changes.length ? html`<div class="activity-diff">${changes.map(([field, value]) => {
                const old = entry.old_values?.[field];
                return html`${field}: ${old != null ? html`${old} &rarr; ` : ''}${value}<br>`;
            })}</div>` : ''}
            <div class="activity-time">${fmtDateTime(entry.created_at)}</div>
        </div>
    </div>`;
}

export const badge = (kind, value) => html`<span class="badge badge-${kind}-${value}">${humanise(value)}</span>`;

// ---------------------------------------------------------------- errors & flash

export function errorMessage(error) {
    switch (error?.code) {
        case 'P0002': return 'That could not be found, or you do not have access to it.';
        case '23505': return 'That already exists.';
        case '23514': return 'Please check the values you entered.';
        case '42501': return error.message.startsWith('new row') || error.message.startsWith('permission')
            ? 'You do not have permission to do that.' : error.message;
        default: return error?.message || 'Something went wrong. Please try again.';
    }
}

// Throws the Supabase error so callers can use try/catch.
export async function call(request) {
    const { data, error } = await request;
    if (error) throw error;
    return data;
}

export const flash = (message, type = 'success') => sessionStorage.setItem('flash', JSON.stringify({ message, type }));
export function go(url, message) {
    if (message) flash(message);
    location.href = url;
}

export function showAlert(message, type = 'error') {
    const box = document.getElementById('alerts');
    box.innerHTML = show(html`<div class="alert alert-${type}" role="${type === 'error' ? 'alert' : 'status'}">${message}</div>`);
    box.scrollIntoView({ block: 'nearest' });
}

function showFlash() {
    const stored = sessionStorage.getItem('flash');
    if (stored) {
        sessionStorage.removeItem('flash');
        const { message, type } = JSON.parse(stored);
        showAlert(message, type);
    }
}

// Submit handler that runs after forms.js validation and reports failures inline.
export function onSubmit(form, handler) {
    form.addEventListener('submit', async (event) => {
        if (event.defaultPrevented) return; // blocked by validation
        event.preventDefault();
        try {
            await handler(Object.fromEntries(new FormData(form)), form);
        } catch (error) {
            showAlert(errorMessage(error));
            window.pmForms.reset(form);
        }
    });
}

// ---------------------------------------------------------------- params

export const param = (name) => new URLSearchParams(location.search).get(name);
export function idParam(name) {
    const n = Number(param(name));
    return Number.isInteger(n) && n > 0 ? n : null;
}

// ---------------------------------------------------------------- shell

export let me = null; // { id, username } of the signed-in user

// Light/dark rocker switch (checked = dark). The <head> script has already set
// data-theme; this only renders the switch, flips it, and remembers the choice.
const themeSwitch = (extra = '') => html`
    <label class="rocker rocker-header ${extra}" title="Switch light / dark mode">
        <input type="checkbox" data-theme-switch aria-label="Dark mode"
               ${document.documentElement.dataset.theme === 'dark' ? 'checked' : ''}>
        <span class="switch-left" aria-hidden="true">☾</span>
        <span class="switch-right" aria-hidden="true">☀</span>
    </label>`;

function bindThemeSwitch() {
    const input = document.querySelector('[data-theme-switch]');
    const apply = (theme) => {
        document.documentElement.dataset.theme = theme;
        input.checked = theme === 'dark';
    };
    input.addEventListener('change', () => {
        const theme = input.checked ? 'dark' : 'light';
        apply(theme);
        try { localStorage.setItem('theme', theme); } catch { /* private mode: still switches */ }
    });
    // Until the user picks, keep following the system setting.
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        let saved = null;
        try { saved = localStorage.getItem('theme'); } catch { /* ignore */ }
        if (!saved) apply(e.matches ? 'dark' : 'light');
    });
}

// Letter-roll label (Uiverse, KINGFRESS) for the top-bar pills: two copies of
// the word stacked in one line; on hover each letter rolls out downwards while
// its twin rolls in from above, staggered letter by letter. Screen readers get
// the plain word.
function roll(label) {
    const letters = (row) => [...label].map((ch, i) => html`<span style="--i: ${i}">${ch === ' ' ? raw('&nbsp;') : ch}</span>`);
    return html`<span class="roll" aria-hidden="true"><span class="roll__row">${letters()}</span><span class="roll__row roll__row--in">${letters()}</span></span><span class="visually-hidden">${label}</span>`;
}

const brand = html`<a class="brand" href="index.html"><span class="brand-mark" aria-hidden="true">PM</span><span>Project Manager</span></a>`;
const footer = () => html`&copy; ${new Date().getFullYear()} Project Manager`;

// Renders the signed-in shell and returns the element to put content in.
// Visitors are sent to sign in, then brought back here.
export async function page(title, { auth = true } = {}) {
    document.title = `${title} · Project Manager`;
    const { data: { session } } = await sb.auth.getSession();

    if (!session && auth) {
        const here = location.pathname.split('/').pop() + location.search;
        location.replace('login.html?next=' + encodeURIComponent(here));
        return new Promise(() => {}); // never resolves; the page is leaving
    }

    let actions = html`<a class="top-btn" href="login.html">${roll('Sign in')}</a><a class="top-btn top-btn--primary" href="register.html">${roll('Create account')}</a>`;
    let nav = '';

    if (session) {
        me = await call(sb.from('profiles').select('id, username, is_admin').eq('id', session.user.id).single());
        const { count } = await sb.from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null);
        const section = location.pathname.split('/').pop();
        const current = (...names) => (names.some((n) => section.startsWith(n)) ? 'page' : 'false');
        nav = html`<nav class="app-nav" aria-label="Main">
            <a class="top-btn" href="dashboard.html" aria-current="${current('dashboard')}">${roll('Dashboard')}</a>
            <a class="top-btn" href="projects.html" aria-current="${current('project', 'board', 'task', 'activity')}">${roll('Projects')}</a>
        </nav>`;
        actions = html`
            <a class="top-btn notification-link" href="notifications.html" aria-current="${current('notifications')}" aria-label="Notifications${count ? `, ${count} unread` : ''}">
                ${roll('Notifications')}
                ${count ? html`<span class="notification-count">${Math.min(count, 99)}</span>` : ''}
            </a>
            <span class="user-chip"><span class="avatar" aria-hidden="true">${me.username[0]}</span><span>${me.username}</span></span>
            <button type="button" class="top-btn" data-sign-out>${roll('Sign out')}</button>`;
    }

    document.body.innerHTML = show(html`
        <a class="skip-link" href="#main-content">Skip to main content</a>
        <header class="app-header"><div class="container">${brand}${nav}${themeSwitch()}<div class="app-header-actions">${actions}</div></div></header>
        <main class="app-main" id="main-content" tabindex="-1">
            <div class="container">
                <div id="alerts" aria-live="polite" aria-atomic="true"></div>
                <div id="content"><p class="text-muted">Loading…</p></div>
            </div>
        </main>
        <footer class="app-footer"><div class="container">${footer()}</div></footer>`);

    document.querySelector('[data-sign-out]')?.addEventListener('click', async () => {
        await sb.auth.signOut();
        go('login.html', 'You have been signed out.');
    });
    bindThemeSwitch();
    showFlash();
    return document.getElementById('content');
}

// The centred card used by sign in, register and password reset.
export function authPage(title) {
    document.title = `${title} · Project Manager`;
    document.body.innerHTML = show(html`
        <a class="skip-link" href="#main-content">Skip to main content</a>
        <div class="auth-shell">
            ${themeSwitch('auth-theme')}
            <div class="auth-brand">${brand}</div>
            <main class="auth-body" id="main-content" tabindex="-1">
                <div class="auth-card"><div class="card-body">
                    <div id="alerts" aria-live="polite" aria-atomic="true"></div>
                    <div id="content"></div>
                </div></div>
            </main>
            <footer class="auth-footer">${footer()}</footer>
        </div>`);
    bindThemeSwitch();
    showFlash();
    return document.getElementById('content');
}

// Shows the not-found state; `await notFound(el)` also halts the page script.
export function notFound(el) {
    render(el, html`<div class="empty-state card"><h2>Not found</h2>
        <p>That page does not exist, or you do not have access to it.</p>
        <p><a class="btn btn-secondary" href="projects.html">Back to projects</a></p></div>`);
    return new Promise(() => {});
}

// ---------------------------------------------------------------- roles

const RANK = { owner: 4, manager: 3, member: 2, viewer: 1 };
// Mirrors ProjectPolicy, only to hide controls; the database re-checks every write.
export const can = (role, min) => (RANK[role] ?? 0) >= RANK[min];

// The effective role comes from the database, so a site admin (owner-level
// everywhere) is handled the same way as a real owner.
export async function projectAndRole(projectId) {
    const [project, role] = await Promise.all([
        sb.from('projects').select('*').eq('id', projectId).maybeSingle(),
        sb.rpc('my_project_role', { p_project: projectId }),
    ]);
    return { project: project.data, role: role.data ?? null };
}
