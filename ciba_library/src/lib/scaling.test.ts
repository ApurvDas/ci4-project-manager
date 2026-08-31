import { describe, it, expect } from "vitest";
import { scaleQuantity, scaleIngredients, formatQuantity } from "./scaling";
import type { Ingredient } from "./types";

describe("scaleQuantity", () => {
  it("scales up by the target/base ratio", () => {
    expect(scaleQuantity(2, 4, 8)).toBe(4);
  });

  it("scales down", () => {
    expect(scaleQuantity(2, 4, 2)).toBe(1);
  });

  it("is identity when target equals base", () => {
    expect(scaleQuantity(3.5, 6, 6)).toBe(3.5);
  });

  it("guards against a zero or negative base (returns quantity unchanged)", () => {
    expect(scaleQuantity(2, 0, 8)).toBe(2);
    expect(scaleQuantity(2, -4, 8)).toBe(2);
  });
});

describe("scaleIngredients", () => {
  const ings: Ingredient[] = [
    { id: "a", name: "flour", quantity: 200, unit: "g", notes: null },
    { id: "b", name: "eggs", quantity: 2, unit: null, notes: null },
  ];

  it("scales every quantity and preserves the other fields", () => {
    const out = scaleIngredients(ings, 2, 4);
    expect(out.map((i) => i.quantity)).toEqual([400, 4]);
    expect(out[0].name).toBe("flour");
    expect(out[1].unit).toBeNull();
  });

  it("does not mutate the input", () => {
    scaleIngredients(ings, 2, 4);
    expect(ings[0].quantity).toBe(200);
  });
});

describe("formatQuantity", () => {
  it("trims trailing zeros", () => {
    expect(formatQuantity(1.5)).toBe("1.5");
    expect(formatQuantity(2)).toBe("2");
    expect(formatQuantity(2.0)).toBe("2");
  });

  it("rounds to two decimals", () => {
    expect(formatQuantity(1.005)).toBe("1"); // 1.005 -> 1.00 at fp precision
    expect(formatQuantity(0.333333)).toBe("0.33");
  });

  it("collapses sub-0.005 values to '0'", () => {
    expect(formatQuantity(0.004)).toBe("0");
  });

  it("returns '0' for non-finite input", () => {
    expect(formatQuantity(NaN)).toBe("0");
    expect(formatQuantity(Infinity)).toBe("0");
  });
});
