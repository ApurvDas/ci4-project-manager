"use client";

import * as React from "react";
import { animate, stagger, splitText } from "animejs";
import { durations, eases, stagger as staggerTokens } from "@/lib/motion";
import { useAnimeScope } from "@/hooks/useAnimeScope";
import { cn } from "@/lib/utils";

interface SplitTextHeadlineProps {
  text: string;
  className?: string;
  /** Stagger per character (ms). */
  stagger?: number;
  as?: "h1" | "h2" | "p";
}

/**
 * Splits a headline into characters and staggers them in. splitText keeps the
 * text accessible (screen readers still read the whole string), and under
 * reduced motion we skip the animation entirely, leaving the text as-is.
 */
export function SplitTextHeadline({
  text,
  className,
  stagger: staggerMs = staggerTokens.tight,
  as: Tag = "h1",
}: SplitTextHeadlineProps) {
  const { root } = useAnimeScope(
    (self) => {
      const target = self.root.querySelector<HTMLElement>("[data-split]");
      if (!target) return;

      const { chars } = splitText(target, { chars: true, accessible: true });
      if (self.matches.reduce) return;

      animate(chars, {
        opacity: [0, 1],
        translateY: [{ from: "0.5em", to: 0 }],
        rotateZ: [{ from: -6, to: 0 }],
        duration: durations.narrative,
        ease: eases.out,
        delay: stagger(staggerMs),
      });
    },
    [text],
  );

  return (
    <div ref={root} className={cn(className)}>
      <Tag data-split>{text}</Tag>
    </div>
  );
}
