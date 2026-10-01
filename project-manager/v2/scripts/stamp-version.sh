#!/usr/bin/env bash
# Cache-bust a deploy: add ?v=<version> to every CSS/JS reference in the HTML
# and to every relative module import in our JS, so a browser never mixes files
# from two deploys (GitHub Pages lets each file sit in cache for 10 minutes).
# Usage: scripts/stamp-version.sh <web dir> <version>. Run on a build copy only.
set -euo pipefail
dir="$1"
version="$2"

sed -i -E "s#(assets/[^\"']+\.(css|js))([\"'])#\1?v=${version}\3#g" "$dir"/*.html
find "$dir/assets/js" -name '*.js' -not -path '*/lib/*' -print0 |
    xargs -0 sed -i -E "s#(from '\.{1,2}/[^']+\.js)'#\1?v=${version}'#g"

# Pages also caches the HTML itself for ~10 minutes, and that stale HTML points
# at the previous build. Each page records its build; app.js compares it with
# version.txt (fetched uncached) and reloads once if a newer build is live.
sed -i -E "s#<meta charset=\"utf-8\">#<meta charset=\"utf-8\">\n    <script>window.BUILD = '${version}';</script>#" "$dir"/*.html
printf '%s' "$version" > "$dir/version.txt"
# The service worker names its cache after the build, so a deploy replaces it, and
# precaches every page and asset so the whole app opens offline.
sed -i "s#__BUILD__#${version}#" "$dir/sw.js"
files=$(cd "$dir" && find . -type f \( -name '*.html' -o -name '*.js' -o -name '*.css' -o -name '*.woff2' -o -name '*.png' -o -name '*.ico' -o -name '*.webmanifest' \) ! -name sw.js |
    sed 's#^\./##' | sort | sed 's#.*#"&"#' | paste -sd, -)
sed -i "s#^const PRECACHE = \[\];.*#const PRECACHE = [${files}];#" "$dir/sw.js"
