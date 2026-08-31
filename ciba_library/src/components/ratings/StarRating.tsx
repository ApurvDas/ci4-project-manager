"use client";

import * as React from "react";
import { animate, stagger } from "animejs";
import { Star } from "lucide-react";
import { useAnimeScope } from "@/hooks/useAnimeScope";
import { springs, motionEnabled } from "@/lib/motion";
import { cn } from "@/lib/utils";

interface StarRatingProps {
  value: number;
  /** Interactive mode lets the user pick a rating. */
  onChange?: (value: number) => void;
  readOnly?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZES = { sm: "size-3.5", md: "size-5", lg: "size-7" };

/**
 * Dual-mode star rating. In interactive mode, clicking a star springs the
 * chosen stars and ripples outward from the click. Read-only mode shows a
 * fractional fill.
 */
export function StarRating({
  value,
  onChange,
  readOnly = !onChange,
  size = "md",
  className,
}: StarRatingProps) {
  const [hover, setHover] = React.useState<number | null>(null);
  const shown = hover ?? value;

  const { root, scope } = useAnimeScope((self) => {
    self.add("pop", (index: number) => {
      if (self.matches.reduce) return;
      const stars = self.root.querySelectorAll<HTMLElement>("[data-star]");
      animate(stars, {
        scale: [{ to: 1.35 }, { to: 1 }],
        ease: springs.bouncy(),
        delay: stagger(40, { from: index }),
      });
    });
  });

  const pick = (n: number) => {
    onChange?.(n);
    if (motionEnabled()) scope.current?.methods.pop(n - 1);
  };

  return (
    <div
      ref={root}
      className={cn("inline-flex items-center gap-0.5", className)}
      role={readOnly ? "img" : "radiogroup"}
      aria-label={readOnly ? `Rated ${value} of 5` : "Rate this recipe"}
    >
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = shown >= n - 0.25;
        const StarEl = (
          <Star
            data-star
            className={cn(
              SIZES[size],
              "transition-colors",
              filled ? "fill-star text-star" : "text-muted-foreground/40",
            )}
          />
        );
        if (readOnly) return <span key={n}>{StarEl}</span>;
        return (
          <button
            key={n}
            type="button"
            aria-label={`${n} star${n > 1 ? "s" : ""}`}
            className="cursor-pointer p-0.5"
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(null)}
            onClick={() => pick(n)}
          >
            {StarEl}
          </button>
        );
      })}
    </div>
  );
}
