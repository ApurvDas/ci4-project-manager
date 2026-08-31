"use client";

import * as React from "react";
import { animate } from "animejs";
import { depth as depthTokens, motionEnabled } from "@/lib/motion";
import { cn } from "@/lib/utils";

interface HeroParallaxProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

/**
 * A shared parallax field for the hero. Direct or nested children carrying
 * `data-depth="<n>"` shift with the pointer proportionally to their depth
 * (larger n = moves more = reads as closer), all inside one perspective so the
 * headline, badge, and 3D centerpiece drift together as a single scene.
 *
 * Decorative: no-ops under reduced motion and eases back to rest on leave.
 */
export function HeroParallax({
  children,
  className,
  ...props
}: HeroParallaxProps) {
  const root = React.useRef<HTMLDivElement>(null);

  const drift = (px: number, py: number) => {
    const el = root.current;
    if (!el || !motionEnabled()) return;
    const layers = el.querySelectorAll<HTMLElement>("[data-depth]");
    layers.forEach((layer) => {
      const d = parseFloat(layer.dataset.depth ?? "0");
      animate(layer, {
        translateX: px * 34 * d,
        translateY: py * 34 * d,
        translateZ: d * 40,
        duration: 500,
        ease: "out(3)",
      });
    });
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    // -0.5..0.5 around the section center.
    drift(
      (e.clientX - rect.left) / rect.width - 0.5,
      (e.clientY - rect.top) / rect.height - 0.5,
    );
  };

  const reset = () => drift(0, 0);

  return (
    <div
      ref={root}
      onPointerMove={onPointerMove}
      onPointerLeave={reset}
      style={{ perspective: `${depthTokens.perspective}px` }}
      className={cn("[transform-style:preserve-3d]", className)}
      {...props}
    >
      {children}
    </div>
  );
}
