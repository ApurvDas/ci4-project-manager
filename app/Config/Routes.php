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

        $routes->post('(:num)/members', 'ProjectMembers::create/$1', ['as' => 'projects.members.add']);
        $routes->post('(:num)/members/(:num)/role', 'ProjectMembers::updateRole/$1/$2', ['as' => 'projects.members.role']);
        $routes->post('(:num)/members/(:num)/delete', 'ProjectMembers::destroy/$1/$2', ['as' => 'projects.members.remove']);
    });
});

// Shield's own authentication routes (login, register, logout, magic link).
service('auth')->routes($routes);
