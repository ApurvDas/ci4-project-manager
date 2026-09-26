<?php

declare(strict_types=1);

namespace Tests\Feature;

use Tests\Support\FeatureTestCase;

/**
 * @internal
 */
final class DashboardTest extends FeatureTestCase
{
    public function testGuestIsSentToTheLoginPage(): void
    {
        $result = $this->get('dashboard');

        $result->assertRedirect();
        $this->assertStringContainsString('login', $result->getRedirectUrl());
    }

    public function testSignedInUserReachesTheDashboard(): void
    {
        $result = $this->signIn('tester')->get('dashboard');

        $result->assertOK();
        $result->assertSee('Dashboard');
        $result->assertSee('Your open tasks');
    }

    public function testDashboardShowsOnlyProjectsTheUserBelongsTo(): void
    {
        // tester is a member of Website Redesign and Mobile Application only.
        $result = $this->signIn('tester')->get('dashboard');

        $result->assertSee('Website Redesign');
        $result->assertSee('Mobile Application');
        $result->assertDontSee('Marketing Campaign');
        $result->assertDontSee('Internal Wiki');
    }

    public function testDashboardShowsOnlyTasksAssignedToTheUser(): void
    {
        $result = $this->signIn('tester')->get('dashboard');

        // Assigned and still open.
        $result->assertSee('Accessibility audit');
        $result->assertSee('Migrate legacy content');
        // Assigned to designer, in a project tester cannot see.
        $result->assertDontSee('Draft launch blog post');
        // In tester's project, but assigned to someone else.
        $result->assertDontSee('Create API');
    }

    public function testCompletedTasksAreNotListedAsOpenWork(): void
    {
        // developer's two wiki tasks are completed, so they must not appear in
        // the open-work list even though they are assigned.
        $result = $this->signIn('developer')->get('dashboard');

        $result->assertSee('Build authentication');
        $result->assertDontSee('Migrate runbooks');
        $result->assertDontSee('Write contribution guide');
    }

    public function testStatisticTilesAreLabelled(): void
    {
        $result = $this->signIn('admin')->get('dashboard');

        $result->assertSee('Total projects');
        $result->assertSee('Active projects');
        $result->assertSee('Completed projects');
        $result->assertSee('Overdue tasks');
        $result->assertSee('Due today');
        $result->assertSee('Unread notifications');
        $result->assertSee('Tasks assigned to you');
    }

    public function testDifferentUsersSeeDifferentProjects(): void
    {
        // admin owns Website Redesign and Internal Wiki, and is not a member of
        // the two projects manager owns alone.
        $result = $this->signIn('admin')->get('dashboard');

        $result->assertSee('Internal Wiki');
        $result->assertDontSee('Marketing Campaign');
    }

    public function testSignedInUserIsRedirectedFromTheLandingPage(): void
    {
        $result = $this->signIn('admin')->get('/');

        $result->assertRedirect();
        $this->assertStringContainsString('dashboard', $result->getRedirectUrl());
    }

    public function testGuestSeesTheLandingPage(): void
    {
        $result = $this->get('/');

        $result->assertOK();
        $result->assertSee('Plan the work, then track it');
    }
}
