"use client";

import * as React from "react";
import { DrawableCheck } from "@/components/motion/DrawableCheck";
import { cn } from "@/lib/utils";

const ITEMS = ["Flour", "Butter", "Sugar", "Eggs", "Vanilla"];

/** Toggling an item draws its checkmark stroke-by-stroke. */
export function ChecklistDemo() {
  const [checked, setChecked] = React.useState<Record<string, boolean>>({});

  return (
    <ul className="space-y-1">
      {ITEMS.map((item) => {
        const isChecked = !!checked[item];
        return (
          <li key={item}>
            <button
              type="button"
              onClick={() =>
                setChecked((c) => ({ ...c, [item]: !c[item] }))
              }
              className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left hover:bg-muted"
            >
              <span
                className={cn(
                  "flex size-5 items-center justify-center rounded border transition-colors",
                  isChecked
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-transparent",
                )}
              >
                <DrawableCheck checked={isChecked} />
              </span>
              <span
                className={cn(
                  isChecked && "text-muted-foreground line-through",
                )}
              >
                {item}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
