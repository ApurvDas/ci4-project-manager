# Deployment

How to put this application on a production server, and what must be true
before you do.

**Nothing here has been executed against a real server.** It was written from
the actual state of this codebase, and the readiness checks it refers to are
automated and tested — but the first real deployment will still surface things
specific to your host.

---

## Before anything else

Run the readiness check:

```bash
php spark app:preflight
```

It reports what would be wrong if the code were serving real users right now,
and exits non-zero when anything fails, so it can gate a deploy script. On a
development machine it will report several failures — that is correct. It
describes production, not the machine you are sitting at.

The two failures that are not yet fixable are covered in
[phase-15-auth-completion.md](phase-15-auth-completion.md): email delivery is
undecided, and until it is configured, **password recovery does not work**.
Treat that as a release blocker rather than a detail.

---

## 1. Server requirements

- PHP 8.3 with `intl`, `mbstring`, `mysqli`, `json`, `curl`
- MySQL 8.x
- Apache with `mod_rewrite`, or nginx with an equivalent rewrite
- Composer (to install, not to run)

## 2. Document root

The web server must serve **`public/`**, never the project root. Everything
else — `app/`, `writable/`, `vendor/`, `.env` — must sit outside the document
root or be unreachable over HTTP.

Getting this wrong exposes `.env`, and with it your database password.

Apache virtual host:

```apache
DocumentRoot /var/www/project-manager/public

<Directory /var/www/project-manager/public>
    AllowOverride All
    Require all granted
</Directory>
```

`public/.htaccess` ships with the framework and does the rewriting. On nginx,
route everything to `index.php` instead:

```nginx
root /var/www/project-manager/public;

location / {
    try_files $uri $uri/ /index.php$is_args$args;
}
```

## 3. Install

```bash
composer install --no-dev --optimize-autoloader
```

`--no-dev` leaves out PHPUnit and the other development packages.
`--optimize-autoloader` builds a classmap so classes are not searched for on
every request.

## 4. Configure

Copy `env` to `.env` and fill in the production block at the bottom of the
file. At minimum:

```ini
CI_ENVIRONMENT = production
app.baseURL = 'https://your-domain.example/'
app.forceGlobalSecureRequests = true
app.allowedHostnames = ['your-domain.example']
cookie.secure = true

database.default.hostname = 127.0.0.1
database.default.database = project_manager
database.default.username = project_manager_app
database.default.password = 'a-real-password'
database.default.DBDriver = MySQLi
```

Notes on each:

- **`CI_ENVIRONMENT = production`** turns off the debug toolbar and detailed
  error pages. Without it, a stack trace containing file paths and SQL is shown
  to whoever triggers an error.
- **`forceGlobalSecureRequests`** redirects http to https. Pointless without a
  certificate, essential with one.
- **`allowedHostnames`** rejects requests carrying a spoofed `Host` header,
  which would otherwise let an attacker generate links to their own domain.
- **`cookie.secure`** stops the session cookie being sent over plain http.
- **The database user must not be `root`.** Create a dedicated user with
  `SELECT, INSERT, UPDATE, DELETE` on this database only:

```sql
CREATE USER 'project_manager_app'@'localhost' IDENTIFIED BY 'a-real-password';
GRANT SELECT, INSERT, UPDATE, DELETE ON project_manager.* TO 'project_manager_app'@'localhost';
FLUSH PRIVILEGES;
```

Migrations need `CREATE, ALTER, DROP, REFERENCES` as well. Either grant them
temporarily while migrating, or run migrations as an administrative user.

## 5. Permissions

```bash
chmod -R 775 writable
chown -R www-data:www-data writable
```

`writable/` holds sessions, logs and caches. It is the only directory the web
server needs to write to.

## 6. Migrate

```bash
php spark migrate
```

Do **not** run `php spark db:seed DevelopmentSeeder` on production. It
truncates every application table and creates accounts with a published
password. It refuses to run when `CI_ENVIRONMENT` is production, but do not
rely on that alone.

Create the first real account through the registration form, then promote it
in the database if it needs to be an administrator.

## 7. Verify

```bash
php spark app:preflight
```

Everything should pass except what you have knowingly deferred. Then check by
hand:

- Sign in and sign out.
- Open a project as a member, and confirm a non-member gets "not found".
- Confirm the debug toolbar is **not** present at the bottom of the page.
- Request a URL that does not exist and confirm the styled 404 appears, not a
  stack trace.

## 8. Backups

The database holds everything that matters; the code is in git.

```bash
mysqldump --single-transaction --routines \
  -u backup_user -p project_manager \
  | gzip > "project_manager-$(date +%F).sql.gz"
```

`--single-transaction` takes a consistent snapshot without locking the tables.

A backup that has never been restored is not a backup. Restore one into a
scratch database and check the row counts:

```bash
gunzip < project_manager-YYYY-MM-DD.sql.gz | mysql -u root -p project_manager_restore_test
```

## 9. Deploying an update

```bash
git pull
composer install --no-dev --optimize-autoloader
php spark migrate
php spark app:preflight
```

Assets carry a `?v=` version derived from the file's modification time, so a
changed stylesheet reaches browsers immediately without a manual cache purge.

---

## Known gaps

| Gap | Impact | Where |
|---|---|---|
| Email is not configured | No password recovery, no email verification | [phase-15](phase-15-auth-completion.md) |
| Password reset style undecided | Recovery is magic-link only | [phase-15](phase-15-auth-completion.md) |
| No CSP | Weaker defence-in-depth against XSS | `app/Config/App.php`, `$CSPEnabled` |
| No rate limiting on login | Brute force is only slowed by bcrypt | Shield ships a throttler that can be enabled |

The CSP one needs care rather than a flag flip: the board and progress bars use
inline `style` attributes, which a strict policy would block.

A previous commit contained a real personal email address in
`app/Config/Email.php`. It has been moved to `.env`, but **it remains in git
history**. If this repository is ever made public, either rewrite that history
or accept that the address is in it.
