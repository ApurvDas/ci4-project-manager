"use client";

import * as React from "react";
import Link from "next/link";
import { Trash2, ShoppingBasket } from "lucide-react";
import { toast } from "sonner";
import type { ShoppingListItem } from "@/lib/types";
import { DrawableCheck } from "@/components/motion/DrawableCheck";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/EmptyState";
import { formatQuantity } from "@/lib/scaling";
import { cn } from "@/lib/utils";

interface ShoppingListProps {
  initialItems: ShoppingListItem[];
  onToggle?: (id: string, checked: boolean) => Promise<void> | void;
  onRemove?: (id: string) => Promise<void> | void;
  onClearChecked?: () => Promise<void> | void;
}

/**
 * Interactive shopping list. Checking an item draws the tick in and dims the
 * row; items group under their source recipe. Mutations are optimistic and get
 * real server actions in Phase 4.
 */
export function ShoppingList({
  initialItems,
  onToggle,
  onRemove,
  onClearChecked,
}: ShoppingListProps) {
  const [items, setItems] = React.useState(initialItems);

  const groups = React.useMemo(() => {
    const map = new Map<
      string,
      { title: string; slug: string | null; items: ShoppingListItem[] }
    >();
    for (const item of items) {
      const key = item.recipeSlug ?? "__loose__";
      if (!map.has(key)) {
        map.set(key, {
          title: item.recipeTitle ?? "Other items",
          slug: item.recipeSlug,
          items: [],
        });
      }
      map.get(key)!.items.push(item);
    }
    return [...map.values()];
  }, [items]);

  const checkedCount = items.filter((i) => i.checked).length;

  const toggle = async (item: ShoppingListItem) => {
    const next = !item.checked;
    setItems((list) =>
      list.map((i) => (i.id === item.id ? { ...i, checked: next } : i)),
    );
    try {
      await onToggle?.(item.id, next);
    } catch {
      setItems((list) =>
        list.map((i) => (i.id === item.id ? { ...i, checked: !next } : i)),
      );
      toast.error("Couldn't update that item.");
    }
  };

  const remove = async (id: string) => {
    const prev = items;
    setItems((list) => list.filter((i) => i.id !== id));
    try {
      await onRemove?.(id);
    } catch {
      setItems(prev);
      toast.error("Couldn't remove that item.");
    }
  };

  const clearChecked = async () => {
    const prev = items;
    setItems((list) => list.filter((i) => !i.checked));
    try {
      await onClearChecked?.();
      toast.success("Cleared checked items");
    } catch {
      setItems(prev);
      toast.error("Couldn't clear items.");
    }
  };

  if (items.length === 0) {
    return (
      <EmptyState
        icon={ShoppingBasket}
        title="Your shopping list is empty"
        description="Add ingredients from any recipe and they'll collect here, grouped by dish."
        action={
          <Button asChild>
            <Link href="/recipes">Browse recipes</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {items.length} {items.length === 1 ? "item" : "items"} · {checkedCount}{" "}
          checked
        </p>
        {checkedCount > 0 && (
          <Button variant="outline" size="sm" onClick={clearChecked}>
            <Trash2 className="size-4" /> Clear checked
          </Button>
        )}
      </div>

      {groups.map((group) => (
        <section
          key={group.slug ?? "loose"}
          className="rounded-lg border border-border bg-card"
        >
          <h2 className="border-b border-border px-4 py-2.5 text-sm font-semibold">
            {group.slug ? (
              <Link href={`/recipes/${group.slug}`} className="hover:text-primary">
                {group.title}
              </Link>
            ) : (
              group.title
            )}
          </h2>
          <ul className="divide-y divide-border">
            {group.items.map((item) => (
              <li key={item.id} className="flex items-center gap-3 px-4 py-2.5">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={item.checked}
                  aria-label={`Mark ${item.name} as ${item.checked ? "not bought" : "bought"}`}
                  onClick={() => toggle(item)}
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded border transition-colors",
                    item.checked
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input text-transparent",
                  )}
                >
                  <DrawableCheck checked={item.checked} className="size-4" />
                </button>
                <span
                  className={cn(
                    "flex-1 text-sm transition-colors",
                    item.checked && "text-muted-foreground line-through",
                  )}
                >
                  <span className="font-medium tabular-nums">
                    {formatQuantity(item.quantity)}
                    {item.unit ? ` ${item.unit}` : ""}
                  </span>{" "}
                  {item.name}
                </span>
                <button
                  type="button"
                  aria-label={`Remove ${item.name}`}
                  onClick={() => remove(item.id)}
                  className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
