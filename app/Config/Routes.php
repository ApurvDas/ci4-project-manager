<?php

use CodeIgniter\Router\RouteCollection;

/** @var RouteCollection $routes */

// Public landing page. Signed-in visitors are sent straight to the dashboard.
$routes->get('/', 'Home::index');

/*
 * Everything below requires an authenticated session. Shield's `session`
 * filter is the server-side gate: hiding navigation is never sufficient on
 * its own. Membership and role checks happen inside the controllers, via
 * App\Libraries\ProjectPolicy.
 */
$routes->group('', ['filter' => 'session'], static function (RouteCollection $routes): void {
    $routes->get('dashboard', 'Dashboard::index');

    $routes->group('notifications', static function (RouteCollection $routes): void {
        $routes->get('/', 'Notifications::index', ['as' => 'notifications.index']);
        $routes->post('read-all', 'Notifications::readAll', ['as' => 'notifications.readAll']);
        $routes->post('(:num)/read', 'Notifications::read/$1', ['as' => 'notifications.read']);
    });

    $routes->group('projects', static function (RouteCollection $routes): void {
        $routes->get('/', 'Projects::index', ['as' => 'projects.index']);
        $routes->get('new', 'Projects::form', ['as' => 'projects.new']);
        $routes->post('/', 'Projects::store', ['as' => 'projects.store']);

        $routes->get('(:num)', 'Projects::show/$1', ['as' => 'projects.show']);
        $routes->get('(:num)/edit', 'Projects::edit/$1', ['as' => 'projects.edit']);
        $routes->post('(:num)', 'Projects::update/$1', ['as' => 'projects.update']);
        $routes->post('(:num)/archive', 'Projects::archive/$1', ['as' => 'projects.archive']);
        $routes->post('(:num)/reopen', 'Projects::reopen/$1', ['as' => 'projects.reopen']);
        $routes->post('(:num)/delete', 'Projects::destroy/$1', ['as' => 'projects.delete']);

        // Members
        $routes->post('(:num)/members', 'ProjectMembers::create/$1', ['as' => 'projects.members.add']);
        $routes->post('(:num)/members/(:num)/role', 'ProjectMembers::updateRole/$1/$2', ['as' => 'projects.members.role']);
        $routes->post('(:num)/members/(:num)/delete', 'ProjectMembers::destroy/$1/$2', ['as' => 'projects.members.remove']);

        // Tags
        $routes->post('(:num)/tags', 'Tags::create/$1', ['as' => 'tags.store']);
        $routes->post('(:num)/tags/(:num)/delete', 'Tags::destroy/$1/$2', ['as' => 'tags.delete']);

        // Kanban board
        $routes->get('(:num)/board', 'Board::show/$1', ['as' => 'board.show']);
        $routes->post('(:num)/board/(:num)/move', 'Board::move/$1/$2', ['as' => 'board.move']);

        // Tasks
        $routes->get('(:num)/tasks', 'Tasks::index/$1', ['as' => 'tasks.index']);
        $routes->get('(:num)/tasks/new', 'Tasks::form/$1', ['as' => 'tasks.new']);
        $routes->post('(:num)/tasks', 'Tasks::store/$1', ['as' => 'tasks.store']);
        $routes->get('(:num)/tasks/(:num)', 'Tasks::show/$1/$2', ['as' => 'tasks.show']);
        $routes->get('(:num)/tasks/(:num)/edit', 'Tasks::edit/$1/$2', ['as' => 'tasks.edit']);
        $routes->post('(:num)/tasks/(:num)', 'Tasks::update/$1/$2', ['as' => 'tasks.update']);
        $routes->post('(:num)/tasks/(:num)/delete', 'Tasks::destroy/$1/$2', ['as' => 'tasks.delete']);

        // Comments
        $routes->post('(:num)/tasks/(:num)/comments', 'TaskComments::create/$1/$2', ['as' => 'comments.store']);
        $routes->post('(:num)/tasks/(:num)/comments/(:num)/delete', 'TaskComments::destroy/$1/$2/$3', ['as' => 'comments.delete']);

        // Checklists
        $routes->post('(:num)/tasks/(:num)/checklists', 'TaskChecklists::create/$1/$2', ['as' => 'checklists.store']);
        $routes->post('(:num)/tasks/(:num)/checklists/(:num)/items', 'TaskChecklists::createItem/$1/$2/$3', ['as' => 'checklists.items.store']);
        $routes->post('(:num)/tasks/(:num)/items/(:num)/toggle', 'TaskChecklists::toggleItem/$1/$2/$3', ['as' => 'checklists.items.toggle']);
    });
});

// Shield's own authentication routes (login, register, logout, magic link).
service('auth')->routes($routes);
