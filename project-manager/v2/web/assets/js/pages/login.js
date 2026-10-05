import { authPage, render, html, onSubmit, sb, call, param, showAlert } from '../app.js';
import config from '../config.js';

const content = authPage('Sign in');

// Only follow same-site relative paths back after sign-in.
const next = /^[a-z-]+\.html(\?[\w=&%-]*)?$/.test(param('next') ?? '') ? param('next') : 'dashboard.html';

// Opened by the desktop app ("Sign in with your browser"): sign in here, then hand the session to
// the app through its own link. The state is the app's random code, sent back so the app only
// accepts the sign-in it asked for.
const desktop = /^[0-9a-f-]{36}$/.test(param('desktop') ?? '') ? param('desktop') : null;
const inApp = !!window.__TAURI__;

const form = html`
    <form class="auth-form" data-validated novalidate>
        <div class="field" data-validate="email">
            <label for="email">Email address</label>
            <input type="email" id="email" name="email" inputmode="email" autocomplete="email" ${inApp ? '' : 'autofocus'} required>
            <p class="field-error" role="alert"></p>
        </div>
        <div class="field" data-validate="passwordRequired">
            <label for="password">Password</label>
            <div class="field-with-toggle">
                <input type="password" id="password" name="password" autocomplete="current-password" required>
                <button type="button" class="password-toggle" data-target="password" aria-pressed="false">Show</button>
            </div>
            <p class="field-error" role="alert"></p>
        </div>
        <button type="submit" class="btn ${inApp ? 'btn-secondary' : 'btn-primary'} btn-block" data-busy-label="Signing in…">Sign in</button>
    </form>`;

render(content, html`
    <div class="auth-header">
        <h1>Sign in</h1>
        <p>${desktop ? 'Sign in to the Project Manager desktop app.' : 'Welcome back. Sign in to pick up where you left off.'}</p>
    </div>
    ${inApp ? html`
        <button type="button" class="btn btn-primary btn-block" data-browser-sign-in autofocus>Sign in with your browser</button>
        <p class="auth-hint">Your browser opens the website; once you sign in there, you're signed in here.</p>
        <p class="auth-divider">or sign in here</p>` : ''}
    ${form}
    <p class="auth-meta">Forgot your password? <a href="reset.html">Reset it</a> or <a href="magic-link.html">use a login link</a></p>
    <p class="auth-meta">Need an account? <a href="register.html">Register</a></p>`);

if (inApp) {
    const desktopModule = import('../desktop.js');
    content.querySelector('[data-browser-sign-in]').addEventListener('click', async () => {
        (await desktopModule).signInWithBrowser();
        showAlert('Finish signing in in your browser. This window will continue on its own.', 'info');
    });
}

onSubmit(content.querySelector('form'), async ({ email, password }) => {
    if (desktop) {
        // A session of the app's own: sharing this browser's would make the two sign each other out,
        // because every token refresh replaces the previous one.
        const own = window.supabase.createClient(config.url, config.anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
        const { data, error } = await own.auth.signInWithPassword({ email, password });
        if (error) throw new Error('Unable to sign in. Please check your email and password.');
        const link = `apurvdas-pm://auth#${new URLSearchParams({ state: desktop, access_token: data.session.access_token, refresh_token: data.session.refresh_token })}`;
        render(content, html`
            <div class="auth-header">
                <h1>You're signed in</h1>
                <p>Your browser asks to open Project Manager: allow it, and the app signs in. Then you can close this tab.</p>
            </div>
            <a class="btn btn-primary btn-block" href="${link}" data-open-app>Open Project Manager</a>
            <p class="auth-hint">Nothing happened? Press the button. This sign-in works for the next 15 minutes.</p>`);
        location.href = link;
        return;
    }
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw new Error('Unable to sign in. Please check your email and password.');
    location.href = next;
});

// Already signed in: skip the form (but the desktop app's sign-in always asks, for its own session).
if (!desktop && (await call(sb.auth.getSession())).session) location.replace(next);
