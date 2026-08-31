"use client";

import * as React from "react";
import { Minus, Plus, ListPlus, Check } from "lucide-react";
import { toast } from "sonner";
import type { Ingredient } from "@/lib/types";
import { scaleQuantity } from "@/lib/scaling";
import { flyToCart } from "@/lib/fly-to-cart";
import { AnimatedNumber } from "@/components/motion/AnimatedNumber";
import { Button } from "@/components/ui/button";

interface ServingsScalerProps {
  ingredients: Ingredient[];
  baseServings: number;
  recipeSlug: string;
  recipeTitle: string;
  /** Wired to a server action in Phase 4; optional so Phase 2 works standalone. */
  onAddToList?: (
    items: { name: string; quantity: number; unit: string | null }[],
  ) => Promise<void> | void;
}

const MIN_SERVINGS = 1;
const MAX_SERVINGS = 24;

/**
 * Flagship interaction: the servings stepper retargets every ingredient
 * quantity, and each <AnimatedNumber> tweens from its old amount to the new one
 * so the whole list ripples on each tap. Adding an ingredient flings a ghost to
 * the cart badge (see flyToCart).
 */
export function ServingsScaler({
  ingredients,
  baseServings,
  recipeSlug,
  recipeTitle,
  onAddToList,
}: ServingsScalerProps) {
  const [servings, setServings] = React.useState(baseServings);
  const [addedAll, setAddedAll] = React.useState(false);

  const scaled = React.useMemo(
    () =>
      ingredients.map((ing) => ({
        ...ing,
        scaledQuantity: scaleQuantity(ing.quantity, baseServings, servings),
      })),
    [ingredients, baseServings, servings],
  );

  const step = (delta: number) =>
    setServings((s) => Math.min(MAX_SERVINGS, Math.max(MIN_SERVINGS, s + delta)));

  const addItems = async (
    source: HTMLElement | null,
    items: { name: string; quantity: number; unit: string | null }[],
  ) => {
    flyToCart(source);
    try {
      await onAddToList?.(items);
      toast.success(
        items.length === 1
          ? `Added ${items[0].name} to your list`
          : `Added ${items.length} ingredients to your list`,
      );
    } catch {
      toast.error("Couldn't add to your list. Try again.");
    }
  };

  const addAll = async (e: React.MouseEvent<HTMLButtonElement>) => {
    await addItems(
      e.currentTarget,
      scaled.map((s) => ({
        name: s.name,
        quantity: s.scaledQuantity,
        unit: s.unit,
      })),
    );
    setAddedAll(true);
    window.setTimeout(() => setAddedAll(false), 2000);
  };

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
        <div>
          <h2 className="font-display text-2xl font-medium tracking-tight">
            Ingredients
          </h2>
          <p className="text-sm text-muted-foreground">
            Scaled for{" "}
            <AnimatedNumber
              value={servings}
              decimals={0}
              className="font-medium text-foreground"
            />{" "}
            {servings === 1 ? "serving" : "servings"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-md border border-border">
            <button
              type="button"
              aria-label="Fewer servings"
              onClick={() => step(-1)}
              disabled={servings <= MIN_SERVINGS}
              className="flex size-9 items-center justify-center rounded-l-md text-muted-foreground transition-[transform,background-color,color] duration-150 ease-snappy hover:bg-muted hover:text-foreground motion-safe:active:scale-90 disabled:opacity-40"
            >
              <Minus className="size-4" />
            </button>
            <span className="min-w-10 text-center text-lg font-semibold tabular-nums">
              <AnimatedNumber value={servings} decimals={0} />
            </span>
            <button
              type="button"
              aria-label="More servings"
              onClick={() => step(1)}
              disabled={servings >= MAX_SERVINGS}
              className="flex size-9 items-center justify-center rounded-r-md text-muted-foreground transition-[transform,background-color,color] duration-150 ease-snappy hover:bg-muted hover:text-foreground motion-safe:active:scale-90 disabled:opacity-40"
            >
              <Plus className="size-4" />
            </button>
          </div>
        </div>
      </div>

      <ul className="divide-y divide-border">
        {scaled.map((ing) => (
          <li
            key={ing.id}
            className="group flex items-center gap-3 px-4 py-2.5 text-sm"
          >
            <span className="flex min-w-16 items-baseline gap-1 font-medium tabular-nums">
              <AnimatedNumber value={ing.scaledQuantity} />
              {ing.unit && (
                <span className="text-muted-foreground">{ing.unit}</span>
              )}
            </span>
            <span className="flex-1">
              {ing.name}
              {ing.notes && (
                <span className="text-muted-foreground">, {ing.notes}</span>
              )}
            </span>
            <button
              type="button"
              aria-label={`Add ${ing.name} to shopping list`}
              onClick={(e) =>
                addItems(e.currentTarget, [
                  {
                    name: ing.name,
                    quantity: ing.scaledQuantity,
                    unit: ing.unit,
                  },
                ])
              }
              className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-[transform,opacity,background-color,color] duration-150 ease-snappy hover:bg-primary/10 hover:text-primary motion-safe:active:scale-90 focus-visible:opacity-100 group-hover:opacity-100"
            >
              <ListPlus className="size-4" />
            </button>
          </li>
        ))}
      </ul>

      <div className="p-4">
        <Button
          variant="secondary"
          className="w-full"
          onClick={addAll}
          data-recipe={recipeSlug}
          data-recipe-title={recipeTitle}
        >
          {addedAll ? (
            <>
              <Check className="size-4" /> Added to list
            </>
          ) : (
            <>
              <ListPlus className="size-4" /> Add all to shopping list
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

export { MIN_SERVINGS, MAX_SERVINGS };
