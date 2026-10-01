// Offline shell. Static files only: Supabase lives on another origin, so those
// requests never reach the cache. __BUILD__ is stamped in by scripts/stamp-version.sh,
// so every deploy gets its own cache and the old one is deleted on activate.
const CACHE = 'pm-__BUILD__';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
            .then(() => self.clients.claim()),
    );
});

self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);
    // version.txt is the "is there a newer build?" probe, so it must stay live.
    if (request.method !== 'GET' || url.origin !== location.origin || url.pathname.endsWith('/version.txt')) return;

    // Pages: network first (a deploy shows up at once), cached copy when offline.
    // Assets carry ?v=<build>, so a cached copy is always the right one.
    event.respondWith(request.mode === 'navigate' ? fromNetwork(request) : fromCache(request));
});

async function save(request, response) {
    if (response.ok) (await caches.open(CACHE)).put(request, response.clone());
    return response;
}

async function fromNetwork(request) {
    try {
        return await save(request, await fetch(request));
    } catch (err) {
        const cached = await caches.match(request, { ignoreSearch: true });
        if (cached) return cached;
        throw err;
    }
}

async function fromCache(request) {
    return (await caches.match(request)) || save(request, await fetch(request));
}
