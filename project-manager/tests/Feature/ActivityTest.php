<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\ActivityLogModel;
use CodeIgniter\Exceptions\PageNotFoundException;
use Tests\Support\FeatureTestCase;

/**
 * The project history page.
 *
 * Website Redesign is seeded with six entries: two project changes, one member
 * addition and three task changes.
 *
 * @internal
 */
final class ActivityTest extends FeatureTestCase
{
    private function websiteId(): int
    {
        return $this->projectId('Website Redesign');
    }

    public function testMemberCanReadTheHistory(): void
    {
        $result = $this->signIn('tester')->get('projects/' . $this->websiteId() . '/activity');

        $result->assertOK();
        $result->assertSee('Activity');
        $result->assertSee('created the project Website Redesign');
        $result->assertSee('moved Build authentication from todo to in_progress');
    }

    public function testEvenAViewerCanReadTheHistory(): void
    {
        // Seeing what happened is part of viewing the project.
        $result = $this->signIn('tester')->get('projects/' . $this->websiteId() . '/activity');

        $result->assertOK();
    }

    public function testNonMemberCannotReadTheHistory(): void
    {
        $this->expectException(PageNotFoundException::class);

        $this->signIn('designer')->get('projects/' . $this->projectId('Mobile Application') . '/activity');
    }

    public function testFilteringByEntityType(): void
    {
        $result = $this->signIn('admin')->get('projects/' . $this->websiteId() . '/activity?entity_type=member');

        $result->assertOK();
        $result->assertSee('added developer to the project');
        // A project entry must drop out.
        $result->assertDontSee('created the project Website Redesign');
    }

    public function testFilteringByAction(): void
    {
        $result = $this->signIn('admin')->get('projects/' . $this->websiteId() . '/activity?action=complete');

        $result->assertOK();
        $result->assertSee('completed Design homepage');
        $result->assertDontSee('created the project Website Redesign');
    }

    public function testFilteringByPerson(): void
    {
        $developerId = $this->userId('developer');

        $result = $this->signIn('admin')->get(
            'projects/' . $this->websiteId() . '/activity?user_id=' . $developerId,
        );

        $result->assertOK();
        $result->assertSee('moved Build authentication from todo to in_progress');
        // admin's entries must drop out.
        $result->assertDontSee('created the project Website Redesign');
    }

    public function testFiltersCombine(): void
    {
        $result = $this->signIn('admin')->get(
            'projects/' . $this->websiteId() . '/activity?entity_type=task&action=create',
        );

        $result->assertOK();
        $result->assertSee('created the task Build authentication');
        $result->assertDontSee('created the project Website Redesign');
    }

    public function testAnEmptyFilterResultExplainsItself(): void
    {
        $result = $this->signIn('admin')->get(
            'projects/' . $this->websiteId() . '/activity?entity_type=member&action=complete',
        );

        $result->assertOK();
        $result->assertSee('Nothing matches those filters');
    }

    public function testFilterMenusOnlyOfferValuesThatExist(): void
    {
        $options = model(ActivityLogModel::class)->filterOptionsFor($this->websiteId());

        $this->assertSame(['member', 'project', 'task'], $options['entity_types']);
        $this->assertContains('complete', $options['actions']);
        // Nothing in this project has been deleted, so it is not offered.
        $this->assertNotContains('delete', $options['actions']);
    }

    public function testTheHistoryIsPaginated(): void
    {
        $projectId = $this->websiteId();
        $activity  = model(ActivityLogModel::class);

        // Push it past a single page of 20.
        for ($i = 0; $i < 25; $i++) {
            $activity->record(
                entityType: 'task',
                action: 'update',
                entityId: $this->taskId('Create API'),
                userId: $this->userId('admin'),
                projectId: $projectId,
                description: 'made change number ' . $i,
            );
        }

        // Paged directly rather than through a request: CodeIgniter's Pager
        // reads the page number from the $_GET superglobal, which the feature
        // test harness never populates. This exercises the query itself.
        $page1 = array_column($activity->scopeForProject($projectId)->paginate(20, 'default', 1), 'description');
        $page2 = array_column($activity->scopeForProject($projectId)->paginate(20, 'default', 2), 'description');

        $this->assertCount(20, $page1);
        // 6 seeded entries plus 25 new ones leaves 11 on the second page.
        $this->assertCount(11, $page2);

        // Newest first, so the oldest seeded entry is last.
        $this->assertContains('made change number 24', $page1);
        $this->assertContains('created the project Website Redesign', $page2);
        $this->assertNotContains('made change number 24', $page2);
    }

    public function testThePagerIsRenderedOnlyWhenThereIsMoreThanOnePage(): void
    {
        $projectId = $this->websiteId();

        // Six seeded entries fit on one page, so no pager should appear.
        $result = $this->signIn('admin')->get("projects/{$projectId}/activity");
        $result->assertOK();
        $result->assertDontSee('pagination');

        $activity = model(ActivityLogModel::class);

        for ($i = 0; $i < 25; $i++) {
            $activity->record(
                entityType: 'task',
                action: 'update',
                entityId: $this->taskId('Create API'),
                userId: $this->userId('admin'),
                projectId: $projectId,
                description: 'extra change ' . $i,
            );
        }

        $result = $this->signIn('admin')->get("projects/{$projectId}/activity");
        $result->assertOK();
        $result->assertSee('pagination');
    }

    public function testTaskHistoryIsShownOnTheTaskItself(): void
    {
        $result = $this->signIn('admin')->get(
            'projects/' . $this->websiteId() . '/tasks/' . $this->taskId('Build authentication'),
        );

        $result->assertOK();
        $result->assertSee('History');
        $result->assertSee('created the task Build authentication');
    }
}
