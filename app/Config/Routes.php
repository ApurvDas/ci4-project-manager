<?php

use CodeIgniter\Router\RouteCollection;

/** @var RouteCollection $routes */

// Public landing page. Signed-in visitors are sent straight to the dashboard.
$routes->get('/', 'Home::index');

/*
 * Everything below requires an authenticated session. Shield's `session`
 * filter is the server-side gate: hiding navigation is never sufficient on
 * its own.
 */
$routes->group('', ['filter' => 'session'], static function (RouteCollection $routes): void {
    $routes->get('dashboard', 'Dashboard::index');
});

// Shield's own authentication routes (login, register, logout, magic link).
service('auth')->routes($routes);
