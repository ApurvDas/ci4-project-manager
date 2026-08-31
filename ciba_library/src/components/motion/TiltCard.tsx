"use client";

import * as React from "react";
import { useTilt } from "@/hooks/useTilt";
import { depth } from "@/lib/motion";
import { cn } from "@/lib/utils";

interface TiltCardProps {
  children: React.ReactNode;
  className?: string;
  /** Peak edge rotation in degrees. */
  max?: number;
  /** translateZ pop on hover. */
  lift?: number;
  /** Show the pointer-tracked glare sheen (default true). */
  glare?: boolean;
}

/**
 * Depth-tilt wrapper: the container holds the perspective, the inner surface
 * rotates toward the pointer and lifts in Z, and a soft sheen tracks the
 * cursor. Progressive enhancement — content stays fully interactive, and the
 * whole effect no-ops under reduced motion (handled in useTilt).
 */
export function TiltCard({
  children,
  className,
  max,
  lift,
  glare = true,
}: TiltCardProps) {
  const { ref, bind, glare: sheen } = useTilt({ max, lift });

  return (
    <div
      style={{ perspective: `${depth.perspective}px` }}
      className={cn("[transform-style:preserve-3d]", className)}
      {...bind}
    >
      <div
        ref={ref}
        className="relative h-full rounded-[inherit] [transform-style:preserve-3d] will-change-transform"
      >
        {children}
        {glare && (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 z-10 rounded-[inherit] mix-blend-soft-light transition-opacity"
            style={{
              opacity: sheen.opacity,
              background: `radial-gradient(circle at ${sheen.x}% ${sheen.y}%, rgba(255,255,255,0.8), transparent 45%)`,
            }}
          />
        )}
      </div>
    </div>
  );
}
