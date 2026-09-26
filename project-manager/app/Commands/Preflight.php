<?php

declare(strict_types=1);

namespace App\Commands;

use App\Libraries\DeploymentPreflight;
use CodeIgniter\CLI\BaseCommand;
use CodeIgniter\CLI\CLI;

/**
 * php spark app:preflight
 *
 * Reports what would be wrong if this code were serving real users right now.
 * Exits non-zero when anything fails, so it can gate a deployment script.
 */
class Preflight extends BaseCommand
{
    protected $group       = 'Deployment';
    protected $name        = 'app:preflight';
    protected $description = 'Check production readiness before deploying.';
    protected $usage       = 'app:preflight';

    public function run(array $params)
    {
        $checks = (new DeploymentPreflight())->run();

        CLI::write('Production readiness', 'white');
        CLI::write('Current environment: ' . ENVIRONMENT, 'dark_gray');
        CLI::newLine();

        $failed = 0;
        $warned = 0;

        foreach ($checks as $check) {
            [$label, $colour] = match ($check['status']) {
                DeploymentPreflight::PASS => ['PASS', 'green'],
                DeploymentPreflight::WARN => ['WARN', 'yellow'],
                default                   => ['FAIL', 'red'],
            };

            if ($check['status'] === DeploymentPreflight::FAIL) {
                $failed++;
            } elseif ($check['status'] === DeploymentPreflight::WARN) {
                $warned++;
            }

            CLI::write(CLI::color('  [' . $label . '] ', $colour) . $check['name']);
            CLI::write('         ' . $check['detail'], 'dark_gray');
        }

        CLI::newLine();

        if ($failed > 0) {
            CLI::write(
                sprintf('%d check(s) failed, %d warning(s). Not ready to deploy.', $failed, $warned),
                'red',
            );

            // Non-zero so a deploy script stops here.
            return EXIT_ERROR;
        }

        CLI::write(
            $warned > 0
                ? sprintf('No failures, %d warning(s). Review them before deploying.', $warned)
                : 'All checks passed.',
            $warned > 0 ? 'yellow' : 'green',
        );

        return EXIT_SUCCESS;
    }
}
