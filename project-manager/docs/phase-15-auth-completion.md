# Phase 15 — Authentication Completion

**Status: deferred. Decisions not yet made.**

Two authentication items were parked during Phase 5 (Authentication UI) because
each needs a decision rather than just implementation work. Both are recorded
here so nothing is lost, and so a second developer can pick them up.

Work through this phase **after** the rest of the application is built.

---

## 15.1 Password reset: keep magic link, or add a classic reset form?

### What exists today

CodeIgniter Shield 1.4.1 ships **no** forgot-password or reset-password screens.
Its `Config\Auth::$views` array has no entry for them. Shield's password
recovery is the **magic link** flow instead:

    User enters email  ->  receives a one-time sign-in link  ->  clicking it signs them in

The user is never asked to choose a new password.

Phase 5 styled Shield's magic-link screens and labelled the entry point
"Can't sign in?" on the login page. Routes:

- `GET  /login/magic-link` — request form (`app/Views/auth/magic_link_form.php`)
- `POST /login/magic-link` — sends the link
- `GET  /login/verify-magic-link` — consumes the link and signs the user in
- Confirmation page: `app/Views/auth/magic_link_message.php`

### The decision

**Option A — keep the magic link as the only recovery path.** No further work
beyond making email deliverable (15.2). This is Shield's intended design.

**Option B — add a classic "enter a new password twice" reset flow**, either
alongside the magic link or replacing it.

### What Option B costs

Shield does not provide this, so it means building a reset token lifecycle:
generating a token, storing it, expiring it, single-use enforcement, and
verifying it before allowing a password change. That is authentication code,
which is the one area the project rules say not to hand-roll:

> §50.4 — Do not replace CodeIgniter Shield with custom authentication.

If Option B is chosen, build it **on top of** Shield rather than beside it:
reuse `auth_identities` for token storage and Shield's `UserModel` for the
password change, so hashing and identity handling stay in Shield's hands. Do
not write a parallel user or session system.

### Related gap

`app/Views/auth/magic_link_form.php` currently tells the user they can "set a
new password from your account settings". That settings page does not exist
yet — it arrives with the Profile/Account settings work in §45. Either build
that page or reword this copy; the sentence is currently a promise the
application cannot keep.

---

## 15.2 Make email actually send, then enable email verification

### What exists today

`app/Config/Email.php` is set to:

```php
public string $protocol = 'mail';   // hands off to PHP's mail() function
public string $SMTPHost = '';       // nothing configured
```

On Windows/Laragon there is no mail transport behind PHP's `mail()`, so **every
email the application sends is silently discarded**.

Consequences right now:

- The magic-link flow renders its "check your email" page, but no email
  arrives — so password recovery does not actually work end to end.
- Email verification at registration is **switched off on purpose**.
  `Config\Auth::$actions` is:

  ```php
  public array $actions = [
      'register' => null,   // EmailActivator deliberately NOT enabled
      'login'    => null,
  ];
  ```

  Enabling `EmailActivator` while email is undeliverable would tell every new
  user to "check your email for a 6-digit code" that never arrives, locking
  them — and the project owner — out of the application permanently.

The activation screen itself is already built and wired:
`app/Views/auth/email_activate_show.php`, registered under the
`action_email_activate_show` key in `Config\Auth::$views`.

### The work

1. **Choose a mail transport.**
   - *Local development:* Mailpit or MailHog. Both run a fake SMTP server that
     captures outgoing mail and shows it in a browser, so nothing reaches real
     inboxes. Laragon can run either.
   - *Production:* a real SMTP service, credentials kept in `.env`, never
     committed.

2. **Configure `app/Config/Email.php`** — set `$protocol = 'smtp'` plus
   `$SMTPHost`, `$SMTPPort`, `$SMTPUser`, `$SMTPPass`. Prefer reading these
   from `.env` rather than hard-coding them.

   Note: `shield:setup` wrote a real personal email address into `$fromEmail`
   in this file, and it is committed. Move it to `.env` before the repository
   is ever made public.

3. **Verify delivery** — trigger a magic link and confirm the mail is captured.

4. **Enable email verification** once delivery is proven:

   ```php
   public array $actions = [
       'register' => \CodeIgniter\Shield\Authentication\Actions\EmailActivator::class,
       'login'    => null,
   ];
   ```

5. **Re-test registration end to end**, and confirm the seeded development
   accounts still sign in. Seeded users are created directly through
   `UserModel` with `active => 1`, so they bypass activation — but check rather
   than assume.

6. **Optionally style the email bodies.** Three entries in
   `Config\Auth::$views` still point at Shield's own templates
   (`action_email_2fa_email`, `action_email_activate_email`,
   `magic-link-email`). They are email bodies rather than pages, so they were
   left alone in Phase 5.

### Sequencing note

This item is a **deployment blocker**, not just a nice-to-have: an application
that cannot send email has no working password recovery. If Phase 14
(Deployment) is reached before this phase, resolve 15.2 as part of it.
