<?php

declare(strict_types=1);

namespace App\Controllers;

use CodeIgniter\HTTP\RedirectResponse;

class Home extends BaseController
{
    /**
     * The public landing page.
     *
     * A signed-in user has no use for the marketing copy, so they are sent to
     * their dashboard instead.
     */
    public function index(): RedirectResponse|string
    {
        if (auth()->loggedIn()) {
            return redirect()->to('dashboard');
        }

        return view('home');
    }
}
