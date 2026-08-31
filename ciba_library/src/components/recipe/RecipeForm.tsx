"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { animate } from "animejs";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { durations, eases, motionEnabled } from "@/lib/motion";
import type { Category, Tag, TagGroup } from "@/lib/types";
import {
  recipeInputSchema,
  type RecipeInput,
  type RecipeFormValues,
} from "@/lib/validation";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { RecipeImage } from "@/components/recipe/RecipeImage";
import { hueFromString } from "@/lib/placeholder";
import { cn } from "@/lib/utils";

interface RecipeFormProps {
  categories: Category[];
  tags: Tag[];
  defaultValues?: Partial<RecipeInput>;
  mode?: "create" | "edit";
  /** Wired to a server action in Phase 4; returns the saved recipe's slug. */
  onSubmit?: (data: RecipeInput) => Promise<{ slug: string }>;
}

const GROUP_ORDER: TagGroup[] = ["Diet", "Meal Type", "Cuisine"];

const EMPTY: RecipeFormValues = {
  title: "",
  description: "",
  categoryId: "",
  servings: 4,
  prepTimeMins: 15,
  cookTimeMins: 20,
  difficulty: "EASY",
  imageUrl: "",
  tagIds: [],
  ingredients: [{ name: "", quantity: 1, unit: "", notes: "" }],
  steps: [{ instruction: "" }],
};

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-destructive">{message}</p>;
}

/**
 * Wraps a react-hook-form field array so appended rows rise+fade in and removed
 * rows slide out before they unmount. Rows in the container must carry
 * `data-row`. Respects reduced motion.
 */
function useAnimatedRows<T>(field: {
  append: (value: T) => void;
  remove: (index: number) => void;
}) {
  const containerRef = React.useRef<HTMLDivElement>(null);

  const rows = () =>
    containerRef.current
      ? Array.from(
          containerRef.current.querySelectorAll<HTMLElement>("[data-row]"),
        )
      : [];

  const append = (value: T) => {
    field.append(value);
    if (!motionEnabled()) return;
    requestAnimationFrame(() => {
      const els = rows();
      const el = els[els.length - 1];
      if (el)
        animate(el, {
          opacity: [0, 1],
          translateY: [10, 0],
          duration: durations.base,
          ease: eases.out,
        });
    });
  };

  const remove = (index: number) => {
    const el = rows()[index];
    if (!el || !motionEnabled()) {
      field.remove(index);
      return;
    }
    animate(el, {
      opacity: [1, 0],
      translateX: [0, 16],
      duration: durations.micro,
      ease: eases.in,
      onComplete: () => field.remove(index),
    });
  };

  return { containerRef, append, remove };
}

/**
 * Create/edit form for a recipe. Ingredient and step rows are dynamic field
 * arrays; validation shares the same zod schema as the Phase 4 server action.
 */
export function RecipeForm({
  categories,
  tags,
  defaultValues,
  mode = "create",
  onSubmit,
}: RecipeFormProps) {
  const router = useRouter();
  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<RecipeFormValues, unknown, RecipeInput>({
    resolver: zodResolver(recipeInputSchema),
    defaultValues: { ...EMPTY, ...defaultValues },
  });

  const ingredients = useFieldArray({ control, name: "ingredients" });
  const steps = useFieldArray({ control, name: "steps" });
  const {
    containerRef: ingredientContainerRef,
    append: appendIngredient,
    remove: removeIngredient,
  } = useAnimatedRows(ingredients);
  const {
    containerRef: stepContainerRef,
    append: appendStep,
    remove: removeStep,
  } = useAnimatedRows(steps);
  const selectedTags = useWatch({ control, name: "tagIds" }) ?? [];
  const imageUrl = useWatch({ control, name: "imageUrl" }) ?? "";
  const title = useWatch({ control, name: "title" }) ?? "";

  const grouped = React.useMemo(() => {
    const map: Record<TagGroup, Tag[]> = {
      Diet: [],
      "Meal Type": [],
      Cuisine: [],
    };
    for (const t of tags) map[t.group].push(t);
    return map;
  }, [tags]);

  const toggleTag = (id: string) => {
    const set = new Set(selectedTags);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    setValue("tagIds", [...set], { shouldDirty: true });
  };

  const submit = handleSubmit(async (data) => {
    try {
      if (onSubmit) {
        const { slug } = await onSubmit(data);
        toast.success(mode === "edit" ? "Recipe updated" : "Recipe published");
        router.push(`/recipes/${slug}`);
      } else {
        // Phase 2: no backend yet — confirm the shape works end to end.
        toast.success(
          mode === "edit"
            ? "Recipe updated (preview)"
            : "Recipe published (preview)",
        );
        router.push("/dashboard/recipes");
      }
    } catch {
      toast.error("Couldn't save your recipe. Please try again.");
    }
  });

  return (
    <form onSubmit={submit} className="space-y-8">
      <section className="space-y-4">
        <div>
          <Label htmlFor="title">Title</Label>
          <Input id="title" placeholder="Charred corn & lime salad" {...register("title")} />
          <FieldError message={errors.title?.message} />
        </div>
        <div>
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            rows={3}
            placeholder="A bright, smoky salad that comes together in minutes."
            {...register("description")}
          />
          <FieldError message={errors.description?.message} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="categoryId">Category</Label>
            <Select id="categoryId" {...register("categoryId")}>
              <option value="">Select a category…</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
            <FieldError message={errors.categoryId?.message} />
          </div>
          <div>
            <Label htmlFor="difficulty">Difficulty</Label>
            <Select id="difficulty" {...register("difficulty")}>
              <option value="EASY">Easy</option>
              <option value="MEDIUM">Medium</option>
              <option value="HARD">Hard</option>
            </Select>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <Label htmlFor="servings">Servings</Label>
            <Input id="servings" type="number" min={1} {...register("servings")} />
            <FieldError message={errors.servings?.message} />
          </div>
          <div>
            <Label htmlFor="prepTimeMins">Prep (min)</Label>
            <Input id="prepTimeMins" type="number" min={0} {...register("prepTimeMins")} />
            <FieldError message={errors.prepTimeMins?.message} />
          </div>
          <div>
            <Label htmlFor="cookTimeMins">Cook (min)</Label>
            <Input id="cookTimeMins" type="number" min={0} {...register("cookTimeMins")} />
            <FieldError message={errors.cookTimeMins?.message} />
          </div>
        </div>
        <div>
          <Label htmlFor="imageUrl">Image URL (optional)</Label>
          <div className="mt-1 flex flex-col gap-3 sm:flex-row sm:items-start">
            <div className="flex-1">
              <Input
                id="imageUrl"
                type="url"
                placeholder="https://…"
                {...register("imageUrl")}
              />
              <FieldError message={errors.imageUrl?.message} />
              <p className="mt-1 text-xs text-muted-foreground">
                Leave blank to use the generated cover shown here.
              </p>
            </div>
            <div className="w-full shrink-0 overflow-hidden rounded-md border border-border sm:w-40">
              <div className="aspect-[4/3]">
                <RecipeImage
                  title={title || "Your recipe"}
                  imageUrl={imageUrl || null}
                  hue={hueFromString(title || "Your recipe")}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Tags */}
      <section>
        <h2 className="mb-3 font-semibold">Tags</h2>
        <div className="space-y-4">
          {GROUP_ORDER.map((group) => (
            <div key={group}>
              <p className="mb-2 text-sm text-muted-foreground">{group}</p>
              <div className="flex flex-wrap gap-2">
                {grouped[group].map((tag) => {
                  const active = selectedTags.includes(tag.id);
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => toggleTag(tag.id)}
                      className={cn(
                        "rounded-full border px-3 py-1 text-sm transition-colors",
                        active
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:border-primary/40",
                      )}
                    >
                      {tag.name}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Ingredients */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">Ingredients</h2>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              appendIngredient({ name: "", quantity: 1, unit: "", notes: "" })
            }
          >
            <Plus className="size-4" /> Add
          </Button>
        </div>
        <FieldError message={errors.ingredients?.root?.message} />
        <div ref={ingredientContainerRef} className="space-y-2">
          {ingredients.fields.map((field, i) => (
            <div key={field.id} data-row className="flex items-start gap-2">
              <div className="grid flex-1 gap-2 sm:grid-cols-[80px_80px_1fr_1fr]">
                <div>
                  <Input
                    type="number"
                    step="any"
                    aria-label="Quantity"
                    placeholder="Qty"
                    {...register(`ingredients.${i}.quantity`)}
                  />
                  <FieldError message={errors.ingredients?.[i]?.quantity?.message} />
                </div>
                <Input
                  aria-label="Unit"
                  placeholder="Unit"
                  {...register(`ingredients.${i}.unit`)}
                />
                <div>
                  <Input
                    aria-label="Ingredient"
                    placeholder="Ingredient"
                    {...register(`ingredients.${i}.name`)}
                  />
                  <FieldError message={errors.ingredients?.[i]?.name?.message} />
                </div>
                <Input
                  aria-label="Notes"
                  placeholder="Notes (optional)"
                  {...register(`ingredients.${i}.notes`)}
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Remove ingredient"
                disabled={ingredients.fields.length === 1}
                onClick={() => removeIngredient(i)}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      </section>

      {/* Steps */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">Method</h2>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => appendStep({ instruction: "" })}
          >
            <Plus className="size-4" /> Add step
          </Button>
        </div>
        <FieldError message={errors.steps?.root?.message} />
        <div ref={stepContainerRef} className="space-y-2">
          {steps.fields.map((field, i) => (
            <div key={field.id} data-row className="flex items-start gap-2">
              <span className="mt-2 flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold text-muted-foreground">
                {i + 1}
              </span>
              <div className="flex-1">
                <Textarea
                  rows={2}
                  aria-label={`Step ${i + 1}`}
                  placeholder="Describe this step…"
                  {...register(`steps.${i}.instruction`)}
                />
                <FieldError message={errors.steps?.[i]?.instruction?.message} />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Remove step"
                disabled={steps.fields.length === 1}
                onClick={() => removeStep(i)}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      </section>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting
            ? "Saving…"
            : mode === "edit"
              ? "Save changes"
              : "Publish recipe"}
        </Button>
      </div>
    </form>
  );
}
