import type { Ingredient } from "./types";

/*
 * Pure servings-scaling logic — kept separate from any animation so it's
 * trivially unit-testable. Scaling is a plain multiply by the ratio of target
 * to base servings.
 */

/** Scale a single quantity from a base serving count to a target. */
export function scaleQuantity(
  quantity: number,
  baseServings: number,
  targetServings: number,
): number {
  if (baseServings <= 0) return quantity;
  return quantity * (targetServings / baseServings);
}

/** Return ingredients with quantities scaled to the target servings. */
export function scaleIngredients(
  ingredients: Ingredient[],
  baseServings: number,
  targetServings: number,
): Ingredient[] {
  return ingredients.map((ing) => ({
    ...ing,
    quantity: scaleQuantity(ing.quantity, baseServings, targetServings),
  }));
}

/**
 * Format a scaled quantity for display: round to 2 dp and trim trailing zeros
 * (1.50 -> "1.5", 2.00 -> "2"). Values under 0.01 collapse to "0".
 */
export function formatQuantity(quantity: number): string {
  if (!Number.isFinite(quantity)) return "0";
  const rounded = Math.round(quantity * 100) / 100;
  return parseFloat(rounded.toFixed(2)).toString();
}
