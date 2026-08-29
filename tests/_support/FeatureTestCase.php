<?php

declare(strict_types=1);

namespace Tests\Support;

use CodeIgniter\Shield\Models\UserModel;
use CodeIgniter\Shield\Test\AuthenticationTesting;
use CodeIgniter\Test\FeatureTestTrait;
use CodeIgniter\Test\TestResponse;

/**
 * Base class for tests that exercise real routes end to end.
 */
abstract class FeatureTestCase extends ModelTestCase
{
    use AuthenticationTesting;
    use FeatureTestTrait;

    protected function setUp(): void
    {
        parent::setUp();

        // actingAs() writes an authenticated session, and PHPUnit keeps
        // $_SESSION alive between tests in the same process. Without this, a
        // test that expects a guest is still signed in as the previous test's
        // user.
        auth()->logout();
    }

    protected function signIn(string $username): static
    {
        return $this->actingAs(model(UserModel::class)->findById($this->userId($username)));
    }

    /**
     * POST a form the way a browser would, including a valid CSRF token.
     *
     * The `csrf` filter is enabled globally, so a POST without this would be
     * rejected before it ever reached the controller — which is exactly what
     * should happen to a forged request.
     *
     * @param array<string, mixed> $data
     */
    protected function submit(string $uri, array $data = []): TestResponse
    {
        $data[csrf_token()] = csrf_hash();

        return $this->post($uri, $data);
    }
}
