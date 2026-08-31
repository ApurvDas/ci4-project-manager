"use client";

import * as React from "react";
import { animate, svg } from "animejs";
import { durations, eases, motionEnabled } from "@/lib/motion";
import { cn } from "@/lib/utils";

interface DrawableCheckProps {
  checked: boolean;
  className?: string;
}

/**
 * A checkmark whose stroke draws itself in when `checked` flips true, using
 * anime.js's SVG drawable. Used on the shopping-list page. Under reduced
 * motion it appears fully drawn or cleared instantly.
 */
export function DrawableCheck({ checked, className }: DrawableCheckProps) {
  const path = React.useRef<SVGPathElement>(null);

  React.useEffect(() => {
    const node = path.current;
    if (!node) return;

    if (!motionEnabled()) {
      node.style.strokeDashoffset = checked ? "0" : "1";
      node.style.opacity = checked ? "1" : "0";
      return;
    }

    const [drawable] = svg.createDrawable(node);
    animate(drawable, {
      draw: checked ? "0 1" : "0 0",
      opacity: checked ? 1 : 0,
      duration: durations.base,
      ease: eases.out,
    });
  }, [checked]);

  return (
    <svg
      viewBox="0 0 24 24"
      className={cn("size-4", className)}
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path ref={path} d="M5 13l4 4L19 7" />
    </svg>
  );
}
