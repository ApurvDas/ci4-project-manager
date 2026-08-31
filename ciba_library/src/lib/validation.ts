import { z } from "zod";

/*
 * Shared validation schemas. The recipe form (client) and the Phase 4 server
 * actions validate against the same shapes, so client and server never
 * disagree about what a valid recipe is.
 */

export const ingredientSchema = z.object({
  name: z.string().trim().min(1, "Required").max(120),
  quantity: z.coerce
    .number({ message: "Number" })
    .positive("Must be > 0")
    .max(100000),
  unit: z.string().trim().max(30).optional().or(z.literal("")),
  notes: z.string().trim().max(200).optional().or(z.literal("")),
});

export const stepSchema = z.object({
  instruction: z.string().trim().min(1, "Required").max(1000),
});

export const recipeInputSchema = z.object({
  title: z.string().trim().min(3, "At least 3 characters").max(140),
  description: z.string().trim().min(10, "Add a short description").max(500),
  categoryId: z.string().min(1, "Pick a category"),
  servings: z.coerce.number().int().min(1).max(48),
  prepTimeMins: z.coerce.number().int().min(0).max(1440),
  cookTimeMins: z.coerce.number().int().min(0).max(1440),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]),
  imageUrl: z.url().optional().or(z.literal("")),
  tagIds: z.array(z.string()).max(12),
  ingredients: z.array(ingredientSchema).min(1, "Add at least one ingredient"),
  steps: z.array(stepSchema).min(1, "Add at least one step"),
});

/** Parsed/validated recipe (numbers coerced) — the server-action payload. */
export type RecipeInput = z.output<typeof recipeInputSchema>;
/** Raw form values before coercion — used for react-hook-form field types. */
export type RecipeFormValues = z.input<typeof recipeInputSchema>;

export const registerSchema = z
  .object({
    name: z.string().trim().min(2, "Enter your name").max(80),
    username: z
      .string()
      .trim()
      .min(3, "At least 3 characters")
      .max(30)
      .regex(/^[a-z0-9_]+$/, "Lowercase letters, numbers, underscores only"),
    email: z.email("Enter a valid email").trim(),
    password: z.string().min(8, "At least 8 characters").max(100),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: "Passwords don't match",
    path: ["confirm"],
  });

export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(1, "Enter your password"),
});

export type LoginInput = z.infer<typeof loginSchema>;
