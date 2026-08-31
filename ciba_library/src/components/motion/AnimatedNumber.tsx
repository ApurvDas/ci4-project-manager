"use client";

import * as React from "react";
import { animate, utils } from "animejs";
import { durations, eases, motionEnabled } from "@/lib/motion";
import { cn } from "@/lib/utils";

interface AnimatedNumberProps {
  value: number;
  /** Decimal places to display. Default 2, trailing zeros trimmed. */
  decimals?: number;
  /** Stagger offset (ms) so a list of these ripples. */
  delay?: number;
  className?: string;
}

/** Trim trailing zeros: 1.50 -> "1.5", 2.00 -> "2". */
function format(n: number, decimals: number) {
  return parseFloat(n.toFixed(decimals)).toString();
}

/**
 * Tweens its displayed value whenever `value` changes, counting up or down
 * rather than snapping. The number lives in a ref driven imperatively by
 * anime.js, so re-renders never fight an in-flight tween. This is the core of
 * the servings-scaler ripple.
 */
export function AnimatedNumber({
  value,
  decimals = 2,
  delay = 0,
  className,
}: AnimatedNumberProps) {
  const el = React.useRef<HTMLSpanElement>(null);
  const current = React.useRef(value);

  React.useEffect(() => {
    const node = el.current;
    if (!node) return;

    if (!motionEnabled()) {
      current.current = value;
      node.textContent = format(value, decimals);
      return;
    }

    const state = { n: current.current };
    const animation = animate(state, {
      n: value,
      duration: durations.base,
      ease: eases.out,
      delay,
      onUpdate: () => {
        node.textContent = format(state.n, decimals);
      },
      onComplete: () => {
        current.current = value;
      },
    });

    return () => {
      utils.remove(state);
      animation.pause();
    };
  }, [value, decimals, delay]);

  return (
    <span ref={el} className={cn("tabular-nums", className)}>
      {format(value, decimals)}
    </span>
  );
}
