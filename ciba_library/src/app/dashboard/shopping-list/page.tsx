import type { Metadata } from "next";
import { getShoppingList } from "@/data/users";
import {
  clearCheckedItems,
  removeShoppingItem,
  toggleShoppingItem,
} from "@/lib/actions/shopping";
import { ShoppingList } from "@/components/shopping/ShoppingList";

export const metadata: Metadata = { title: "Shopping list" };

export default async function ShoppingListPage() {
  const items = await getShoppingList();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Shopping list</h1>
        <p className="text-muted-foreground">
          Ingredients you&apos;ve saved, grouped by recipe. Check them off as you
          shop.
        </p>
      </header>
      <ShoppingList
        initialItems={items}
        onToggle={toggleShoppingItem}
        onRemove={removeShoppingItem}
        onClearChecked={clearCheckedItems}
      />
    </div>
  );
}
