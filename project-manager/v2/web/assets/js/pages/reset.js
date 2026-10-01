// Classic password reset (Phase 15 option B): request a link by email, then
// the link lands back here signed in, and the new password is entered twice.
import { authPage, render, html, onSubmit, sb, go, showAlert, siteUrl } from '../app.js';

const content = authPage('Reset password');

function requestForm() {
    render(content, html`
        <div class="auth-header">
            <h1>Reset your password</h1>
            <p>We will email you a link to choose a new one.</p>
        </div>
        <form class="auth-form" data-validated novalidate>
            <div class="field" data-validate="email">
                <label for="email">Email address</label>
                <input type="email" id="email" name="email" inputmode="email" autocomplete="email" autofocus required>
                <p class="field-error" role="alert"></p>
            </div>
            <button type="submit" class="btn btn-primary btn-block" data-busy-label="Sending…">Send reset link</button>
        </form>
        <p class="auth-meta"><a href="login.html">Back to sign in</a></p>`);

    onSubmit(content.querySelector('form'), async ({ email }, form) => {
        const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: siteUrl('reset.html') });
        if (error && error.status >= 500) throw error;
        form.hidden = true;
        showAlert('If that address has an account, a reset link is on its way.', 'success');
    });
}

function newPasswordForm() {
    render(content, html`
        <div class="auth-header">
            <h1>Choose a new password</h1>
        </div>
        <form class="auth-form" data-validated novalidate>
            <div class="field" data-validate="password">
                <label for="password">New password</label>
                <div class="field-with-toggle">
                    <input type="password" id="password" name="password" autocomplete="new-password" autofocus required>
                    <button type="button" class="password-toggle" data-target="password" aria-pressed="false">Show</button>
                </div>
                <p class="hint">At least 8 characters.</p>
                <p class="field-error" role="alert"></p>
            </div>
            <div class="field" data-validate="passwordConfirm">
                <label for="password_confirm">New password (again)</label>
                <div class="field-with-toggle">
                    <input type="password" id="password_confirm" name="password_confirm" autocomplete="new-password" required>
                    <button type="button" class="password-toggle" data-target="password_confirm" aria-pressed="false">Show</button>
                </div>
                <p class="field-error" role="alert"></p>
            </div>
            <button type="submit" class="btn btn-primary btn-block" data-busy-label="Saving…">Save password</button>
        </form>`);

    onSubmit(content.querySelector('form'), async ({ password }) => {
        const { error } = await sb.auth.updateUser({ password });
        if (error) throw error;
        go('dashboard.html', 'Your password has been changed.');
    });
}

// The emailed link arrives with a recovery token; getSession() waits for
// supabase-js to exchange it for a session.
if (location.hash.includes('type=recovery')) {
    const { data: { session } } = await sb.auth.getSession();
    if (session) {
        newPasswordForm();
    } else {
        requestForm();
        showAlert('That reset link has expired or was already used. Request a new one.');
    }
} else {
    requestForm();
}
