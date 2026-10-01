// Shared page plumbing: the Supabase client, escaped HTML templates, the page
// shell (header, alerts, footer), flash messages, dates and error text.
// Everything here is presentation — permissions are enforced by the database.
import config from './config.js';

export const sb = window.supabase.createClient(config.url, config.anonKey);

// Live site only (the deploy sets window.BUILD): if the browser served this
// page's HTML from an older build, reload once so it picks up the new one.
if (window.BUILD) {
    fetch('version.txt', { cache: 'no-store' })
        .then((r) => (r.ok ? r.text() : null))
        .then((latest) => {
            latest = latest?.trim();
            if (!latest || latest === window.BUILD) return;
            try {
                if (sessionStorage.getItem('reloadedFor') === latest) return; // never loop
                sessionStorage.setItem('reloadedFor', latest);
            } catch { /* storage blocked: still worth one reload */ }
            location.reload();
        })
        .catch(() => { /* offline or blocked: keep the page as it is */ });
    // Offline shell; local dev (no BUILD) never registers it, so it never serves stale files.
    navigator.serviceWorker?.register('sw.js').catch(() => { /* unsupported or blocked: fine */ });
}

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

// Wandering eyes loader (a port of the WanderingEyes React component the user
// chose), drawn in currentColor so it follows the theme. See .eyes in app.css.
export const loader = ({ label = 'Loading…', cls = '' } = {}) => html`<span class="eyes ${cls}" role="status">
    <span class="eyes__eye" aria-hidden="true"></span><span class="eyes__eye" aria-hidden="true"></span>
    <span class="visually-hidden">${label}</span></span>`;

// Heroicons v2.2.0, outline set (https://heroicons.com/outline), MIT licensed.
// Drawn with currentColor at stroke-width 1.5, as Heroicons intends.
const ICONS = {
    'edit': '<path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10"/>', // pencil-square
    'save': '<path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5"/>', // check
    'plus': '<path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/>', // plus
    'trash': '<path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"/>', // trash
    'archive': '<path stroke-linecap="round" stroke-linejoin="round" d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z"/>', // archive-box
    'reopen': '<path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"/>', // arrow-path
    'send': '<path stroke-linecap="round" stroke-linejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5"/>', // paper-airplane
    'user-plus': '<path stroke-linecap="round" stroke-linejoin="round" d="M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM3 19.235v-.11a6.375 6.375 0 0 1 12.75 0v.109A12.318 12.318 0 0 1 9.374 21c-2.331 0-4.512-.645-6.374-1.766Z"/>', // user-plus
    'user-minus': '<path stroke-linecap="round" stroke-linejoin="round" d="M22 10.5h-6m-2.25-4.125a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM4 19.235v-.11a6.375 6.375 0 0 1 12.75 0v.109A12.318 12.318 0 0 1 10.374 21c-2.331 0-4.512-.645-6.374-1.766Z"/>', // user-minus
    'tag': '<path stroke-linecap="round" stroke-linejoin="round" d="M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z"/><path stroke-linecap="round" stroke-linejoin="round" d="M6 6h.008v.008H6V6Z"/>', // tag
    'check-all': '<path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/>', // check-circle
    'filter': '<path stroke-linecap="round" stroke-linejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 0 1-.659 1.591l-5.432 5.432a2.25 2.25 0 0 0-.659 1.591v2.927a2.25 2.25 0 0 1-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 0 0-.659-1.591L3.659 7.409A2.25 2.25 0 0 1 3 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0 1 12 3Z"/>', // funnel
    'plus-circle': '<path stroke-linecap="round" stroke-linejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/>', // plus-circle
    'play': '<path stroke-linecap="round" stroke-linejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z"/>', // play
    'stop': '<path stroke-linecap="round" stroke-linejoin="round" d="M5.25 7.5A2.25 2.25 0 0 1 7.5 5.25h9a2.25 2.25 0 0 1 2.25 2.25v9a2.25 2.25 0 0 1-2.25 2.25h-9a2.25 2.25 0 0 1-2.25-2.25v-9Z"/>', // stop
    'clock': '<path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/>', // clock
    'search': '<path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"/>', // magnifying-glass
    'chart': '<path stroke-linecap="round" stroke-linejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z"/>', // chart-bar
};

// Inside of a sliding action button (Uiverse, andrew-demchenk0): the label,
// plus an icon panel that slides across the whole button on hover. Use on a
// .btn with the extra class .btn-slide.
// A bare line icon from the same set (for icon-only buttons).
export const icon = (name, cls = 'icon') => html`<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${raw(ICONS[name])}</svg>`;

export const slide = (label, icon) => html`<span class="btn-slide__text">${label}</span><span class="btn-slide__icon" aria-hidden="true"><span class="btn-slide__glyph"><svg viewBox="0 0 24 24">${raw(ICONS[icon])}</svg></span></span>`;

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
// 95 -> '1h 35m', 45 -> '45m', 0 -> '0m'.
export const fmtMinutes = (m) => { m = Math.max(0, Math.round(m)); return m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ''}` : `${m}m`; };
export const fmtDate = (v) => (v ? `${fmtShort(v)} ${toDate(v).getFullYear()}` : '');
export const fmtDateTime = (v) => { const d = toDate(v); return `${fmtDate(v)}, ${pad(d.getHours())}:${pad(d.getMinutes())}`; };

// A deadline is a date plus an optional time; without a time it lasts all day.
export const fmtDue = (date, time) => (date ? fmtDate(date) + (time ? `, ${hhmm(time)}` : '') : '');
export const isOverdue = (date, time) => !!date && (date < today() || (date === today() && !!time && time < nowTime()));

// Past its deadline and not finished: completed tasks and completed or
// archived projects never count as late. A project whose work is all done
// (progress 100%) isn't late either, even if nobody has marked it complete yet.
export const taskLate = (t) => t.status !== 'completed' && isOverdue(t.due_date, t.due_time);
export const projectLate = (p) => !['completed', 'archived'].includes(p.status) && !(p.progress >= 100) && isOverdue(p.due_date, p.due_time);

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
    const who = entry.profile?.username ?? (entry.action === 'auto' ? 'Project Manager' : null); // 'auto' = the system acted
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

// Analogue clock (Uiverse, escannord), redrawn as SVG in the site's colours and
// shown floating in the bottom-right corner of every page: a ring, 12 marks
// (bolder at 12/3/6/9), rounded hour and minute hands, a red second hand with
// a tail and a capped centre, in the original's proportions. Around it, a red
// arc fills as the day passes (midnight to midnight): "time passing away".
// The second hand sweeps in CSS (8 steps a second, no JavaScript per frame);
// the other hands and the arc are set once a minute, so an idle page costs
// almost nothing on a slow PC.
const clockMarks = Array.from({ length: 12 }, (_, i) => {
    const major = i % 3 === 0;
    const w = major ? 6 : 3;
    const h = major ? 24 : 14;
    return html`<rect class="clock__mark ${major ? 'clock__mark--major' : ''}" x="${100 - w / 2}" y="${34 - h / 2}" width="${w}" height="${h}" rx="${w / 2}" transform="rotate(${i * 30} 100 100)"/>`;
});
const clock = () => html`<div class="clock" data-clock role="img" aria-label="Current time">
    <svg viewBox="-16 -16 232 232" aria-hidden="true">
        <circle class="clock__day-track" cx="100" cy="100" r="108"/>
        <circle class="clock__day" data-day cx="100" cy="100" r="108" pathLength="100" stroke-dasharray="0 100" transform="rotate(-90 100 100)"/>
        <circle class="clock__face" cx="100" cy="100" r="90"/>
        ${clockMarks}
        <rect class="clock__hand clock__hand--h" data-hand="h" x="96.5" y="60" width="7" height="44" rx="3.5"/>
        <rect class="clock__hand clock__hand--m" data-hand="m" x="97.5" y="36" width="5" height="68" rx="2.5"/>
        <rect class="clock__hand clock__hand--s" data-sweep x="98.5" y="30" width="3" height="88" rx="1.5"/>
        <circle class="clock__cap" cx="100" cy="100" r="8"/>
    </svg>
</div>`;

// Runs at the top of every minute (and when the tab becomes visible again).
function tickClocks() {
    const now = new Date();
    const sec = now.getSeconds() + now.getMilliseconds() / 1000;
    const min = now.getMinutes() + sec / 60;
    const hour = (now.getHours() % 12) + min / 60;
    const angles = { h: hour * 30, m: min * 6 };
    const dayGone = ((now.getHours() * 60 + min) / 1440) * 100; // % of today passed
    const label = `Current time ${pad(now.getHours())}:${pad(now.getMinutes())}, ${Math.floor(dayGone)}% of today has passed`;
    for (const el of document.querySelectorAll('[data-clock]')) {
        for (const hand of el.querySelectorAll('[data-hand]')) {
            hand.setAttribute('transform', `rotate(${angles[hand.dataset.hand].toFixed(2)} 100 100)`);
        }
        // A negative delay starts the 60s sweep at the real second.
        el.querySelector('[data-sweep]').style.animationDelay = `-${sec.toFixed(3)}s`;
        el.querySelector('[data-day]').setAttribute('stroke-dasharray', `${dayGone.toFixed(3)} 100`);
        if (el.getAttribute('aria-label') !== label) {
            el.setAttribute('aria-label', label);
            el.title = `${Math.floor(dayGone)}% of today has passed · ${now.toLocaleString(undefined, { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}`;
        }
    }
    clearTimeout(clockTimer);
    clockTimer = setTimeout(tickClocks, 60000 - now.getSeconds() * 1000 - now.getMilliseconds() + 50);
}

let clockTimer;
function startClocks() {
    if (clockTimer) return;
    tickClocks();
    // Timers are throttled in hidden tabs; catch up as soon as the tab is back.
    document.addEventListener('visibilitychange', () => { if (!document.hidden) tickClocks(); });
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
            <a class="top-btn" href="projects.html" aria-current="${current('project', 'board', 'task', 'activity', 'analytics')}">${roll('Projects')}</a>
            <a class="top-btn top-btn--icon" href="search.html" aria-current="${current('search')}" aria-label="Search" title="Search">${icon('search', 'top-btn__icon')}</a>
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
                <div id="content">${loader({ cls: 'eyes--page' })}</div>
            </div>
        </main>
        <footer class="app-footer"><div class="container">${footer()}</div></footer>
        ${clock()}`);

    document.querySelector('[data-sign-out]')?.addEventListener('click', async () => {
        await sb.auth.signOut();
        go('login.html', 'You have been signed out.');
    });
    bindThemeSwitch();
    startClocks();
    showFlash();
    return document.getElementById('content');
}

// The centred card used by sign in, register and password reset.
export function authPage(title) {
    document.title = `${title} · Project Manager`;
    document.body.innerHTML = show(html`
        <a class="skip-link" href="#main-content">Skip to main content</a>
        <div class="auth-shell">
            <div class="auth-corner">${themeSwitch()}</div>
            <div class="auth-brand">${brand}</div>
            <main class="auth-body" id="main-content" tabindex="-1">
                <div class="auth-card"><div class="card-body">
                    <div id="alerts" aria-live="polite" aria-atomic="true"></div>
                    <div id="content"></div>
                </div></div>
            </main>
            <footer class="auth-footer">${footer()}</footer>
        </div>
        ${clock()}`);
    bindThemeSwitch();
    startClocks();
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
