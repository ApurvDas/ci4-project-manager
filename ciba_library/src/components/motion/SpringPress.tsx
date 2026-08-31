"use client";

import * as React from "react";
import { animate } from "animejs";
import { springs, motionEnabled } from "@/lib/motion";
import { cn } from "@/lib/utils";

interface SpringPressProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  /** Scale at the bottom of the press. */
  depth?: number;
}

/**
 * Wraps interactive content with a spring-based press: dips on pointer-down,
 * springs back on release. Micro-tier feedback that makes buttons and cards
 * feel physical. Purely decorative, so it no-ops under reduced motion.
 */
export function SpringPress({
  children,
  depth = 0.95,
  className,
  ...props
}: SpringPressProps) {
  const ref = React.useRef<HTMLDivElement>(null);

  const press = () => {
    if (!ref.current || !motionEnabled()) return;
    animate(ref.current, { scale: depth, ease: springs.press() });
  };

  const release = () => {
    if (!ref.current || !motionEnabled()) return;
    animate(ref.current, { scale: 1, ease: springs.bouncy() });
  };

  return (
    <div
      ref={ref}
      className={cn("inline-block will-change-transform", className)}
      onPointerDown={press}
      onPointerUp={release}
      onPointerLeave={release}
      {...props}
    >
      {children}
    </div>
  );
}
