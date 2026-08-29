<?php

declare(strict_types=1);

namespace App\Controllers;

class Home extends BaseController
{
    /**
     * The application landing page.
     *
     * Public, but renders differently depending on the authentication state:
     * visitors get an introduction and the sign-in routes, signed-in users get
     * their entry point into the application.
     */
    public function index(): string
    {
        return view('home', [
            'currentUser' => auth()->user(),
        ]);
    }
}
