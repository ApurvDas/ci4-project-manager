"use client";

import * as React from "react";
import { animate } from "animejs";
import { springs, depth, motionEnabled } from "@/lib/motion";
import { cn } from "@/lib/utils";

interface FlipCard3DProps {
  front: React.ReactNode;
  back: React.ReactNode;
  className?: string;
  /**
   * Own the keyboard focus (flip on focus, become a tab stop). Set false when
   * wrapping the card in a link so there's a single, meaningful tab stop.
   */
  focusable?: boolean;
}

/**
 * A genuine 3D card flip: the inner plane rotates 180° around Y, anime.js
 * spring-driven, revealing the back face. Flips on hover and on keyboard focus
 * so it works without a pointer. Backface-culled so only one side shows.
 *
 * Under reduced motion it stays on the front and never rotates; both faces
 * carry equivalent information so nothing is lost.
 */
export function FlipCard3D({
  front,
  back,
  className,
  focusable = true,
}: FlipCard3DProps) {
  const inner = React.useRef<HTMLDivElement>(null);
  const flipped = React.useRef(false);

  const setFlipped = (next: boolean) => {
    if (!inner.current || !motionEnabled() || flipped.current === next) return;
    flipped.current = next;
    animate(inner.current, { rotateY: next ? 180 : 0, ease: springs.gentle() });
  };

  return (
    <div
      style={{ perspective: `${depth.perspective}px` }}
      className={cn("group relative", className)}
      onPointerEnter={() => setFlipped(true)}
      onPointerLeave={() => setFlipped(false)}
      onFocus={focusable ? () => setFlipped(true) : undefined}
      onBlur={focusable ? () => setFlipped(false) : undefined}
      tabIndex={focusable ? 0 : undefined}
    >
      <div
        ref={inner}
        className="relative h-full w-full [transform-style:preserve-3d] will-change-transform"
      >
        <div className="h-full [backface-visibility:hidden]">{front}</div>
        <div className="absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)]">
          {back}
        </div>
      </div>
    </div>
  );
}
