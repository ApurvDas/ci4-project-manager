import { authPage, render, html, onSubmit, sb, call, param } from '../app.js';

const content = authPage('Sign in');

// Only follow same-site relative paths back after sign-in.
const next = /^[a-z-]+\.html(\?[\w=&%-]*)?$/.test(param('next') ?? '') ? param('next') : 'dashboard.html';

render(content, html`
    <div class="auth-header">
        <h1>Sign in</h1>
        <p>Welcome back. Sign in to pick up where you left off.</p>
    </div>
    <form class="auth-form" data-validated novalidate>
        <div class="field" data-validate="email">
            <label for="email">Email address</label>
            <input type="email" id="email" name="email" inputmode="email" autocomplete="email" autofocus required>
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
        <button type="submit" class="btn btn-primary btn-block" data-busy-label="Signing in…">Sign in</button>
    </form>
    <p class="auth-meta">Forgot your password? <a href="reset.html">Reset it</a> or <a href="magic-link.html">use a login link</a></p>
    <p class="auth-meta">Need an account? <a href="register.html">Register</a></p>`);

onSubmit(content.querySelector('form'), async ({ email, password }) => {
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw new Error('Unable to sign in. Please check your email and password.');
    location.href = next;
});

// Already signed in: skip the form.
if ((await call(sb.auth.getSession())).session) location.replace(next);
