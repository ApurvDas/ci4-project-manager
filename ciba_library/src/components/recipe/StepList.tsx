"use client";

import * as React from "react";
import type { Step } from "@/lib/types";
import { DrawableCheck } from "@/components/motion/DrawableCheck";
import { cn } from "@/lib/utils";

interface StepListProps {
  steps: Step[];
}

/**
 * Cook-along step list. Tapping a step marks it done — the number swaps for a
 * self-drawing checkmark and the text dims — so you can track progress while
 * cooking. Purely local UI state.
 */
export function StepList({ steps }: StepListProps) {
  const [done, setDone] = React.useState<Set<number>>(new Set());

  const toggle = (n: number) =>
    setDone((prev) => {
      const next = new Set(prev);
      if (next.has(n)) next.delete(n);
      else next.add(n);
      return next;
    });

  return (
    <ol className="space-y-3">
      {steps.map((step) => {
        const isDone = done.has(step.stepNumber);
        return (
          <li key={step.stepNumber}>
            <button
              type="button"
              onClick={() => toggle(step.stepNumber)}
              aria-pressed={isDone}
              className="flex w-full items-start gap-4 rounded-lg border border-border bg-card p-4 text-left transition-[transform,border-color] duration-150 ease-snappy hover:border-primary/40 motion-safe:active:scale-[0.99]"
            >
              <span
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-full border font-mono text-sm font-semibold tabular-nums transition-colors",
                  isDone
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-primary/30 text-primary",
                )}
              >
                {isDone ? (
                  <DrawableCheck checked className="size-4" />
                ) : (
                  step.stepNumber
                )}
              </span>
              <p
                className={cn(
                  "flex-1 leading-relaxed transition-colors",
                  isDone && "text-muted-foreground line-through",
                )}
              >
                {step.instruction}
              </p>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
