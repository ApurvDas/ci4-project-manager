import { authPage, render, html, onSubmit, sb, go, showAlert } from '../app.js';

const content = authPage('Register');

render(content, html`
    <div class="auth-header">
        <h1>Register</h1>
        <p>Set up an account to create projects and track work with your team.</p>
    </div>
    <form class="auth-form" data-validated novalidate>
        <div class="field" data-validate="email">
            <label for="email">Email address</label>
            <input type="email" id="email" name="email" inputmode="email" autocomplete="email" autofocus required>
            <p class="field-error" role="alert"></p>
        </div>
        <div class="field" data-validate="username">
            <label for="username">Username</label>
            <input type="text" id="username" name="username" autocomplete="username" maxlength="30" required>
            <p class="hint">Letters, numbers, dots, underscores and hyphens.</p>
            <p class="field-error" role="alert"></p>
        </div>
        <div class="field" data-validate="password">
            <label for="password">Password</label>
            <div class="field-with-toggle">
                <input type="password" id="password" name="password" autocomplete="new-password" required>
                <button type="button" class="password-toggle" data-target="password" aria-pressed="false">Show</button>
            </div>
            <p class="hint">At least 8 characters.</p>
            <p class="field-error" role="alert"></p>
        </div>
        <div class="field" data-validate="passwordConfirm">
            <label for="password_confirm">Password (again)</label>
            <div class="field-with-toggle">
                <input type="password" id="password_confirm" name="password_confirm" autocomplete="new-password" required>
                <button type="button" class="password-toggle" data-target="password_confirm" aria-pressed="false">Show</button>
            </div>
            <p class="field-error" role="alert"></p>
        </div>
        <button type="submit" class="btn btn-primary btn-block" data-busy-label="Creating account…">Register</button>
    </form>
    <p class="auth-meta">Already have an account? <a href="login.html">Sign in</a></p>`);

onSubmit(content.querySelector('form'), async ({ email, username, password }, form) => {
    const { data: taken } = await sb.rpc('username_taken', { p_username: username });
    if (taken) throw new Error('That username is already taken.');

    const { data, error } = await sb.auth.signUp({
        email,
        password,
        options: { data: { username }, emailRedirectTo: new URL('dashboard.html', location.href).href },
    });
    if (error) throw error;

    if (data.session) {
        go('dashboard.html', 'Welcome! Your account is ready.');
    } else {
        // Email confirmation is on: nothing to do until they click the link.
        form.hidden = true;
        showAlert('Check your email for a link to confirm your account.', 'success');
    }
});
