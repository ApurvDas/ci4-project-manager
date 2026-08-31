"use client";

import * as React from "react";
import { Minus, Plus } from "lucide-react";
import { AnimatedNumber } from "@/components/motion/AnimatedNumber";
import { stagger as staggerTokens } from "@/lib/motion";
import { Button } from "@/components/ui/button";

const BASE_SERVINGS = 4;
const INGREDIENTS = [
  { name: "flour", quantity: 2, unit: "cups" },
  { name: "butter", quantity: 0.5, unit: "cup" },
  { name: "sugar", quantity: 1.25, unit: "cups" },
  { name: "eggs", quantity: 3, unit: "" },
  { name: "vanilla", quantity: 1, unit: "tsp" },
];

/**
 * The flagship interaction in miniature: change servings, and every quantity
 * tweens to its new value with a downward ripple. Scaling math is a plain
 * multiply; the motion is what communicates that they all recalculated at once.
 */
export function ServingsDemo() {
  const [servings, setServings] = React.useState(BASE_SERVINGS);
  const factor = servings / BASE_SERVINGS;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="icon"
          aria-label="Fewer servings"
          onClick={() => setServings((s) => Math.max(1, s - 1))}
        >
          <Minus />
        </Button>
        <div className="min-w-24 text-center">
          <div className="text-2xl font-semibold tabular-nums">{servings}</div>
          <div className="text-xs text-muted-foreground">servings</div>
        </div>
        <Button
          variant="outline"
          size="icon"
          aria-label="More servings"
          onClick={() => setServings((s) => Math.min(24, s + 1))}
        >
          <Plus />
        </Button>
      </div>

      <ul className="divide-y divide-border rounded-lg border border-border">
        {INGREDIENTS.map((ing, i) => (
          <li
            key={ing.name}
            className="flex items-baseline justify-between px-4 py-2.5"
          >
            <span className="capitalize">{ing.name}</span>
            <span className="font-medium text-primary">
              <AnimatedNumber
                value={ing.quantity * factor}
                delay={i * staggerTokens.base}
              />
              {ing.unit ? ` ${ing.unit}` : ""}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
