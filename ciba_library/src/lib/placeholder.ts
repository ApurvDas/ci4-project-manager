/*
 * Generated placeholder graphics — no external image service, no licensing or
 * network dependency. Each recipe gets a deterministic hue; we render a soft
 * two-tone gradient card as an inline SVG data URI, with the title's initials.
 */

/** Stable hue (0-359) derived from a string, so a recipe always looks the same. */
export function hueFromString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % 360;
}

export function initials(title: string): string {
  return title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

/** A gradient placeholder as a data URI, usable as an <img> src or background. */
export function placeholderDataUri(hue: number, label: string): string {
  const h2 = (hue + 40) % 360;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="hsl(${hue} 62% 62%)"/>
      <stop offset="1" stop-color="hsl(${h2} 58% 44%)"/>
    </linearGradient>
  </defs>
  <rect width="800" height="600" fill="url(#g)"/>
  <text x="400" y="330" font-family="Inter, system-ui, sans-serif" font-size="180"
    font-weight="700" fill="rgba(255,255,255,0.82)" text-anchor="middle">${label}</text>
</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
