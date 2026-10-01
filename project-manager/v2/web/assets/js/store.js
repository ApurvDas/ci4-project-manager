// The local copy. Everything the signed-in user can see is kept in IndexedDB so pages open
// instantly and still read offline. sync() pulls what changed (the sync_pull() function),
// and Supabase Realtime tells open apps when to pull again.
//
// Edits made here go through mutate(): the edit joins the outbox, the pages show its effect at
// once (the outbox is replayed over the server's copy whenever the copy is read), and it is sent
// to the server — now if online, else when the connection returns — through the same functions
// the app always used, so every role check still runs there. Permissions live on the server.
import * as q from './queries.js';
import { OPS, tempId, translate, createdRows } from './ops.js';

// One object store per synced table, plus `meta` (cursor, user, id aliases) and `outbox` (waiting edits).
const TABLES = ['profiles', 'projects', 'project_members', 'tasks', 'task_assignees', 'tags', 'task_tags', 'task_comments',
    'task_checklists', 'task_checklist_items', 'time_entries', 'notifications', 'activity_logs'];
const keyOf = (table, row) => (table === 'task_tags' ? [row.task_id, row.tag_id] : row.id);

let sb;
export const init = (client) => { sb = client; };

const noop = () => {};
const wrap = (request) => new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
});

let opening;
const open = () => (opening ??= new Promise((resolve, reject) => {
    const request = indexedDB.open('pm', 2);
    request.onupgradeneeded = () => {
        const db = request.result;
        for (const table of TABLES) {
            if (!db.objectStoreNames.contains(table)) db.createObjectStore(table, { keyPath: table === 'task_tags' ? ['task_id', 'tag_id'] : 'id' });
        }
        if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'k' });
        if (db.objectStoreNames.contains('outbox')) db.deleteObjectStore('outbox'); // version 1 had no entries yet
        db.createObjectStore('outbox', { keyPath: 'seq', autoIncrement: true });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
}));

const meta = async (k) => (await wrap((await open()).transaction('meta').objectStore('meta').get(k)))?.v;
const putMeta = async (k, v) => wrap((await open()).transaction('meta', 'readwrite').objectStore('meta').put({ k, v }));
const outboxStore = async (mode) => (await open()).transaction('outbox', mode).objectStore('outbox');

// ---------------------------------------------------------------- reading

// The whole local copy as one object: the server's rows from IndexedDB, with the waiting edits
// replayed over them. Kept until the next sync or edit changes it.
let cached;
export function snapshot() {
    return (cached ??= build());
}
async function build() {
    const tx = (await open()).transaction([...TABLES, 'meta', 'outbox']);
    const s = {};
    await Promise.all(TABLES.map(async (t) => { s[t] = await wrap(tx.objectStore(t).getAll()); }));
    s.me = (await wrap(tx.objectStore('meta').get('me')))?.v ?? null;
    s.aliases = (await wrap(tx.objectStore('meta').get('aliases')))?.v ?? {};
    for (const entry of await wrap(tx.objectStore('outbox').getAll())) {
        if (entry.state !== 'pending') continue;
        // Rows the server already has (a pull brought them in) are real now: remember their ids, and don't replay.
        const rows = createdRows(entry.op, entry.args, s);
        for (const { k, row } of rows) if (row) s.aliases[tempId(entry.seq, k)] = row.id;
        if (entry.sent || (rows.length && rows.every((r) => r.row))) continue;
        try { OPS[entry.op].local(s, entry.args, { now: entry.at, tid: (k) => tempId(entry.seq, k) }); } catch { /* it no longer applies: skip it */ }
    }
    return s;
}
// read(queries.projectPage, id): run one of the page queries against the local copy.
export const read = async (query, ...args) => query(await snapshot(), ...args);

// ---------------------------------------------------------------- syncing

const listeners = new Set();
export const onChange = (fn) => listeners.add(fn);
const statusListeners = new Set();
export const onStatus = (fn) => statusListeners.add(fn);
const noticeListeners = new Set();
export const onNotice = (fn) => noticeListeners.add(fn);
const notice = (message) => noticeListeners.forEach((fn) => fn(message));

function changed() {
    cached = null;
    for (const fn of listeners) fn();
    for (const fn of statusListeners) fn();
}

// Drop a deleted task's rows, or a deleted/hidden project's rows, since the server only
// reports the parent. Runs inside the apply() transaction.
async function drop(tx, { tasks = new Set(), projects = new Set() }) {
    const all = (t) => wrap(tx.objectStore(t).getAll());
    const del = (t, row) => tx.objectStore(t).delete(keyOf(t, row));
    for (const t of await all('tasks')) if (projects.has(t.project_id)) tasks.add(t.id);
    const lists = new Set((await all('task_checklists')).filter((c) => tasks.has(c.task_id)).map((c) => c.id));
    for (const i of await all('task_checklist_items')) if (lists.has(i.checklist_id)) del('task_checklist_items', i);
    for (const t of ['task_assignees', 'task_tags', 'task_comments', 'task_checklists', 'time_entries']) {
        for (const row of await all(t)) if (tasks.has(row.task_id)) del(t, row);
    }
    for (const row of await all('tasks')) if (tasks.has(row.id)) del('tasks', row);
    for (const t of ['project_members', 'tags', 'activity_logs', 'notifications']) {
        for (const row of await all(t)) if (projects.has(row.project_id)) del(t, row);
    }
    for (const row of await all('projects')) if (projects.has(row.id)) del('projects', row);
}

async function apply(data, full) {
    const tx = (await open()).transaction([...TABLES, 'meta'], 'readwrite');
    if (full) for (const t of TABLES) tx.objectStore(t).clear();

    // Deletions go first: a row deleted and then re-created (same key) arrives in both lists,
    // and the re-created one must win. A full pull is already the whole truth, so it has none to apply.
    const gone = { tasks: new Set(), projects: new Set() };
    for (const d of full ? [] : data.deletions) {
        if (d.table_name === 'tasks') gone.tasks.add(Number(d.row_id));
        else if (d.table_name === 'projects') gone.projects.add(Number(d.row_id));
        else tx.objectStore(d.table_name).delete(d.table_name === 'task_tags' ? d.row_id.split(':').map(Number) : Number(d.row_id));
    }
    await drop(tx, gone);
    for (const t of TABLES) for (const row of data[t]) tx.objectStore(t).put(row);

    // A project that is no longer visible (deleted, or the user was removed) goes with everything in it.
    const hidden = { tasks: new Set(), projects: new Set() };
    const visible = new Set(data.visibleProjects);
    for (const p of await wrap(tx.objectStore('projects').getAll())) if (!visible.has(p.id)) hidden.projects.add(p.id);
    await drop(tx, hidden);

    tx.objectStore('meta').put({ k: 'cursor', v: data.now });
    tx.objectStore('meta').put({ k: 'user', v: data.me.id });
    tx.objectStore('meta').put({ k: 'me', v: data.me });
    await new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = tx.onabort = () => reject(tx.error); });
    cached = null;
}

async function pullOnce() {
    if (navigator.onLine === false) throw new Error('offline');
    const pull = async (since) => {
        const { data, error } = await sb.rpc('sync_pull', { p_since: since ?? null });
        if (error) throw error;
        return data;
    };
    const [user, cursor] = [await meta('user'), await meta('cursor')];
    let data = await pull(cursor);
    let full = !cursor;
    if (user && user !== data.me.id) { data = await pull(null); full = true; } // someone else signed in on this device
    await apply(data, full);
    for (const fn of listeners) fn();
}

// One pull at a time; a request that arrives mid-pull makes one more follow it.
let running;
let again = false;
export function sync() {
    if (running) { again = true; return running; }
    running = (async () => {
        try {
            do { again = false; await pullOnce(); } while (again);
        } finally { running = null; }
    })();
    return running;
}

// Sign-out: the next person on this device must not see this one's data.
export async function clear() {
    const tx = (await open()).transaction([...TABLES, 'meta', 'outbox'], 'readwrite');
    for (const t of [...TABLES, 'meta', 'outbox']) tx.objectStore(t).clear();
    await new Promise((resolve) => { tx.oncomplete = resolve; tx.onerror = tx.onabort = resolve; });
    changed();
}

let started = false;
// Pages call this once the user is known. First run on a device waits for the first pull;
// afterwards the page shows the local copy straight away and refreshes in the background.
// Returns false when there is nothing local and no connection to fetch it.
export async function ready(userId) {
    await open();
    const owner = await meta('user');
    if (owner && owner !== userId) await clear(); // never show another user's data
    start();
    flush().catch(noop);
    if (await meta('cursor')) { sync().catch(noop); return true; }
    try { await sync(); return true; } catch { return false; }
}

function start() {
    if (started) return;
    started = true;
    // Every change event just triggers one debounced pull, so there is a single path for data.
    let timer;
    const soon = () => { clearTimeout(timer); timer = setTimeout(() => sync().catch(noop), 300); };
    const channel = sb.channel('pm-sync');
    for (const table of [...TABLES.filter((t) => t !== 'profiles'), 'deletions']) {
        channel.on('postgres_changes', { event: '*', schema: 'public', table }, soon);
    }
    // Pull once the connection is live (and again after any reconnect): a change that landed between
    // the page's first pull and the connection becoming active would otherwise never be announced.
    channel.subscribe((status) => { if (status === 'SUBSCRIBED') soon(); });
    addEventListener('online', () => { flush().catch(noop); soon(); for (const fn of statusListeners) fn(); });
    addEventListener('offline', () => { for (const fn of statusListeners) fn(); });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) { flush().catch(noop); soon(); } });
    setInterval(() => flush().catch(noop), 30_000); // an edit that could not be sent is tried again
    // A live event can be lost (a dropped connection, a busy server); a slow pull from a visible window
    // makes sure the copy catches up regardless.
    // ponytail: every open window pulls each minute; lengthen it, or drop it, if that ever shows up in load.
    setInterval(() => { if (!document.hidden) sync().catch(noop); }, 60_000);
}

// ---------------------------------------------------------------- the outbox

const outbox = async () => wrap((await outboxStore('readonly')).getAll());
const entryAt = async (seq) => wrap((await outboxStore('readonly')).get(seq));
const save = async (entry) => wrap((await outboxStore('readwrite')).put(entry));
const remove = async (seq) => wrap((await outboxStore('readwrite')).delete(seq));

// { online, pending, failed, entries }: for the sync pill and the list behind it.
export async function status() {
    const entries = await outbox();
    return {
        online: navigator.onLine !== false,
        pending: entries.filter((e) => e.state === 'pending').length,
        failed: entries.filter((e) => e.state === 'failed').length,
        entries: entries.map((e) => ({ seq: e.seq, state: e.state, label: OPS[e.op].label(e.args), error: e.error })),
    };
}

// Drop an edit that the server refused (the page already stopped showing it).
export async function discard(seq) {
    await remove(seq);
    changed();
}

const waiting = new Set(); // edits whose caller is still waiting to hear if the server accepted them

// Make an edit: it shows at once, and is sent now if online (a refusal is thrown, like a failed
// request used to be) or queued if not. Returns the id of the row it created, if it created one.
export async function mutate(op, args) {
    const def = OPS[op];
    const entry = { op, args: def.prepare ? def.prepare(args) : args, at: new Date().toISOString(), state: 'pending' };
    const seq = await wrap((await outboxStore('readwrite')).add(entry));
    waiting.add(seq);
    changed();
    try {
        const online = navigator.onLine !== false;
        if (online) {
            await flush();
            if ((await entryAt(seq))?.state === 'pending') await flush(); // one that arrived as the last drain ended
        }
        const done = await entryAt(seq);
        if (online && done?.state === 'failed') {
            await remove(seq);
            changed();
            throw Object.assign(new Error(done.error.message), { code: done.error.code });
        }
    } finally { waiting.delete(seq); }

    const created = def.created?.(entry.args).find((c) => c.k === 0);
    if (!created) return undefined;
    const temp = tempId(seq, 0);
    return ((await meta('aliases')) ?? {})[temp] ?? temp;
}

let flushing;
// Send the waiting edits in the order they were made, stopping at the first the connection can't carry.
export function flush() {
    if (!flushing) flushing = drain().finally(() => { flushing = null; });
    return flushing;
}
async function drain() {
    for (;;) {
        if (navigator.onLine === false) return;
        const next = (await outbox()).find((e) => e.state === 'pending');
        if (!next || !(await sendOne(next))) return;
    }
}

// A request that never reached the server (or an expired sign-in that will refresh) is worth retrying;
// anything else is the server's answer.
const retryable = (error) => !error.code || /^PGRST30\d$/.test(error.code) || /^5\d\d$/.test(String(error.code));

async function fail(entry, error) {
    entry.state = 'failed';
    entry.error = error;
    await save(entry);
    if (!waiting.has(entry.seq)) notice(`Could not save “${OPS[entry.op].label(entry.args)}”: ${error.message}`);
    changed();
}

// Returns false when the edit should be tried again later.
async function sendOne(entry) {
    const def = OPS[entry.op];
    if (!entry.sent) {
        let args;
        try {
            args = translate(entry.op, entry.args, (await meta('aliases')) ?? {});
        } catch (error) {
            await fail(entry, { code: 'DEPENDS', message: error.message });
            return true;
        }
        let result;
        try { result = await def.send(sb, args); } catch { return false; }
        const { data, error } = result;
        if (error && retryable(error)) return false;
        if (error && !def.tolerate?.(error)) {
            await fail(entry, { code: error.code, message: error.message });
            return true;
        }
        if (!error) tellConflicts(entry, data);
        entry.sent = true; // the server has it; only the clean-up below is left
        await save(entry);
    }
    try { await sync(); } catch { return false; } // the pull brings the real rows in; if we are offline again, it waits
    await recordAliases(entry);
    await remove(entry.seq);
    changed();
    return true;
}

// Remember which real id each temporary id became, for later edits and for pages still showing the temporary one.
async function recordAliases(entry) {
    const found = createdRows(entry.op, entry.args, await snapshotOfServer());
    if (!found.some((f) => f.row)) return;
    const aliases = (await meta('aliases')) ?? {};
    for (const { k, row } of found) if (row) aliases[tempId(entry.seq, k)] = row.id;
    await putMeta('aliases', aliases);
}
async function snapshotOfServer() {
    const tx = (await open()).transaction(TABLES);
    const s = {};
    await Promise.all(TABLES.map(async (t) => { s[t] = await wrap(tx.objectStore(t).getAll()); }));
    return s;
}

// "Your edit replaced …" / "kept the newer change …": what the per-field merge did on the server.
function tellConflicts(entry, data) {
    const what = entry.args.fields?.title ?? entry.args.fields?.name ?? 'an item';
    const show = (v) => (v == null ? 'empty' : Array.isArray(v) ? `${v.length} chosen` : `“${v}”`);
    const field = (f) => f.replaceAll('_', ' ');
    for (const o of data?.overwritten ?? []) notice(`${what}: your change to ${field(o.field)} replaced ${show(o.theirs)}, which was edited earlier.`);
    for (const l of data?.lost ?? []) notice(`${what}: your change to ${field(l.field)} (${show(l.yours)}) was older than a change made by someone else, so theirs was kept.`);
}

// ---------------------------------------------------------------- showing it

// Render a page from the local copy now, and again whenever a sync changes what it shows.
// `load` returns the page's data, `view` draws it. A redraw is skipped when nothing the page
// shows changed, and held back while the user is typing in the page or dragging a card,
// so it never eats their input. The returned promise also carries quiet(write): for a write the
// page has already shown in place (a card drop, a tick) — no redraw while it runs, and the page
// then adopts the fresh data as what it is showing.
export function live(content, load, view) {
    let last;
    let held = false;
    let quietly = 0;
    // A redraw replaces the buttons, so give focus back to the same toggle (keyboard users).
    const focused = () => { const el = document.activeElement; return content.contains(el) && el.id ? `#${el.id}` : el?.dataset?.toggleItem ? `[data-toggle-item="${el.dataset.toggleItem}"]` : null; };
    const run = async () => {
        const data = await load();
        const key = JSON.stringify(data);
        if (key === last) return;
        last = key;
        const again = focused();
        view(data);
        if (again) content.querySelector(again)?.focus();
    };
    const typing = () => [...content.querySelectorAll('input, textarea')]
        .some((el) => !['hidden', 'checkbox', 'radio', 'button', 'submit', 'color', 'range', 'file'].includes(el.type) && el.value !== el.defaultValue);
    const busy = () => (content.contains(document.activeElement) && /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName))
        || typing() || !!content.querySelector('.is-dragging');
    const refresh = async () => {
        if (quietly || busy()) { held = true; return; }
        try { await run(); } catch { /* the copy is mid-update: the next change redraws */ }
    };
    const release = () => { if (held) { held = false; setTimeout(refresh, 0); } };
    content.addEventListener('focusout', release);
    content.addEventListener('dragend', release);
    onChange(refresh);
    const quiet = async (write) => {
        quietly++;
        try { await write(); } finally {
            quietly--;
            try { last = JSON.stringify(await load()); } catch { /* the next change redraws */ }
        }
    };
    return Object.assign(run(), { quiet });
}

export const unreadCount = () => read(q.unread);
// A small key-value place in the local database, for things a feature wants to remember (the desktop app's reminders).
export const kv = { get: meta, set: putMeta };
// Who last synced on this device, for reading offline when the sign-in can't be refreshed.
export const cachedMe = () => meta('me');
