"use client";

import * as React from "react";
import { animate, onScroll, stagger } from "animejs";
import { durations, eases, stagger as staggerTokens } from "@/lib/motion";
import { useAnimeScope } from "@/hooks/useAnimeScope";
import { cn } from "@/lib/utils";

interface RevealProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Direct children marked with [data-reveal] animate in, staggered. */
  children: React.ReactNode;
  /** Play once when scrolled into view (default) or every time it enters. */
  once?: boolean;
}

/**
 * Scroll-triggered staggered reveal. Children carrying `data-reveal` start
 * hidden (via the .js guard in globals.css) and rise + fade in when the block
 * scrolls into view. Under reduced motion they're simply shown.
 */
export function Reveal({
  children,
  once = true,
  className,
  ...props
}: RevealProps) {
  const { root } = useAnimeScope((self) => {
    const targets = self.root.querySelectorAll<HTMLElement>("[data-reveal]");
    if (!targets.length) return;

    if (self.matches.reduce) {
      targets.forEach((el) => (el.style.opacity = "1"));
      return;
    }

    animate(targets, {
      opacity: [0, 1],
      translateY: [16, 0],
      duration: durations.narrative,
      ease: eases.out,
      delay: stagger(staggerTokens.base),
      autoplay: onScroll({
        target: self.root as HTMLElement,
        enter: "bottom top",
        repeat: !once,
      }),
    });
  });

  return (
    <div ref={root} className={cn(className)} {...props}>
      {children}
    </div>
  );
}
