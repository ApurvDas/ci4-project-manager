"use client";

import * as React from "react";
import { animate } from "animejs";
import { depth, motionEnabled } from "@/lib/motion";
import { cn } from "@/lib/utils";

interface RotatingBadgeProps {
  children: React.ReactNode;
  className?: string;
  /** Seconds per full turn. */
  period?: number;
}

/**
 * A slow "coin" spin around Y — an always-on 3D accent for small chips and
 * badges. Loops via anime.js. The face is double-sided (backface visible) so
 * the content stays legible through the whole rotation. Holds still under
 * reduced motion.
 */
export function RotatingBadge({
  children,
  className,
  period = 8,
}: RotatingBadgeProps) {
  const ref = React.useRef<HTMLSpanElement>(null);

  React.useEffect(() => {
    const el = ref.current;
    if (!el || !motionEnabled()) return;
    const anim = animate(el, {
      rotateY: 360,
      duration: period * 1000,
      ease: "linear",
      loop: true,
    });
    return () => {
      anim.revert();
    };
  }, [period]);

  return (
    <span
      style={{ perspective: `${depth.perspective}px` }}
      className={cn("inline-block", className)}
    >
      <span
        ref={ref}
        className="inline-block [backface-visibility:visible] [transform-style:preserve-3d] will-change-transform"
      >
        {children}
      </span>
    </span>
  );
}
