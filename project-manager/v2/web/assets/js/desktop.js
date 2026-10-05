// Behaviour that only makes sense inside the desktop app (the Tauri shell in ../../../desktop-app),
// loaded by app.js only when window.__TAURI__ exists, so the website never runs any of it.
//   * the tray icon's tooltip shows the running timer, and its "Stop timer" menu item stops it;
//   * Windows notifications for new notifications and for tasks due within the hour;
//   * links that belong on the website (email sign-in, password reset) open in the default browser;
//   * "Sign in with your browser": the website signs in and hands the session back by a link.
// It reads everything from the local copy, so it keeps working offline.
import * as store from './store.js';
import { sb, siteUrl, today, nowTime, showAlert, errorMessage } from './app.js';

const tauri = window.__TAURI__;
const quiet = () => {};

// "Open the website" for the pages that email links come back to.
let linked = false;
export function links() {
    if (linked) return;
    linked = true;
    document.addEventListener('click', (event) => {
        const a = event.target.closest?.('a[href]');
        if (!a || !/^(magic-link|reset)\.html/.test(a.getAttribute('href'))) return;
        event.preventDefault();
        tauri.opener.openUrl(siteUrl(a.getAttribute('href')));
    }, true);
    tauri.event.listen('auth-link', ({ payload }) => finishBrowserSignIn(payload).catch((error) => showAlert(errorMessage(error))));
}

// The random code ties the session that comes back to this request, so a link from anywhere
// else can't sign the app in (to someone else's account, say). It is kept for a while and reused,
// so pressing the button again (the browser can be slow to appear) doesn't strand the first tab.
const STATE = 'browserSignIn';
const FRESH_FOR = 15 * 60_000;

function pendingState() {
    const [state, at] = (localStorage.getItem(STATE) ?? '').split(' ');
    return state && Date.now() - Number(at) < FRESH_FOR ? state : null;
}

export function signInWithBrowser() {
    let state = pendingState();
    if (!state) {
        state = crypto.randomUUID();
        localStorage.setItem(STATE, `${state} ${Date.now()}`);
    }
    return tauri.opener.openUrl(siteUrl(`login.html?desktop=${state}`));
}

// The shell passes on apurvdas-pm://auth#state=…&access_token=…&refresh_token=…
async function finishBrowserSignIn(url) {
    const got = new URLSearchParams(new URL(url).hash.slice(1));
    const state = pendingState();
    if (!state || got.get('state') !== state) {
        showAlert('That sign-in has expired or came from somewhere else. Press "Sign in with your browser" to start again.', 'warning');
        return;
    }
    const { error } = await sb.auth.setSession({ access_token: got.get('access_token'), refresh_token: got.get('refresh_token') });
    if (error) throw new Error(`The website signed you in, but the app couldn't use it (${error.message}). Press "Sign in with your browser" to try again.`);
    localStorage.removeItem(STATE);
    location.href = 'dashboard.html';
}

const myTimer = (s) => s.time_entries.find((e) => e.user_id === s.me.id && !e.ended_at);

// The tray tooltip: the running timer, counting up, or just the app's name.
function trayTimer() {
    let last;
    const tick = async () => {
        const s = await store.snapshot();
        const run = myTimer(s);
        let text = 'Project Manager';
        if (run) {
            const secs = Math.max(0, Math.floor((Date.now() - Date.parse(run.started_at)) / 1000));
            const clock = `${Math.floor(secs / 3600)}:${String(Math.floor((secs % 3600) / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`;
            text = `Timer ${clock} · ${s.tasks.find((t) => t.id === run.task_id)?.title ?? 'a task'}`;
        }
        text = text.slice(0, 120); // Windows cuts tooltips at 127 characters
        if (text !== last) {
            last = text;
            tauri.core.invoke('tray_timer', { text }).catch(quiet);
        }
    };
    setInterval(tick, 1000);
    tick();
}

// The tray's "Stop timer": the page does the stopping, so it also works offline and is queued like any edit.
function stopFromTray() {
    tauri.event.listen('stop-timer', async () => {
        if (myTimer(await store.snapshot())) await store.mutate('stopTimer', {}).catch(quiet);
    });
}

let allowed;
async function toast(title, body) {
    allowed ??= (await tauri.notification.isPermissionGranted()) || (await tauri.notification.requestPermission()) === 'granted';
    if (allowed) tauri.notification.sendNotification({ title, body });
}

// A toast for each notification that arrives while the app is open. The first time, nothing is
// shown for what is already there (that is the past, not news).
function newNotifications() {
    let working = Promise.resolve();
    const check = async () => {
        const s = await store.snapshot();
        const mine = s.notifications.filter((n) => n.id > 0);
        const top = mine.reduce((max, n) => Math.max(max, n.id), 0);
        const seen = await store.kv.get('notifiedUpTo');
        if (seen != null) {
            for (const n of mine.filter((n) => n.id > seen && n.read_at == null).sort((a, b) => a.id - b.id)) await toast(n.title, n.message ?? '');
        }
        if (seen == null || top > seen) await store.kv.set('notifiedUpTo', top);
    };
    const queue = () => { working = working.then(check).catch(quiet); };
    store.onChange(queue);
    queue();
}

// Once a minute: warn, once, about each of my open tasks due within the next hour.
function dueSoon() {
    const check = async () => {
        const s = await store.snapshot();
        const [h, m] = nowTime().split(':').map(Number);
        const now = h * 60 + m;
        const mine = new Set(s.task_assignees.filter((a) => a.user_id === s.me.id).map((a) => a.task_id));
        const warned = new Set((await store.kv.get('warned')) ?? []);
        let changed = false;
        for (const t of s.tasks) {
            if (!mine.has(t.id) || t.status === 'completed' || t.due_date !== today() || !t.due_time) continue;
            const [dh, dm] = t.due_time.split(':').map(Number);
            const left = dh * 60 + dm - now;
            const key = `${t.id}:${t.due_date}T${t.due_time}`;
            if (left > 0 && left <= 60 && !warned.has(key)) {
                await toast('Due soon', `${t.title} is due at ${t.due_time.slice(0, 5)}`);
                warned.add(key);
                changed = true;
            }
        }
        if (changed) await store.kv.set('warned', [...warned].slice(-200));
    };
    setInterval(() => check().catch(quiet), 60_000);
    check().catch(quiet);
}

let started = false;
export function start() {
    if (started) return;
    started = true;
    links();
    trayTimer();
    stopFromTray();
    newNotifications();
    dueSoon();
}
