<?php

declare(strict_types=1);

namespace Tests\Feature;

use CodeIgniter\Events\Events;
use Tests\Support\FeatureTestCase;

/**
 * Guards the project page against the N+1 that the role cache fixed.
 *
 * The page asks the policy the same questions over and over — once per member
 * row and once per tag, each needing both the actor's role and the target's.
 * Before ProjectPolicy cached roleFor(), rendering this page issued more than
 * thirty near-identical membership queries.
 *
 * A count assertion is blunt, but it is the only kind that fails when someone
 * reintroduces a query inside a loop.
 *
 * @internal
 */
final class ProjectPageQueryCountTest extends FeatureTestCase
{
    /**
     * Count queries by listening to the DBQuery event, which the framework
     * fires for every executed query — the same source the debug toolbar's
     * database tab counts.
     */
    private function countQueries(callable $work): int
    {
        $count = 0;

        Events::on('DBQuery', static function () use (&$count): void {
            $count++;
        });

        $work();

        // Events persist for the process, so clear the listener afterwards or
        // later tests keep incrementing this closure's counter.
        Events::removeAllListeners('DBQuery');

        return $count;
    }

    public function testTheProjectPageDoesNotQueryPerMemberAndPerTag(): void
    {
        // Website Redesign has five members and four tags. Uncached, the policy
        // alone cost roughly five queries per member plus one per tag.
        $projectId = $this->projectId('Website Redesign');

        $count = $this->countQueries(function () use ($projectId): void {
            $this->signIn('admin')->get('projects/' . $projectId);
        });

        $this->assertLessThan(
            25,
            $count,
            'The project page issued ' . $count . ' queries. That suggests a policy check '
            . 'or a lookup has been put back inside a loop.',
        );
    }

    public function testTheRoleCacheCollapsesRepeatedChecks(): void
    {
        $policy    = new \App\Libraries\ProjectPolicy();
        $projectId = $this->projectId('Website Redesign');
        $userId    = $this->userId('admin');

        $count = $this->countQueries(static function () use ($policy, $projectId, $userId): void {
            // Ten rounds of four checks, all about the same membership.
            for ($i = 0; $i < 10; $i++) {
                $policy->canView($projectId, $userId);
                $policy->canContribute($projectId, $userId);
                $policy->canManage($projectId, $userId);
                $policy->canAdminister($projectId, $userId);
            }
        });

        $this->assertSame(1, $count, 'Forty checks about one membership should cost exactly one query.');
    }

    public function testFlushForcesAFreshLookup(): void
    {
        $policy    = new \App\Libraries\ProjectPolicy();
        $projectId = $this->projectId('Website Redesign');
        $userId    = $this->userId('designer');

        $this->assertSame('member', $policy->roleFor($projectId, $userId));

        $this->db->table('project_members')
            ->where('project_id', $projectId)
            ->where('user_id', $userId)
            ->update(['role' => 'viewer']);

        // Still the cached answer, which is what makes flush() necessary.
        $this->assertSame('member', $policy->roleFor($projectId, $userId));

        $policy->flush();

        $this->assertSame('viewer', $policy->roleFor($projectId, $userId));
    }
}
