"use client";

import * as React from "react";
import { animate } from "animejs";
import { depth, springs, motionEnabled } from "@/lib/motion";

interface UseTiltOptions {
  /** Peak rotation in degrees at the edge. Defaults to depth.tilt.max. */
  max?: number;
  /** translateZ pop while hovered. Defaults to depth.tilt.lift. */
  lift?: number;
}

/**
 * Pointer-tracked 3D tilt. Attach `ref` to the surface and `bind` to its
 * container: the surface rotates toward the pointer around X/Y and lifts in Z,
 * then springs back to rest on leave. `glare` positions a light sheen that
 * follows the pointer (wire it to a highlight overlay's style).
 *
 * Purely decorative — a no-op under reduced motion, so the underlying element
 * (usually a link) keeps working untouched.
 */
export function useTilt({ max = depth.tilt.max, lift = depth.tilt.lift }: UseTiltOptions = {}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [glare, setGlare] = React.useState({ x: 50, y: 50, opacity: 0 });

  const onPointerMove = (e: React.PointerEvent<HTMLElement>) => {
    const el = ref.current;
    if (!el || !motionEnabled()) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width; // 0..1
    const py = (e.clientY - rect.top) / rect.height; // 0..1
    // Pointer above center tilts the top back (negative rotateX), etc.
    const rotateX = (0.5 - py) * max * 2;
    const rotateY = (px - 0.5) * max * 2;
    animate(el, {
      rotateX,
      rotateY,
      translateZ: lift,
      duration: 220,
      ease: "out(3)",
    });
    setGlare({ x: px * 100, y: py * 100, opacity: 0.35 });
  };

  const reset = () => {
    const el = ref.current;
    if (!el || !motionEnabled()) return;
    animate(el, {
      rotateX: 0,
      rotateY: 0,
      translateZ: 0,
      ease: springs.gentle(),
    });
    setGlare((g) => ({ ...g, opacity: 0 }));
  };

  const bind = {
    onPointerMove,
    onPointerLeave: reset,
    onPointerCancel: reset,
  };

  return { ref, bind, glare };
}
