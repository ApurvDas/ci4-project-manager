import { authPage, render, html, onSubmit, sb, showAlert } from '../app.js';

const content = authPage('Login link');

render(content, html`
    <div class="auth-header">
        <h1>Use a login link</h1>
        <p>We will email you a one-time link that signs you in.</p>
    </div>
    <form class="auth-form" data-validated novalidate>
        <div class="field" data-validate="email">
            <label for="email">Email address</label>
            <input type="email" id="email" name="email" inputmode="email" autocomplete="email" autofocus required>
            <p class="field-error" role="alert"></p>
        </div>
        <button type="submit" class="btn btn-primary btn-block" data-busy-label="Sending…">Send link</button>
    </form>
    <p class="auth-meta"><a href="login.html">Back to sign in</a></p>`);

onSubmit(content.querySelector('form'), async ({ email }, form) => {
    const { error } = await sb.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false, emailRedirectTo: new URL('dashboard.html', location.href).href },
    });
    // Same answer whether or not the address has an account, so it can't be probed.
    if (error && error.status !== 400 && error.status !== 422) throw error;
    form.hidden = true;
    showAlert('If that address has an account, a login link is on its way.', 'success');
});
