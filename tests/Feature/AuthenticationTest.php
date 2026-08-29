<?php

declare(strict_types=1);

namespace Tests\Feature;

use CodeIgniter\Shield\Models\UserModel;
use Tests\Support\FeatureTestCase;

/**
 * The authentication flow, as a user actually experiences it.
 *
 * Shield owns the mechanics; these tests cover that this application's views
 * and configuration are wired to it correctly, and that the boundaries hold.
 *
 * @internal
 */
final class AuthenticationTest extends FeatureTestCase
{
    public function testLoginPageRenders(): void
    {
        $result = $this->get('login');
        $body   = (string) $result->getBody();

        $result->assertOK();
        $result->assertSee('Welcome back');
        // Checked against the raw HTML: CodeIgniter's DOMParser cannot parse a
        // quoted attribute selector.
        $this->assertStringContainsString('name="email"', $body);
        $this->assertStringContainsString('name="password"', $body);
    }

    public function testRegisterPageRenders(): void
    {
        $result = $this->get('register');
        $body   = (string) $result->getBody();

        $result->assertOK();
        $this->assertStringContainsString('name="username"', $body);
        $this->assertStringContainsString('name="password_confirm"', $body);
    }

    public function testEveryAuthFormCarriesACsrfToken(): void
    {
        foreach (['login', 'register', 'login/magic-link'] as $path) {
            $result = $this->get($path);

            $result->assertOK();
            $this->assertStringContainsString(
                'name="' . csrf_token() . '"',
                (string) $result->getBody(),
                $path . ' must embed a CSRF token',
            );
        }
    }

    public function testCorrectCredentialsSignTheUserIn(): void
    {
        $result = $this->submit('login', [
            'email'    => 'admin@example.test',
            'password' => 'Password123!',
        ]);

        $result->assertRedirect();
        $this->assertTrue(auth()->loggedIn());
        $this->assertSame('admin', auth()->user()->username);
    }

    public function testWrongPasswordIsRefused(): void
    {
        $result = $this->submit('login', [
            'email'    => 'admin@example.test',
            'password' => 'NotTheRightPassword',
        ]);

        $result->assertRedirect();
        $this->assertFalse(auth()->loggedIn());
    }

    public function testUnknownEmailIsRefused(): void
    {
        $result = $this->submit('login', [
            'email'    => 'nobody@example.test',
            'password' => 'Password123!',
        ]);

        $result->assertRedirect();
        $this->assertFalse(auth()->loggedIn());
    }

    public function testAFailedLoginIsRecorded(): void
    {
        $this->submit('login', [
            'email'    => 'admin@example.test',
            'password' => 'NotTheRightPassword',
        ]);

        // Shield keeps an audit trail of attempts; useful for the security
        // review later, so confirm it is actually being written.
        $this->seeInDatabase('auth_logins', [
            'identifier' => 'admin@example.test',
            'success'    => 0,
        ]);
    }

    public function testRegistrationCreatesAHashedPasswordNotAPlainOne(): void
    {
        $this->submit('register', [
            'email'            => 'newcomer@example.test',
            'username'         => 'newcomer',
            'password'         => 'A-Long-Enough-Passphrase-9',
            'password_confirm' => 'A-Long-Enough-Passphrase-9',
        ]);

        $this->seeInDatabase('users', ['username' => 'newcomer']);

        $identity = $this->db->table('auth_identities')
            ->where('secret', 'newcomer@example.test')
            ->get()
            ->getRowArray();

        $this->assertNotNull($identity);
        $this->assertStringStartsWith('$2y$', (string) $identity['secret2']);
        $this->assertStringNotContainsString('A-Long-Enough-Passphrase-9', (string) $identity['secret2']);
    }

    public function testRegistrationRejectsMismatchedPasswords(): void
    {
        $result = $this->submit('register', [
            'email'            => 'mismatch@example.test',
            'username'         => 'mismatch',
            'password'         => 'A-Long-Enough-Passphrase-9',
            'password_confirm' => 'Something-Else-Entirely-7',
        ]);

        $result->assertRedirect();
        $this->dontSeeInDatabase('users', ['username' => 'mismatch']);
    }

    public function testRegistrationRejectsADuplicateEmail(): void
    {
        $before = $this->db->table('users')->countAllResults();

        $this->submit('register', [
            'email'            => 'admin@example.test',
            'username'         => 'impostor',
            'password'         => 'A-Long-Enough-Passphrase-9',
            'password_confirm' => 'A-Long-Enough-Passphrase-9',
        ]);

        $this->assertSame($before, $this->db->table('users')->countAllResults());
    }

    public function testRegistrationRejectsAWeakPassword(): void
    {
        $this->submit('register', [
            'email'            => 'weak@example.test',
            'username'         => 'weakling',
            'password'         => 'password',
            'password_confirm' => 'password',
        ]);

        // Shield's dictionary check should refuse one of the most common
        // passwords in existence.
        $this->dontSeeInDatabase('users', ['username' => 'weakling']);
    }

    public function testSigningOutEndsTheSession(): void
    {
        $this->signIn('admin');
        $this->assertTrue(auth()->loggedIn());

        $this->get('logout');

        $this->assertFalse(auth()->loggedIn());
    }

    public function testEveryProtectedAreaRedirectsAGuestToLogin(): void
    {
        $paths = [
            'dashboard',
            'projects',
            'projects/new',
            'notifications',
            'projects/1',
            'projects/1/board',
            'projects/1/tasks',
            'projects/1/activity',
        ];

        foreach ($paths as $path) {
            $result = $this->get($path);

            $result->assertRedirect();
            $this->assertStringContainsString(
                'login',
                $result->getRedirectUrl(),
                $path . ' should send a guest to the login page',
            );
        }
    }

    public function testSeededAccountsAreActive(): void
    {
        // Email activation is deliberately disabled while mail cannot be sent;
        // if that changes, seeded users must still be able to sign in.
        $user = model(UserModel::class)->findById($this->userId('admin'));

        $this->assertTrue((bool) $user->active);
    }
}
