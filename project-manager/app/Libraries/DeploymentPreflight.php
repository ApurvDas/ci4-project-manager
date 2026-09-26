<?php

declare(strict_types=1);

namespace App\Libraries;

use Config\App;
use Config\Cookie;
use Config\Email;
use Config\Filters;
use Throwable;

/**
 * Production readiness checks.
 *
 * Answers one question: if this code were serving real users right now, what
 * would be wrong? Run it before every deployment.
 *
 * The logic lives here rather than in the spark command so it can be tested
 * without a console. Each check returns pass, warn or fail:
 *
 *   fail  would expose users or data, or would simply not work
 *   warn  works, but is not what you want in production
 *   pass  nothing to do
 *
 * Running this in development will report failures — that is expected and
 * correct. It describes production, not the machine you are sitting at.
 */
class DeploymentPreflight
{
    public const PASS = 'pass';
    public const WARN = 'warn';
    public const FAIL = 'fail';

    /**
     * @return list<array{name: string, status: string, detail: string}>
     */
    public function run(): array
    {
        return [
            $this->environment(),
            $this->baseUrl(),
            $this->httpsEnforced(),
            $this->secureCookies(),
            $this->allowedHostnames(),
            $this->csrfEnabled(),
            $this->database(),
            $this->mail(),
            $this->secretsOutOfSourceControl(),
            $this->writableDirectory(),
        ];
    }

    /**
     * True when nothing is in a failing state.
     */
    public function passes(): bool
    {
        foreach ($this->run() as $check) {
            if ($check['status'] === self::FAIL) {
                return false;
            }
        }

        return true;
    }

    /**
     * @return array{name: string, status: string, detail: string}
     */
    private function environment(): array
    {
        if (ENVIRONMENT === 'production') {
            return $this->result('Environment', self::PASS, 'CI_ENVIRONMENT is production.');
        }

        return $this->result(
            'Environment',
            self::FAIL,
            sprintf(
                'CI_ENVIRONMENT is "%s". In production it must be "production", or debug output '
                . 'and the debug toolbar are exposed to users.',
                ENVIRONMENT,
            ),
        );
    }

    private function baseUrl(): array
    {
        $baseUrl = config(App::class)->baseURL;

        if ($baseUrl === '' ) {
            return $this->result('Base URL', self::FAIL, 'app.baseURL is empty.');
        }

        if (str_contains($baseUrl, 'localhost') || str_contains($baseUrl, '127.0.0.1')) {
            return $this->result(
                'Base URL',
                self::FAIL,
                'app.baseURL still points at localhost (' . $baseUrl . '). Set it to the public URL in .env.',
            );
        }

        if (! str_starts_with($baseUrl, 'https://')) {
            return $this->result(
                'Base URL',
                self::WARN,
                'app.baseURL is not https. Sessions and passwords would travel in clear text.',
            );
        }

        return $this->result('Base URL', self::PASS, $baseUrl);
    }

    private function httpsEnforced(): array
    {
        return config(App::class)->forceGlobalSecureRequests
            ? $this->result('HTTPS enforced', self::PASS, 'Requests are redirected to https.')
            : $this->result(
                'HTTPS enforced',
                self::FAIL,
                'app.forceGlobalSecureRequests is false, so http requests are served as-is.',
            );
    }

    private function secureCookies(): array
    {
        $cookie = config(Cookie::class);
        $issues = [];

        if (! $cookie->secure) {
            $issues[] = 'cookie.secure is false, so the session cookie can travel over http';
        }

        if (! $cookie->httponly) {
            $issues[] = 'cookie.httponly is false, so JavaScript can read the session cookie';
        }

        if (strtolower($cookie->samesite) === 'none') {
            $issues[] = 'cookie.samesite is None, which permits cross-site sending';
        }

        return $issues === []
            ? $this->result('Cookie flags', self::PASS, 'secure, httponly and samesite are set sensibly.')
            : $this->result('Cookie flags', self::FAIL, implode('; ', $issues) . '.');
    }

    private function allowedHostnames(): array
    {
        return config(App::class)->allowedHostnames === []
            ? $this->result(
                'Allowed hostnames',
                self::WARN,
                'app.allowedHostnames is empty. Set it to the site\'s hostname to reject Host header spoofing.',
            )
            : $this->result('Allowed hostnames', self::PASS, implode(', ', config(App::class)->allowedHostnames));
    }

    private function csrfEnabled(): array
    {
        return in_array('csrf', config(Filters::class)->globals['before'] ?? [], true)
            ? $this->result('CSRF protection', self::PASS, 'The csrf filter runs on every request.')
            : $this->result(
                'CSRF protection',
                self::FAIL,
                'The csrf filter is not in Filters::$globals, so form tokens are never verified.',
            );
    }

    private function database(): array
    {
        try {
            $db = db_connect();
            $db->initialize();

            $pending = $this->pendingMigrations();

            if ($pending > 0) {
                return $this->result(
                    'Database',
                    self::FAIL,
                    $pending . ' migration file(s) have not been run. Run: php spark migrate',
                );
            }

            $password = (string) ($db->password ?? '');

            if ($password === '' && ENVIRONMENT === 'production') {
                return $this->result('Database', self::FAIL, 'Connected, but the database user has no password.');
            }

            return $this->result('Database', self::PASS, 'Connected, and all migrations are applied.');
        } catch (Throwable $e) {
            return $this->result('Database', self::FAIL, 'Cannot connect: ' . $e->getMessage());
        }
    }

    private function mail(): array
    {
        $email = config(Email::class);

        if ($email->protocol !== 'smtp' || $email->SMTPHost === '') {
            return $this->result(
                'Email delivery',
                self::FAIL,
                'Mail is not deliverable (protocol "' . $email->protocol . '"). Password recovery and '
                . 'email verification cannot work. See docs/phase-15-auth-completion.md.',
            );
        }

        if (str_contains($email->fromEmail, 'example.test')) {
            return $this->result('Email delivery', self::WARN, 'SMTP is set, but fromEmail is still a placeholder.');
        }

        return $this->result('Email delivery', self::PASS, 'SMTP configured as ' . $email->SMTPHost . '.');
    }

    private function secretsOutOfSourceControl(): array
    {
        $tracked = [];

        foreach (['app/Config/Email.php', 'app/Config/Database.php'] as $file) {
            $contents = @file_get_contents(ROOTPATH . $file);

            if ($contents === false) {
                continue;
            }

            // A committed config holding a real password or a non-placeholder
            // address is a leak waiting to happen.
            if (preg_match('/SMTPPass\s*=\s*\'[^\']+\'/', $contents) === 1) {
                $tracked[] = $file . ' contains an SMTP password';
            }
        }

        if (! is_file(ROOTPATH . '.env')) {
            $tracked[] = 'there is no .env file, so settings are coming from committed defaults';
        }

        return $tracked === []
            ? $this->result('Secrets', self::PASS, 'No credentials found in committed configuration.')
            : $this->result('Secrets', self::FAIL, implode('; ', $tracked) . '.');
    }

    private function writableDirectory(): array
    {
        return is_writable(WRITEPATH)
            ? $this->result('Writable path', self::PASS, WRITEPATH . ' is writable.')
            : $this->result('Writable path', self::FAIL, WRITEPATH . ' is not writable by the web server.');
    }

    /**
     * How many migration files have not been applied.
     */
    private function pendingMigrations(): int
    {
        $files = glob(APPPATH . 'Database/Migrations/*.php') ?: [];

        try {
            $applied = db_connect()->table('migrations')->countAllResults();
        } catch (Throwable) {
            return count($files);
        }

        // Shield and Settings contribute migrations too, so only a shortfall
        // against this application's own files is meaningful.
        return max(0, count($files) - $applied);
    }

    /**
     * @return array{name: string, status: string, detail: string}
     */
    private function result(string $name, string $status, string $detail): array
    {
        return ['name' => $name, 'status' => $status, 'detail' => $detail];
    }
}
