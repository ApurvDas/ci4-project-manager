"use client";

import * as React from "react";
import { animate, stagger } from "animejs";
import { durations, eases, stagger as staggers, motionEnabled } from "@/lib/motion";
import { cn } from "@/lib/utils";

interface FlipGridProps {
  /** Stable keys drive the FLIP diff — reorder/add/remove animates. */
  itemKeys: string[];
  children: React.ReactNode;
  className?: string;
}

type Rects = Map<string, DOMRect>;

/**
 * FLIP layout container. When the set or order of children changes, items that
 * moved animate from their old box to the new one (First-Last-Invert-Play),
 * entering items fade+rise in, and the whole thing respects reduced motion.
 *
 * Children must each carry a `data-flip-key` matching an entry in `itemKeys`.
 */
export function FlipGrid({ itemKeys, children, className }: FlipGridProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const prevRects = React.useRef<Rects>(new Map());
  const first = React.useRef(true);

  const measure = React.useCallback((): Rects => {
    const rects: Rects = new Map();
    const el = containerRef.current;
    if (!el) return rects;
    el.querySelectorAll<HTMLElement>("[data-flip-key]").forEach((child) => {
      const key = child.dataset.flipKey;
      if (key) rects.set(key, child.getBoundingClientRect());
    });
    return rects;
  }, []);

  React.useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // First paint: just record positions, no animation.
    if (first.current) {
      first.current = false;
      prevRects.current = measure();
      return;
    }

    if (!motionEnabled()) {
      prevRects.current = measure();
      return;
    }

    const before = prevRects.current;
    const after = measure();
    const entering: HTMLElement[] = [];

    el.querySelectorAll<HTMLElement>("[data-flip-key]").forEach((child) => {
      const key = child.dataset.flipKey;
      if (!key) return;
      const prev = before.get(key);
      const next = after.get(key);
      if (!next) return;

      if (!prev) {
        entering.push(child);
        return;
      }

      const dx = prev.left - next.left;
      const dy = prev.top - next.top;
      if (dx === 0 && dy === 0) return;

      // Invert to the old position, then play back to zero.
      animate(child, {
        translateX: [dx, 0],
        translateY: [dy, 0],
        duration: durations.base,
        ease: eases.out,
      });
    });

    if (entering.length) {
      animate(entering, {
        opacity: [0, 1],
        translateY: [12, 0],
        scale: [0.96, 1],
        duration: durations.base,
        ease: eases.out,
        delay: stagger(staggers.tight),
      });
    }

    prevRects.current = after;
  }, [itemKeys, measure]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3",
        className,
      )}
    >
      {children}
    </div>
  );
}
