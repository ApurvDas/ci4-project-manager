"use client";

import { useEffect, useRef } from "react";
import { createScope, type Scope } from "animejs";

/**
 * The one anime.js/React integration point. Wraps the standard
 * createScope -> .add() -> revert() lifecycle so no component repeats it.
 *
 * - `root` is attached to the element you render; selectors inside `setup`
 *   resolve only within that subtree, so multiple mounted instances don't
 *   collide.
 * - `revert()` on unmount stops every animation and restores styles. This is
 *   essential: React dev mode double-mounts effects, and without revert the
 *   first mount's animations would leak.
 * - A `reduce` media query is registered so `setup` can branch on
 *   `self.matches.reduce` to resolve straight to end states.
 *
 * Pass a `deps` array to rebuild the scope when inputs change (defaults to
 * once on mount).
 */
export function useAnimeScope(
  setup: (self: Scope) => void,
  deps: React.DependencyList = [],
) {
  const root = useRef<HTMLDivElement>(null);
  const scope = useRef<Scope | null>(null);

  useEffect(() => {
    scope.current = createScope({
      root,
      mediaQueries: { reduce: "(prefers-reduced-motion: reduce)" },
    }).add((self) => {
      if (self) setup(self);
    });

    return () => {
      scope.current?.revert();
      scope.current = null;
    };
    // setup is intentionally excluded; callers pass explicit deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { root, scope };
}
