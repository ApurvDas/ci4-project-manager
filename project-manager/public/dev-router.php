<?php

declare(strict_types=1);

/**
 * Development server router.
 *
 * PHP's built-in server (php -S) serves static files with no cache headers, so
 * every navigation re-requests the stylesheet and fonts — and because the
 * built-in server handles one request at a time, those re-fetches queue behind
 * the next page and make clicking around feel slow.
 *
 * This adds a far-future cache header for anything under /assets/. That is safe
 * because every asset URL carries a `?v=<mtime>` cachebust (see
 * versioned_asset()): the URL changes whenever the file does, so an immutable
 * cache can never serve a stale file.
 *
 * The header cannot be added by setting it and returning false — the built-in
 * server drops router headers when it serves a static file itself — so an
 * asset is streamed from here with the header attached. Production uses Apache
 * or nginx, which get the same behaviour from public/.htaccess; this file is
 * only for `php -S`.
 *
 * Serve with:
 *   php -S localhost:8123 -t public public/dev-router.php
 */

$uri = urldecode(
    parse_url('http://localhost' . ($_SERVER['REQUEST_URI'] ?? '/'), PHP_URL_PATH) ?? '',
);

$path = __DIR__ . DIRECTORY_SEPARATOR . ltrim($uri, '/');

if ($uri !== '/' && is_file($path)) {
    // A cached asset: stream it with the cache header and the right type.
    if (str_starts_with($uri, '/assets/')) {
        $types = [
            'css'   => 'text/css',
            'js'    => 'text/javascript',
            'woff2' => 'font/woff2',
            'woff'  => 'font/woff',
            'ttf'   => 'font/ttf',
            'svg'   => 'image/svg+xml',
            'png'   => 'image/png',
            'jpg'   => 'image/jpeg',
            'jpeg'  => 'image/jpeg',
            'gif'   => 'image/gif',
            'ico'   => 'image/x-icon',
        ];

        $ext = strtolower(pathinfo($path, PATHINFO_EXTENSION));

        header('Cache-Control: public, max-age=31536000, immutable');
        header('Content-Type: ' . ($types[$ext] ?? 'application/octet-stream'));
        header('Content-Length: ' . filesize($path));

        readfile($path);

        return true;
    }

    // Any other existing file: let the built-in server deliver it.
    return false;
}

if ($uri !== '/' && is_dir($path)) {
    return false;
}

// Everything else is a framework route.
$_SERVER['SCRIPT_NAME'] = '/index.php';
require_once __DIR__ . DIRECTORY_SEPARATOR . 'index.php';
