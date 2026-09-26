<?php

declare(strict_types=1);

namespace Tests\Feature;

use CodeIgniter\Exceptions\PageNotFoundException;
use CodeIgniter\Security\Exceptions\SecurityException;
use Tests\Support\FeatureTestCase;

/**
 * Project CRUD, and the authorisation around it.
 *
 * Website Redesign roles: admin owns it, manager manages it, designer and
 * developer are members, tester is a viewer. designer is NOT in Mobile
 * Application, which makes them a useful stand-in for an outsider.
 *
 * @internal
 */
final class ProjectsTest extends FeatureTestCase
{
    public function testGuestCannotReachTheProjectList(): void
    {
        $result = $this->get('projects');

        $result->assertRedirect();
        $this->assertStringContainsString('login', $result->getRedirectUrl());
    }

    public function testListShowsOnlyTheUsersOwnProjects(): void
    {
        $result = $this->signIn('designer')->get('projects');

        $result->assertOK();
        $result->assertSee('Website Redesign');
        $result->assertSee('Marketing Campaign');
        $result->assertDontSee('Mobile Application');
        $result->assertDontSee('Internal Wiki');
    }

    public function testMemberCanOpenTheProjectDashboard(): void
    {
        $result = $this->signIn('tester')->get('projects/' . $this->projectId('Website Redesign'));

        $result->assertOK();
        $result->assertSee('Website Redesign');
        $result->assertSee('Recent activity');
    }

    public function testNonMemberGetsANotFoundRatherThanARefusal(): void
    {
        // A refusal would confirm the project exists; not-found gives nothing away.
        $this->expectException(PageNotFoundException::class);

        $this->signIn('designer')->get('projects/' . $this->projectId('Mobile Application'));
    }

    public function testOpeningAProjectThatDoesNotExistIs404(): void
    {
        $this->expectException(PageNotFoundException::class);

        $this->signIn('admin')->get('projects/999999');
    }

    public function testCreatingAProjectEnrolsTheCreatorAsOwner(): void
    {
        $result = $this->signIn('developer')->submit('projects', [
            'name'     => 'Data Warehouse',
            'status'   => 'planning',
            'priority' => 'high',
        ]);

        $result->assertRedirect();

        $this->seeInDatabase('projects', ['name' => 'Data Warehouse']);

        $projectId = $this->projectId('Data Warehouse');

        $this->seeInDatabase('project_members', [
            'project_id' => $projectId,
            'user_id'    => $this->userId('developer'),
            'role'       => 'owner',
        ]);
    }

    public function testCreatingAProjectRecordsActivity(): void
    {
        $this->signIn('developer')->submit('projects', [
            'name'     => 'Data Warehouse',
            'status'   => 'planning',
            'priority' => 'high',
        ]);

        $this->seeInDatabase('activity_logs', [
            'project_id'  => $this->projectId('Data Warehouse'),
            'entity_type' => 'project',
            'action'      => 'create',
            'user_id'     => $this->userId('developer'),
        ]);
    }

    public function testInvalidProjectIsRejectedAndNothingIsWritten(): void
    {
        $before = $this->db->table('projects')->countAllResults();

        $result = $this->signIn('developer')->submit('projects', [
            'name'     => 'ab',
            'status'   => 'planning',
            'priority' => 'high',
        ]);

        $result->assertRedirect();
        $this->assertSame($before, $this->db->table('projects')->countAllResults());
    }

    public function testAnInvalidProjectDoesNotLeaveAStrayMembershipBehind(): void
    {
        $before = $this->db->table('project_members')->countAllResults();

        $this->signIn('developer')->submit('projects', [
            'name'     => '',
            'status'   => 'planning',
            'priority' => 'high',
        ]);

        // The insert and the membership share a transaction.
        $this->assertSame($before, $this->db->table('project_members')->countAllResults());
    }

    public function testManagerCanOpenTheEditForm(): void
    {
        $result = $this->signIn('manager')->get('projects/' . $this->projectId('Website Redesign') . '/edit');

        $result->assertOK();
        $result->assertSee('Edit project');
    }

    public function testPlainMemberCannotOpenTheEditForm(): void
    {
        $result = $this->signIn('designer')->get('projects/' . $this->projectId('Website Redesign') . '/edit');

        $result->assertRedirect();
    }

    public function testViewerCannotUpdateTheProject(): void
    {
        $projectId = $this->projectId('Website Redesign');

        $result = $this->signIn('tester')->submit('projects/' . $projectId, [
            'name'     => 'Renamed By A Viewer',
            'status'   => 'active',
            'priority' => 'low',
        ]);

        $result->assertRedirect();
        $this->dontSeeInDatabase('projects', ['name' => 'Renamed By A Viewer']);
    }

    public function testManagerCanUpdateTheProject(): void
    {
        $projectId = $this->projectId('Website Redesign');

        $this->signIn('manager')->submit('projects/' . $projectId, [
            'name'     => 'Website Redesign 2.0',
            'status'   => 'active',
            'priority' => 'critical',
        ]);

        $this->seeInDatabase('projects', ['id' => $projectId, 'name' => 'Website Redesign 2.0']);
    }

    public function testUpdatingRecordsTheChangedFieldsOnly(): void
    {
        $projectId = $this->projectId('Website Redesign');

        // Resubmit every stored value untouched apart from the priority, the
        // way the edit form does.
        $current = $this->db->table('projects')->where('id', $projectId)->get()->getRowArray();

        $this->signIn('manager')->submit('projects/' . $projectId, [
            'name'        => $current['name'],
            'description' => $current['description'],
            'status'      => $current['status'],
            'start_date'  => $current['start_date'],
            'due_date'    => $current['due_date'],
            'priority'    => 'critical',   // the only real change
        ]);

        $entry = $this->db->table('activity_logs')
            ->where('project_id', $projectId)
            ->where('action', 'update')
            ->orderBy('id', 'DESC')
            ->get()
            ->getRowArray();

        $this->assertSame(['priority' => 'critical'], json_decode((string) $entry['new_values'], true));
        $this->assertSame(['priority' => 'high'], json_decode((string) $entry['old_values'], true));
    }

    public function testNonMemberCannotUpdateAProject(): void
    {
        $projectId = $this->projectId('Mobile Application');

        try {
            $this->signIn('designer')->submit('projects/' . $projectId, [
                'name'     => 'Hijacked',
                'status'   => 'active',
                'priority' => 'low',
            ]);

            $this->fail('A non-member must not be able to update a project.');
        } catch (PageNotFoundException) {
            // Expected: the project is invisible to them.
        }

        $this->dontSeeInDatabase('projects', ['name' => 'Hijacked']);
    }

    public function testManagerCannotArchiveTheProject(): void
    {
        $projectId = $this->projectId('Website Redesign');

        $result = $this->signIn('manager')->submit('projects/' . $projectId . '/archive');

        $result->assertRedirect();
        $this->seeInDatabase('projects', ['id' => $projectId, 'status' => 'active']);
    }

    public function testOwnerCanArchiveAndReopenTheProject(): void
    {
        $projectId = $this->projectId('Website Redesign');

        $this->signIn('admin')->submit('projects/' . $projectId . '/archive');
        $this->seeInDatabase('projects', ['id' => $projectId, 'status' => 'archived']);

        $this->signIn('admin')->submit('projects/' . $projectId . '/reopen');
        $this->seeInDatabase('projects', ['id' => $projectId, 'status' => 'active']);
    }

    public function testManagerCannotDeleteTheProject(): void
    {
        $projectId = $this->projectId('Website Redesign');

        $this->signIn('manager')->submit('projects/' . $projectId . '/delete');

        $this->seeInDatabase('projects', ['id' => $projectId, 'deleted_at' => null]);
    }

    public function testOwnerCanSoftDeleteTheProject(): void
    {
        $projectId = $this->projectId('Website Redesign');

        $result = $this->signIn('admin')->submit('projects/' . $projectId . '/delete');

        $result->assertRedirect();
        // Soft delete: the row survives, flagged.
        $this->seeInDatabase('projects', ['id' => $projectId]);
        $this->dontSeeInDatabase('projects', ['id' => $projectId, 'deleted_at' => null]);
    }

    public function testPostWithoutACsrfTokenIsRejected(): void
    {
        $this->signIn('admin');

        try {
            // Deliberately bypasses submit(), so no CSRF token is sent.
            $this->post('projects', [
                'name'     => 'Forged Project',
                'status'   => 'planning',
                'priority' => 'low',
            ]);

            $this->fail('A POST without a CSRF token must be rejected.');
        } catch (SecurityException) {
            // Expected: the csrf filter refused it before the controller ran.
        }

        $this->dontSeeInDatabase('projects', ['name' => 'Forged Project']);
    }
}
