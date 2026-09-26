<?php

declare(strict_types=1);

/**
 * Asset URL with a cache-busting version.
 *
 * Browsers and CDNs are told to cache CSS and JS hard. Without a changing URL,
 * a deployment leaves users on the old stylesheet until they force-reload —
 * which usually shows up as "the site looks broken after you deployed".
 *
 * The file's modification time is used as the version, so it changes exactly
 * when the file does and needs no build step.
 */
if (! function_exists('versioned_asset')) {
    function versioned_asset(string $path): string
    {
        $url      = base_url($path);
        $fullPath = FCPATH . ltrim($path, '/');

        if (! is_file($fullPath)) {
            // Missing files are the caller's problem, not this helper's; return
            // a usable URL rather than throwing during a page render.
            return $url;
        }

        return $url . '?v=' . filemtime($fullPath);
    }
}
