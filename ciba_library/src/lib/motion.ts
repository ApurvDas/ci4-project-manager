import { createSpring } from "animejs";

/*
 * Motion tokens — the single source of truth for timing across Ciba Library.
 * Components import from here; no raw durations or eases inline. Three tiers:
 *
 *   micro     (~150ms) — hover, press, toggle feedback
 *   base      (~320ms) — element enter/exit, list re-layout
 *   narrative (~900ms) — hero reveals, scroll-triggered sequences
 *
 * Keeping these centralized is what makes the whole site feel like one system
 * rather than a pile of one-off animations.
 */

export const durations = {
  micro: 150,
  base: 320,
  narrative: 900,
} as const;

/**
 * String eases usable directly in `animate({ ease })`. Spring eases are
 * factories (each call returns a fresh spring), so they live in `springs`.
 */
export const eases = {
  out: "out(3)",
  inOut: "inOut(3)",
  in: "in(2)",
} as const;

/** Spring presets — call to get a fresh instance for each animation. */
export const springs = {
  press: () => createSpring({ stiffness: 180, damping: 12 }),
  gentle: () => createSpring({ stiffness: 120, damping: 16 }),
  bouncy: () => createSpring({ stiffness: 200, damping: 8 }),
} as const;

export const stagger = {
  tight: 30,
  base: 60,
  loose: 110,
} as const;

/**
 * 3D depth tokens. `perspective` is the viewing distance applied to a tilt
 * container (smaller = more dramatic foreshortening); `tilt.max` is the peak
 * rotation in degrees at a container's edge; `tilt.lift` is the translateZ pop
 * on hover. Kept here so every 3D surface shares one sense of depth.
 */
export const depth = {
  perspective: 900,
  tilt: { max: 10, lift: 24 },
} as const;

/**
 * True when the user has not asked the OS to reduce motion. Guards imperative
 * animation entry points; components should resolve to the end state (never
 * leave content hidden) when this is false. SSR-safe: assumes motion is on
 * during server render, corrected on the client.
 */
export function motionEnabled(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return true;
  return !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
