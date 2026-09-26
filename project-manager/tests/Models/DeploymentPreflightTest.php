<?php

declare(strict_types=1);

namespace Tests\Models;

use App\Libraries\DeploymentPreflight;
use Tests\Support\ModelTestCase;

/**
 * The production readiness checks.
 *
 * These run under ENVIRONMENT=testing, which is not production, so several
 * checks are expected to report failure. That is the point: the command
 * describes production, not the machine it runs on.
 *
 * @internal
 */
final class DeploymentPreflightTest extends ModelTestCase
{
    private DeploymentPreflight $preflight;

    protected function setUp(): void
    {
        parent::setUp();

        $this->preflight = new DeploymentPreflight();
    }

    /**
     * @return array<string, array{name: string, status: string, detail: string}>
     */
    private function byName(): array
    {
        $checks = [];

        foreach ($this->preflight->run() as $check) {
            $checks[$check['name']] = $check;
        }

        return $checks;
    }

    public function testEveryCheckIsWellFormed(): void
    {
        foreach ($this->preflight->run() as $check) {
            $this->assertArrayHasKey('name', $check);
            $this->assertArrayHasKey('status', $check);
            $this->assertArrayHasKey('detail', $check);

            $this->assertContains($check['status'], [
                DeploymentPreflight::PASS,
                DeploymentPreflight::WARN,
                DeploymentPreflight::FAIL,
            ]);

            $this->assertNotSame('', $check['detail'], $check['name'] . ' must explain itself');
        }
    }

    public function testItCoversTheAreasThatMatter(): void
    {
        $this->assertSame([
            'Environment',
            'Base URL',
            'HTTPS enforced',
            'Cookie flags',
            'Allowed hostnames',
            'CSRF protection',
            'Database',
            'Email delivery',
            'Secrets',
            'Writable path',
        ], array_keys($this->byName()));
    }

    public function testCsrfIsReportedAsEnabled(): void
    {
        // The filter was switched on during phase 7; this guards against it
        // being quietly removed again.
        $this->assertSame(DeploymentPreflight::PASS, $this->byName()['CSRF protection']['status']);
    }

    public function testTheDatabaseIsReachableAndMigrated(): void
    {
        $this->assertSame(DeploymentPreflight::PASS, $this->byName()['Database']['status']);
    }

    public function testNoCredentialsAreLeftInCommittedConfiguration(): void
    {
        $this->assertSame(DeploymentPreflight::PASS, $this->byName()['Secrets']['status']);
    }

    public function testItReportsANonProductionEnvironmentAsAFailure(): void
    {
        $environment = $this->byName()['Environment'];

        $this->assertSame(DeploymentPreflight::FAIL, $environment['status']);
        $this->assertStringContainsString('production', $environment['detail']);
    }

    public function testUndeliverableMailIsReportedAsAFailure(): void
    {
        // Mail is deliberately unconfigured until phase 15 is decided; the
        // check must keep saying so rather than letting it be forgotten.
        $mail = $this->byName()['Email delivery'];

        $this->assertSame(DeploymentPreflight::FAIL, $mail['status']);
        $this->assertStringContainsString('phase-15', $mail['detail']);
    }

    public function testItRefusesToPassOutsideProduction(): void
    {
        $this->assertFalse($this->preflight->passes());
    }
}
